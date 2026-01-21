import api from "./axios";
import type { AxiosProgressEvent } from "axios";

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "final"; answer: string }
  | { type: "status"; content: string }
  | { type: "requery"; content: string }
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

export function markNextErrorAsUserCanceled() {
  nextErrorShouldSuppressToast = true;
}

export function consumeSuppressToastFlag(): boolean {
  const shouldSuppress = nextErrorShouldSuppressToast;
  nextErrorShouldSuppressToast = false;
  return shouldSuppress;
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
          } catch (_e) {
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
    const trimmed = buffer.trim();
    if (trimmed) {
      try {
        const evt = JSON.parse(trimmed) as StreamEvent;
        onEvent(evt);
      } catch (_e) {
        console.error("Malformed JSON line:", trimmed);
      }
    }
  }
}
