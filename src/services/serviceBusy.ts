import { useSyncExternalStore } from "react";

// Past its in-flight cap a backend worker refuses a generation with
// 429 {"detail": {"code": "overloaded", ...}} and Retry-After. Unlike the
// token-budget 429 nothing is wrong with the user's account, so the send is
// retried once after the advertised delay while a notice counts down on the
// composer. A second refusal ends the turn and hands the text back to the
// composer.

export const OVERLOADED_CODE = "overloaded";
export const DEFAULT_RETRY_AFTER_S = 10;
// Upper bound on how long the composer waits: a misconfigured header must not
// park a send for minutes.
const MAX_RETRY_AFTER_S = 60;

export const busyCountdownCopy = (seconds: number) =>
  `EVE is busy right now. Retrying in ${seconds} s`;
export const BUSY_FINAL_COPY = "Still busy. Please try again in a moment";

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

// The retry delay in seconds when the error is the overload refusal, null for
// anything else (the token-budget 429 included).
export const overloadedRetryAfter = (error: unknown): number | null => {
  const response = (error as ErrorLike | null | undefined)?.response;
  if (response?.status !== 429) return null;
  if (readDetailCode(response.data) !== OVERLOADED_CODE) return null;
  return parseRetryAfterSeconds(readRetryAfter(response.headers));
};

export class ServiceBusyError extends Error {
  // True when the user pressed Stop during the countdown rather than the
  // retry being refused again.
  readonly canceled: boolean;

  constructor(canceled: boolean) {
    super(canceled ? "Busy retry canceled" : "Service busy");
    this.name = "ServiceBusyError";
    this.canceled = canceled;
  }
}

export const isServiceBusyError = (error: unknown): error is ServiceBusyError =>
  Boolean(error) &&
  typeof error === "object" &&
  (error as { name?: unknown }).name === "ServiceBusyError";

// ─── Notice store ────────────────────────────────────────────────────────────
// Shared by the send mutation (writer) and the composer (reader), which live in
// different components. Keyed by conversation so a notice never shows on
// another chat.

// waiting: countdown before the one retry. stopped: the retry was refused too,
// the final copy shows. canceled: Stop pressed during the countdown, nothing
// shows. The last two carry the text back to the composer until it takes it.
export type BusyNotice =
  | { conversationId: string; phase: "waiting"; secondsLeft: number }
  | {
      conversationId: string;
      phase: "stopped" | "canceled";
      draft: string | null;
    };

let notice: BusyNotice | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const getBusyNotice = () => notice;

export const setBusyNotice = (next: BusyNotice | null) => {
  notice = next;
  emit();
};

export const clearBusyNotice = (conversationId?: string) => {
  if (!notice) return;
  if (conversationId && notice.conversationId !== conversationId) return;
  setBusyNotice(null);
};

// The composer takes the returned text once; the final copy stays visible
// until the next send.
export const takeBusyDraft = (conversationId: string): string | null => {
  if (
    !notice ||
    notice.phase === "waiting" ||
    notice.conversationId !== conversationId ||
    notice.draft === null
  ) {
    return null;
  }
  const { draft } = notice;
  setBusyNotice(notice.phase === "canceled" ? null : { ...notice, draft: null });
  return draft;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useBusyNotice = (conversationId?: string): BusyNotice | null => {
  const current = useSyncExternalStore(subscribe, getBusyNotice, getBusyNotice);
  return current && conversationId && current.conversationId === conversationId
    ? current
    : null;
};

// ─── Countdown and retry ─────────────────────────────────────────────────────

let cancelWait: (() => void) | null = null;

export const isBusyWaitActive = () => cancelWait !== null;

// Stop pressed during the countdown: there is no stream to abort yet.
export const cancelBusyWait = () => {
  cancelWait?.();
};

const countdown = (
  conversationId: string,
  seconds: number,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    let left = seconds;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (timer) clearTimeout(timer);
      cancelWait = null;
    };
    cancelWait = () => {
      finish();
      reject(new ServiceBusyError(true));
    };
    const tick = () => {
      if (left <= 0) {
        finish();
        resolve();
        return;
      }
      setBusyNotice({ conversationId, phase: "waiting", secondsLeft: left });
      left -= 1;
      timer = setTimeout(tick, 1000);
    };
    tick();
  });

// Runs `attempt`; on the overload refusal waits Retry-After seconds with the
// countdown notice and runs it once more. A second refusal rejects with
// ServiceBusyError; any other error passes through untouched.
export const withBusyRetry = async <T>(
  conversationId: string,
  attempt: () => Promise<T>,
): Promise<T> => {
  try {
    return await attempt();
  } catch (error) {
    const delay = overloadedRetryAfter(error);
    if (delay === null) throw error;
    await countdown(conversationId, delay);
  }
  clearBusyNotice(conversationId);
  try {
    return await attempt();
  } catch (error) {
    if (overloadedRetryAfter(error) !== null) throw new ServiceBusyError(false);
    throw error;
  }
};
