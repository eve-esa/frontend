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

export const logError = async (payload: ErrorLogPayload): Promise<void> => {
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

