import { useSyncExternalStore } from "react";
import type { ImageAttachment } from "@/types";

// Past its in-flight cap a backend worker refuses a generation with
// 429 {"detail": {"code": "overloaded", ...}} and Retry-After. Unlike the
// token-budget 429 nothing is wrong with the user's account, so the send is
// retried once after the advertised delay while a notice counts down on the
// composer. A second refusal ends the turn and hands the text back to the
// composer. The per-user rate limiter refuses with 429
// {"detail": {"code": "rate_limited", ...}} and Retry-After: same single
// retry, with copy that blames the pace of requests instead of the service.

export const OVERLOADED_CODE = "overloaded";
export const RATE_LIMITED_CODE = "rate_limited";
// Absent on a notice means overloaded, so notices written before the reason
// existed keep their shape.
export type BusyReason = typeof OVERLOADED_CODE | typeof RATE_LIMITED_CODE;
export const DEFAULT_RETRY_AFTER_S = 10;
// Upper bound on how long the composer waits: a misconfigured header must not
// park a send for minutes.
const MAX_RETRY_AFTER_S = 60;

export const busyCountdownCopy = (seconds: number, reason?: BusyReason) =>
  reason === RATE_LIMITED_CODE
    ? `You are sending requests too fast, retrying in ${seconds} s`
    : `EVE is busy right now. Retrying in ${seconds} s`;
export const BUSY_FINAL_COPY = "Still busy. Please try again in a moment";
export const RATE_LIMITED_FINAL_COPY =
  "Still too many requests. Please try again in a moment";
export const busyFinalCopy = (reason?: BusyReason) =>
  reason === RATE_LIMITED_CODE ? RATE_LIMITED_FINAL_COPY : BUSY_FINAL_COPY;

type ErrorLike = {
  response?: {
    status?: number;
    data?: unknown;
    headers?: unknown;
  };
};

// The streaming request is made with responseType "text", so its error body
// is the raw JSON string; the blocking request gets it parsed.
const readDetailCode = (data: unknown): string | undefined => {
  let body = data;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return undefined;
    }
  }
  if (!body || typeof body !== "object") return undefined;
  const detail = (body as { detail?: unknown }).detail;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
    return undefined;
  }
  const code = (detail as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
};

const readRetryAfter = (headers: unknown): unknown => {
  if (!headers || typeof headers !== "object") return undefined;
  const withGet = headers as { get?: (name: string) => unknown };
  if (typeof withGet.get === "function") {
    const value = withGet.get("retry-after");
    if (value !== undefined && value !== null) return value;
  }
  const record = headers as Record<string, unknown>;
  return record["retry-after"] ?? record["Retry-After"];
};

// Only the delta-seconds form is read; an HTTP date or garbage falls back.
export const parseRetryAfterSeconds = (value: unknown): number => {
  const raw = String(value ?? "").trim();
  const seconds = Number(raw);
  if (raw === "" || !Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_RETRY_AFTER_S;
  }
  return Math.min(Math.ceil(seconds), MAX_RETRY_AFTER_S);
};

// Which retryable refusal the error is, with its delay in seconds; null for
// anything else (the token-budget 429 and any other 429 code included), which
// keeps the usual error path.
export const busyRefusal = (
  error: unknown,
): { reason: BusyReason; seconds: number } | null => {
  const response = (error as ErrorLike | null | undefined)?.response;
  if (response?.status !== 429) return null;
  const code = readDetailCode(response.data);
  if (code !== OVERLOADED_CODE && code !== RATE_LIMITED_CODE) return null;
  return {
    reason: code,
    seconds: parseRetryAfterSeconds(readRetryAfter(response.headers)),
  };
};

// The retry delay in seconds for either retryable refusal, null otherwise.
export const overloadedRetryAfter = (error: unknown): number | null =>
  busyRefusal(error)?.seconds ?? null;

export class ServiceBusyError extends Error {
  // True when the user pressed Stop during the countdown rather than the
  // retry being refused again.
  readonly canceled: boolean;
  readonly reason?: BusyReason;

  constructor(canceled: boolean, reason?: BusyReason) {
    super(canceled ? "Busy retry canceled" : "Service busy");
    this.name = "ServiceBusyError";
    this.canceled = canceled;
    if (reason === RATE_LIMITED_CODE) this.reason = reason;
  }
}

