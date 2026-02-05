import { Component, type ErrorInfo, type ReactNode } from "react";
import { logError } from "@/services/errorLogging";
import { ErrorMessage } from "@/components/chat/ErrorMessage";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    logError({
      error_message: error.message,
      error_stack: error.stack,
      error_type: error.name || "Error",
      url: window.location.href,
      user_agent: navigator.userAgent,
      component: "ErrorBoundary",
      description: `React Error Boundary caught an error: ${error.message}`,
      metadata: {
        componentStack: errorInfo.componentStack,
      },
    }).catch((logError) => {
      console.error("Failed to log error to backend:", logError);
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[100dvh] bg-primary-600 text-natural-50 flex items-center justify-center p-4">
          <div className="container max-w-2xl">
            <div className="flex flex-col items-center justify-center gap-6">
              <div className="text-center space-y-4 mb-4">
                <h1 className="text-2xl font-bold">Something went wrong</h1>
                <p className="text-natural-200">
                  We're sorry, but something unexpected happened. The error has
                  been logged and we'll look into it.
                </p>
                {import.meta.env.DEV && this.state.error && (
                  <details className="mt-4 text-left">
                    <summary className="cursor-pointer text-sm text-natural-300 hover:text-natural-100">
                      Error Details (Development Only)
                    </summary>
                    <pre className="mt-2 p-4 bg-natural-900 rounded text-xs overflow-auto max-h-64">
                      {this.state.error.toString()}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </details>
                )}
              </div>
              <ErrorMessage />
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

