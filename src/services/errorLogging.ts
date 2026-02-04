import api from "./axios";

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

