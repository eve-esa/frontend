import { isCancel } from "axios";
import api from "./axios";
import { recordException } from "@/observability/telemetry";

export interface ErrorLogPayload {
  error_message: string;
  error_stack?: string;
  error_type: string;
  url?: string;
  user_agent?: string;
  component?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// Names a cancellation carries: axios raises CanceledError when a request's
// signal aborts, fetch and a bare AbortController raise a DOMException named
// AbortError. A user Stop ends that way and is not an error.
const CANCELLATION_NAMES = new Set(["CanceledError", "AbortError"]);

export const isCancellation = (error: unknown): boolean => {
  if (isCancel(error)) return true;
  if (!error || typeof error !== "object") return false;
  // Structural check: a DOMException's Error lineage varies by browser.
  const { name, code } = error as { name?: unknown; code?: unknown };
  return (
    (typeof name === "string" && CANCELLATION_NAMES.has(name)) ||
    code === "ERR_CANCELED"
  );
};

export const logError = async (payload: ErrorLogPayload): Promise<void> => {
  // A cancellation reaches here as error_type from the global handler, which
  // copies error.name: drop it before it reaches either error feed.
  if (CANCELLATION_NAMES.has(payload.error_type)) return;

  // Same payload to the telemetry backend. A no-op when telemetry is off, and
  // it never throws, so the POST below runs exactly as before.
  recordException(
    {
      name: payload.error_type,
      message: payload.error_message,
      stack: payload.error_stack,
    },
    {
      "eve.error.component": payload.component || "FRONTEND",
      "eve.error.description": payload.description,
      "url.full": payload.url,
      "user_agent.original": payload.user_agent,
      "eve.error.metadata": payload.metadata,
    },
  );

  try {
    await api.post("/log-error", {
      error_message: payload.error_message,
      error_stack: payload.error_stack,
      error_type: payload.error_type,
      url: payload.url,
      user_agent: payload.user_agent,
      component: payload.component || "FRONTEND",
      description: payload.description,
      metadata: payload.metadata,
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("Failed to log error to backend:", error);
    }
  }
};

