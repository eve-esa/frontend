import { useEffect } from "react";
import { useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { isChunkLoadError, reloadOnce } from "@/utilities/staleChunk";

/**
 * What the router shows when a route throws, in place of React Router's
 * developer page. Colours are the app tokens, so both themes follow.
 */
export const RouteErrorView = () => (
  <div
    data-testid="app-error"
    role="alert"
    className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 bg-primary-600 p-4 text-center text-natural-50"
  >
    <h1 className="text-2xl font-bold">Something went wrong</h1>
    <p className="text-natural-200">Reload the page.</p>
    <Button
      data-testid="app-error-reload"
      onClick={() => window.location.reload()}
    >
      Reload
    </Button>
  </div>
);

export const RouteError = () => {
  const error = useRouteError();
  const stale = isChunkLoadError(error);

  useEffect(() => {
    if (stale) reloadOnce();
  }, [stale]);

  return <RouteErrorView />;
};

RouteError.displayName = "RouteError";
