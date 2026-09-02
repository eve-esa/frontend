import { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasAuthParams, useAuth } from "react-oidc-context";
import { routes } from "@/utilities/routes.tsx";
import { LOCAL_STORAGE_TOUR_COMPLETED } from "@/utilities/localStorage";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Spinner } from "@/components/ui/Spinner";

export const PrivateRoute = () => {
  const auth = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  // One redirect per mount: without this an IdP that answers "not signed in"
  // would bounce the browser in a loop.
  const hasTriedSignin = useRef(false);

  useEffect(() => {
    if (
      !auth.isLoading &&
      !auth.isAuthenticated &&
      !auth.activeNavigator &&
      !hasAuthParams() &&
      !hasTriedSignin.current
    ) {
      hasTriedSignin.current = true;
      // The deep link travels in OIDC state and comes back to onSigninCallback.
      void auth.signinRedirect({
        state: { returnTo: location.pathname + location.search },
      });
    }
  }, [auth, location]);

  if (auth.isLoading || !auth.isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  if (
    !localStorage.getItem(LOCAL_STORAGE_TOUR_COMPLETED) &&
    location.pathname !== routes.ONBOARDING.path &&
    !isMobile
  ) {
    return <Navigate to={routes.ONBOARDING.path} />;
  }

  return <Outlet />;
};
