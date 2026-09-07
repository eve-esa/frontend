import { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasAuthParams, useAuth } from "react-oidc-context";
import { routes } from "@/utilities/routes.tsx";
import { LOCAL_STORAGE_TOUR_COMPLETED } from "@/utilities/localStorage";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Spinner } from "@/components/ui/Spinner";
import { isSignoutInProgress } from "@/services/oidc";

/**
 * Pure decision at the heart of the sign-in effect below, pulled out so the
 * truth table can be tested without mounting the component. Every input
 * that would otherwise start a competing sign-in must be false, including
 * `signoutInProgress`: a logout removes the stored user and briefly leaves
 * the page looking unauthenticated, and without this check that alone would
 * fire a signinRedirect racing the sign-out.
 */
export const shouldAttemptSignin = (p: {
  isLoading: boolean;
  isAuthenticated: boolean;
  activeNavigator?: string;
  signoutInProgress: boolean;
  hasAuthParams: boolean;
  hasTriedSignin: boolean;
}): boolean =>
  !p.isLoading &&
  !p.isAuthenticated &&
  !p.activeNavigator &&
  !p.signoutInProgress &&
  !p.hasAuthParams &&
  !p.hasTriedSignin;

export const PrivateRoute = () => {
  const auth = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  // One redirect per mount: without this an IdP that answers "not signed in"
  // would bounce the browser in a loop.
  const hasTriedSignin = useRef(false);

  useEffect(() => {
    if (
      shouldAttemptSignin({
        isLoading: auth.isLoading,
        isAuthenticated: auth.isAuthenticated,
        activeNavigator: auth.activeNavigator,
        signoutInProgress: isSignoutInProgress(),
        hasAuthParams: hasAuthParams(),
        hasTriedSignin: hasTriedSignin.current,
      })
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
