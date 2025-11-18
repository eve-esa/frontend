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

  const controller = new AbortController();
  currentStreamAbortController = controller;
  try {
    await api.post(url, payload, {
      responseType: "text",
      signal: controller.signal,
      onDownloadProgress: (e: AxiosProgressEvent) => {
        const xhr = (e.event?.target || e.event?.currentTarget) as
          | XMLHttpRequest
          | undefined;
        const text = (xhr && (xhr.responseText as string)) || "";
        if (!text) return;
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
