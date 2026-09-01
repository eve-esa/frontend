import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "react-oidc-context";
import type { User } from "oidc-client-ts";
import App from "./App";
import { router } from "./router";
import { userManager } from "./services/oidc";
import "./index.css";
import { setupGlobalErrorHandlers } from "./utils/globalErrorHandler";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Runs once the code/state exchange has completed on /callback: strip the
// OIDC params from the URL (leaving them breaks silent renew) and take the
// user back to the deep link PrivateRoute stashed in signinRedirect state.
const onSigninCallback = (user: User | undefined) => {
  window.history.replaceState({}, document.title, window.location.pathname);
  const returnTo =
    (user?.state as { returnTo?: string } | undefined)?.returnTo ?? "/";
  void router.navigate(returnTo, { replace: true });
};

setupGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider userManager={userManager} onSigninCallback={onSigninCallback}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </AuthProvider>
  </React.StrictMode>
);
