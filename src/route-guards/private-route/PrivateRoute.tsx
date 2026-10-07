import { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasAuthParams, useAuth } from "react-oidc-context";
import { routes } from "@/utilities/routes.tsx";
import { LOCAL_STORAGE_TOUR_COMPLETED } from "@/utilities/localStorage";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Spinner } from "@/components/ui/Spinner";
import {
  isSignedOutElsewhere,
  isSignoutInProgress,
  resumeStoredSession,
} from "@/services/oidc";
import { useGetProfile } from "@/services/useMe";
import { isPendingApproval } from "@/services/approval";
import { PendingApprovalPage } from "@/pages/pending-approval/PendingApprovalPage";
import { SignedOutPage } from "@/pages/signed-out/SignedOutPage";
import { setTelemetryUser } from "@/observability/telemetry";

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

/**
 * The stored refresh token first, the interactive redirect only when it
 * cannot bring the session back. A successful renew raises the user loaded
 * event, so AuthProvider flips to authenticated without a navigation. The
 * sign-out latch is read again after the renew: a sign-out may have started
 * while it ran.
 */
export const signinAfterStoredSession = async (
  redirect: () => Promise<unknown>
): Promise<boolean> => {
  if (await resumeStoredSession()) {
    return true;
  }
  if (!isSignoutInProgress()) {
    await redirect();
  }
  return false;
};

/**
 * The sign-in attempt of one PrivateRoute mount. `tried` blocks a second
 * redirect; a resume that brought the session back without a navigation
 * clears it again, so a later signed-out state in this tab can still
 * redirect instead of leaving the spinner up for good.
 */
export const attemptSignin = async (
  tried: { current: boolean },
  redirect: () => Promise<unknown>
): Promise<void> => {
  tried.current = true;
  if (await signinAfterStoredSession(redirect)) {
    tried.current = false;
  }
};

/**
 * The view PrivateRoute renders, decided in one place so the truth table can
 * be tested without mounting the component. The profile check and the
 * onboarding redirect both gate the same Outlet, so the order matters: a
 * pending account must never reach the onboarding branch and mount any part
 * of the chat tree, even briefly.
 */
export type PrivateRouteView =
  | "signed-out"
  | "spinner"
  | "pending-approval"
  | "onboarding"
  | "outlet";

export const resolvePrivateRouteState = (p: {
  signedOutElsewhere: boolean;
  authLoading: boolean;
  isAuthenticated: boolean;
  isProfileLoading: boolean;
  isPending: boolean;
  needsOnboarding: boolean;
}): PrivateRouteView => {
  if (p.signedOutElsewhere && !p.isAuthenticated) {
    return "signed-out";
  }
  if (p.authLoading || !p.isAuthenticated) {
    return "spinner";
  }
  if (p.isProfileLoading) {
    return "spinner";
  }
  if (p.isPending) {
    return "pending-approval";
  }
  if (p.needsOnboarding) {
    return "onboarding";
  }
  return "outlet";
};

export const PrivateRoute = () => {
  const auth = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  // One redirect per mount: without this an IdP that answers "not signed in"
  // would bounce the browser in a loop.
  const hasTriedSignin = useRef(false);
  // Enabled only once authenticated: calling /users/me beforehand would hit
  // it with no token and feed the axios 401 recovery flow, racing the
  // sign-in redirect above. Hooks must still run every render, so this is a
  // disabled query rather than a conditional hook call.
  const {
    data: profile,
    isLoading: isProfileLoading,
    error: profileError,
  } = useGetProfile({
    enabled: auth.isAuthenticated,
  });

  // Tags browser telemetry with the user id once the profile resolves. A no-op
  // when telemetry is off.
  useEffect(() => {
    setTelemetryUser(profile?.id);
  }, [profile?.id]);

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
      void attemptSignin(hasTriedSignin, () =>
        // The deep link travels in OIDC state and comes back to onSigninCallback.
        auth.signinRedirect({
          state: { returnTo: location.pathname + location.search },
        })
      );
    }
  }, [auth, location]);

  const view = resolvePrivateRouteState({
    signedOutElsewhere: isSignedOutElsewhere(),
    authLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    isProfileLoading,
    isPending: isPendingApproval(profileError),
    needsOnboarding:
      !localStorage.getItem(LOCAL_STORAGE_TOUR_COMPLETED) &&
      location.pathname !== routes.ONBOARDING.path &&
      !isMobile,
  });

  switch (view) {
    case "signed-out":
      return <SignedOutPage />;
    case "spinner":
      return (
        <div className="flex h-screen w-screen items-center justify-center">
          <Spinner size="md" />
        </div>
      );
    case "pending-approval":
      return <PendingApprovalPage />;
    case "onboarding":
      return <Navigate to={routes.ONBOARDING.path} />;
    case "outlet":
      return <Outlet />;
  }
};
