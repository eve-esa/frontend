import api from "./axios";
import type { AxiosProgressEvent } from "axios";

export type StreamEvent =
  | { type: "token"; content: string }
  | {
      type: "final";
      answer: string;
      trace?: Record<string, unknown>[] | null;
      artifact_ids?: string[];
    }
  | { type: "status"; content: string }
  | { type: "requery"; content: string }
  // Agentic pipeline only (stream-generate-agentic): emitted when the agent
  // invokes an MCP tool ("tool_call") or the tool returns ("tool_result").
  | { type: "tool_call"; content?: string; [key: string]: unknown }
  | { type: "tool_result"; content?: string; preview?: string; [key: string]: unknown }
  | { type: "stopped" }
  | { type: "error"; content?: string; [key: string]: unknown }
  | { type: "label"; content: number | string }
  | { type: "reason"; content: string }
  | { type: "rewritten_question"; content: string }
  | Record<string, unknown>;

export type PostStreamOptions<TPayload> = {
  url: string;
  payload: TPayload;
  onEvent: (evt: StreamEvent) => void;
};

let currentStreamAbortController: AbortController | null = null;
// Flag to inform downstream error handlers that the next error was caused by a user stop action.
let nextErrorShouldSuppressToast = false;
// Set by the progress watchdog: its abort raises the same CanceledError as a
// user stop, and without this flag the two are indistinguishable downstream,
// so a hung stream would be silently filed as "user pressed stop".
let lastAbortWasWatchdogTimeout = false;

export function markNextErrorAsUserCanceled() {
  nextErrorShouldSuppressToast = true;
}

export function consumeSuppressToastFlag(): boolean {
  const shouldSuppress = nextErrorShouldSuppressToast;
  nextErrorShouldSuppressToast = false;
  return shouldSuppress;
}

export function consumeWatchdogTimeoutFlag(): boolean {
  const wasTimeout = lastAbortWasWatchdogTimeout;
  lastAbortWasWatchdogTimeout = false;
  return wasTimeout;
}

export function abortCurrentStream() {
  if (currentStreamAbortController) {
    // Mark that the next error is a deliberate user cancellation
    nextErrorShouldSuppressToast = true;
    currentStreamAbortController.abort();
    currentStreamAbortController = null;
  }
}

// Streams a text/event-stream style response using axios + onDownloadProgress
export async function postStream<TPayload>({
  url,
  payload,
  onEvent,
}: PostStreamOptions<TPayload>): Promise<void> {
  let buffer = "";
  let lastIndex = 0;
  let lastProgressTime = Date.now();
  const PROGRESS_TIMEOUT = 60000;

  // A stale flag from a previous stream (watchdog fired after the observer
  // unmounted, or raced a completing response) must not misclassify this
  // stream's outcome.
  lastAbortWasWatchdogTimeout = false;

  const controller = new AbortController();
  currentStreamAbortController = controller;

  const separator = url.includes("?") ? "&" : "?";
  const uniqueUrl = `${url}${separator}_nocache=${Date.now()}&_r=${Math.random().toString(36).substring(7)}`;

  const progressTimeout = setInterval(() => {
    const timeSinceLastProgress = Date.now() - lastProgressTime;
    if (timeSinceLastProgress > PROGRESS_TIMEOUT) {
      console.error(
        "Stream timeout: no progress for",
        timeSinceLastProgress,
        "ms"
      );
      lastAbortWasWatchdogTimeout = true;
      controller.abort();
      clearInterval(progressTimeout);
    }
  }, 5000);

  try {
    await api.post(uniqueUrl, payload, {
      responseType: "text",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
      onDownloadProgress: (e: AxiosProgressEvent) => {
        lastProgressTime = Date.now();

        const xhr = (e.event?.target || e.event?.currentTarget) as
          | XMLHttpRequest
          | undefined;

        if (!xhr) return;

        const text = xhr.responseText as string;
        if (!text) return;

        if (text.length <= lastIndex) {
          console.log("Stream appears frozen: no new data", {
            currentLength: text.length,
            lastIndex,
            readyState: xhr.readyState,
          });
          return;
        }

        const newText = text.slice(lastIndex);
        lastIndex = text.length;
        buffer += newText;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const content = trimmed.startsWith("data:")
            ? trimmed.slice(5).trim()
            : trimmed;
          if (!content.startsWith("{") || !content.endsWith("}")) continue;
          try {
            const evt = JSON.parse(content) as StreamEvent;
            onEvent(evt);
          } catch {
            console.error("Malformed JSON line:", content);
          }
        }
      },
    });
    clearInterval(progressTimeout);
  } catch (error) {
    clearInterval(progressTimeout);
    throw error;
  } finally {
    currentStreamAbortController = null;
  }

  if (buffer) {
    // Same normalization as the in-progress parser: the terminal error event
    // often sits here without a trailing newline, still data:-prefixed, and it
    // must not be lost to a parse failure.
    const trimmed = buffer.trim();
    const content = trimmed.startsWith("data:")
      ? trimmed.slice(5).trim()
      : trimmed;
    if (content.startsWith("{") && content.endsWith("}")) {
      try {
        const evt = JSON.parse(content) as StreamEvent;
        onEvent(evt);
      } catch {
        console.error("Malformed JSON line:", content);
      }
    }
  }
}