export const isServiceBusyError = (error: unknown): error is ServiceBusyError =>
  Boolean(error) &&
  typeof error === "object" &&
  (error as { name?: unknown }).name === "ServiceBusyError";

// ─── Notice store ────────────────────────────────────────────────────────────
// Shared by the send mutation (writer) and the composer (reader), which live in
// different components. One entry per conversation, so a countdown in one chat
// neither shows nor overwrites anything in another.

// What the composer gets back: the text and the attachments already uploaded
// for the refused send.
export type BusyDraft = {
  text: string;
  attachments?: ImageAttachment[];
};

// waiting: countdown before the one retry. stopped: the retry was refused too,
// the final copy shows. canceled: Stop pressed during the countdown, nothing
// shows. The last two carry the draft back to the composer until it takes it.
export type BusyNotice =
  | {
      conversationId: string;
      phase: "waiting";
      secondsLeft: number;
      reason?: BusyReason;
    }
  | {
      conversationId: string;
      phase: "stopped" | "canceled";
      draft: BusyDraft | null;
      reason?: BusyReason;
    };

const notices = new Map<string, BusyNotice>();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const getBusyNotice = (conversationId: string): BusyNotice | null =>
  notices.get(conversationId) ?? null;

export const setBusyNotice = (next: BusyNotice) => {
  notices.set(next.conversationId, next);
  emit();
};

// Without an id, clears every conversation (tests).
export const clearBusyNotice = (conversationId?: string) => {
  if (conversationId === undefined) {
    if (notices.size === 0) return;
    notices.clear();
  } else if (!notices.delete(conversationId)) {
    return;
  }
  emit();
};

// The composer takes the returned draft once; the final copy stays visible
// until the next send.
export const takeBusyDraft = (conversationId: string): BusyDraft | null => {
  const current = notices.get(conversationId);
  if (!current || current.phase === "waiting" || current.draft === null) {
    return null;
  }
  const { draft } = current;
  if (current.phase === "canceled") clearBusyNotice(conversationId);
  else setBusyNotice({ ...current, draft: null });
  return draft;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useBusyNotice = (conversationId?: string): BusyNotice | null => {
  const read = () => (conversationId ? getBusyNotice(conversationId) : null);
  return useSyncExternalStore(subscribe, read, read);
};

// ─── Countdown and retry ─────────────────────────────────────────────────────

// One cancel handle per conversation: Stop in one chat must not end another
// chat's countdown.
const cancelWaits = new Map<string, () => void>();

export const isBusyWaitActive = (conversationId: string) =>
  cancelWaits.has(conversationId);

// Stop pressed during the countdown: there is no stream to abort yet.
export const cancelBusyWait = (conversationId: string) => {
  cancelWaits.get(conversationId)?.();
};

const countdown = (
  conversationId: string,
  seconds: number,
  reason: BusyReason,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    let left = seconds;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cancel = () => {
      finish();
      reject(new ServiceBusyError(true, reason));
    };
    const finish = () => {
      if (timer) clearTimeout(timer);
      if (cancelWaits.get(conversationId) === cancel) {
        cancelWaits.delete(conversationId);
      }
    };
    cancelWaits.set(conversationId, cancel);
    const tick = () => {
      if (left <= 0) {
        finish();
        resolve();
        return;
      }
      setBusyNotice({
        conversationId,
        phase: "waiting",
        secondsLeft: left,
        ...(reason === RATE_LIMITED_CODE ? { reason } : {}),
      });
      left -= 1;
      timer = setTimeout(tick, 1000);
    };
    tick();
  });

// Runs `attempt`; on an overload or rate limit refusal waits Retry-After
// seconds with the countdown notice and runs it once more. A second refusal
// of either kind rejects with ServiceBusyError; any other error passes
// through untouched.
export const withBusyRetry = async <T>(
  conversationId: string,
  attempt: () => Promise<T>,
): Promise<T> => {
  try {
    return await attempt();
  } catch (error) {
    const refusal = busyRefusal(error);
    if (refusal === null) throw error;
    await countdown(conversationId, refusal.seconds, refusal.reason);
  }
  clearBusyNotice(conversationId);
  try {
    return await attempt();
  } catch (error) {
    const refusal = busyRefusal(error);
    if (refusal !== null) throw new ServiceBusyError(false, refusal.reason);
    throw error;
  }
};
