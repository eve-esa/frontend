import { logError } from "@/services/errorLogging";

export const setupGlobalErrorHandlers = () => {
  window.addEventListener("unhandledrejection", (event) => {
    const error = event.reason;
    const errorMessage =
      error?.message || String(error) || "Unhandled Promise Rejection";

    logError({
      error_message: errorMessage,
      error_stack: error?.stack,
      error_type: error?.name || "UnhandledPromiseRejection",
      url: window.location.href,
      user_agent: navigator.userAgent,
      component: "GlobalErrorHandler",
      description: `Unhandled promise rejection: ${errorMessage}`,
      metadata: {
        reason: String(error),
      },
    }).catch(() => {
      console.error("Failed to log error to backend:", error);
    });
  });

  window.addEventListener("error", (event) => {
    logError({
      error_message: event.message,
      error_stack: event.error?.stack,
      error_type: event.error?.name || "GlobalError",
      url: window.location.href,
      user_agent: navigator.userAgent,
      component: "GlobalErrorHandler",
      description: `Global JavaScript error: ${event.message}`,
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    }).catch(() => {
      console.error("Failed to log error to backend:", event.error);
    });
  });
};

