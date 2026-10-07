import { describe, expect, it, vi } from "vitest";
import { isSignoutInProgress, resumeStoredSession } from "@/services/oidc";
import {
  attemptSignin,
  resolvePrivateRouteState,
  shouldAttemptSignin,
  signinAfterStoredSession,
} from "./PrivateRoute";

vi.mock("@/services/oidc", () => ({
  CALLBACK_PATH: "/callback",
  clearSignedOutElsewhere: vi.fn(),
  isSignedOutElsewhere: vi.fn(() => false),
  isSignoutInProgress: vi.fn(() => false),
  resumeStoredSession: vi.fn(),
}));

// The base case: everything is in the "should redirect" state. Each test
// below flips exactly one field to false and checks the result flips too,
// except the last one, which is the regression this file exists for.
const base = {
  isLoading: false,
  isAuthenticated: false,
  activeNavigator: undefined,
  signoutInProgress: false,
  hasAuthParams: false,
  hasTriedSignin: false,
};

describe("shouldAttemptSignin", () => {
  it("attempts sign-in when every guard is clear", () => {
    expect(shouldAttemptSignin(base)).toBe(true);
  });

  it("does not attempt sign-in while auth is still loading", () => {
    expect(shouldAttemptSignin({ ...base, isLoading: true })).toBe(false);
  });

  it("does not attempt sign-in when already authenticated", () => {
    expect(shouldAttemptSignin({ ...base, isAuthenticated: true })).toBe(
      false
    );
  });

  it("does not attempt sign-in while a navigator is already active", () => {
    expect(
      shouldAttemptSignin({ ...base, activeNavigator: "signinRedirect" })
    ).toBe(false);
  });

  it("does not attempt sign-in when the URL carries auth params", () => {
    expect(shouldAttemptSignin({ ...base, hasAuthParams: true })).toBe(false);
  });

  it("does not attempt sign-in after a sign-in was already tried this mount", () => {
    expect(shouldAttemptSignin({ ...base, hasTriedSignin: true })).toBe(
      false
    );
  });

  it("regression: does not attempt sign-in while a sign-out is in progress, even though every other guard says go", () => {
    expect(shouldAttemptSignin({ ...base, signoutInProgress: true })).toBe(
      false
    );
  });
});

// The base case: authenticated, profile loaded, nothing pending, no
// onboarding needed. Each test below flips exactly one field and checks the
// view flips too.
const viewBase = {
  signedOutElsewhere: false,
  authLoading: false,
  isAuthenticated: true,
  isProfileLoading: false,
  isPending: false,
  needsOnboarding: false,
};

describe("resolvePrivateRouteState", () => {
  it("shows the signed-out view once another tab signed out", () => {
    expect(
      resolvePrivateRouteState({
        ...viewBase,
        isAuthenticated: false,
        signedOutElsewhere: true,
      })
    ).toBe("signed-out");
  });

  it("keeps the outlet when signed in again after a sign-out elsewhere", () => {
    expect(
      resolvePrivateRouteState({ ...viewBase, signedOutElsewhere: true })
    ).toBe("outlet");
  });

  it("renders the outlet when everything is settled", () => {
    expect(resolvePrivateRouteState(viewBase)).toBe("outlet");
  });

  it("shows the spinner while auth is still loading", () => {
    expect(
      resolvePrivateRouteState({ ...viewBase, authLoading: true })
    ).toBe("spinner");
  });

  it("shows the spinner when not authenticated", () => {
    expect(
      resolvePrivateRouteState({ ...viewBase, isAuthenticated: false })
    ).toBe("spinner");
  });

  it("shows the spinner while the profile call is still loading", () => {
    expect(
      resolvePrivateRouteState({ ...viewBase, isProfileLoading: true })
    ).toBe("spinner");
  });

  it("shows the pending-approval page when the profile call is pending approval", () => {
    expect(resolvePrivateRouteState({ ...viewBase, isPending: true })).toBe(
      "pending-approval"
    );
  });

  it("redirects to onboarding when needed", () => {
    expect(
      resolvePrivateRouteState({ ...viewBase, needsOnboarding: true })
    ).toBe("onboarding");
  });

  it("regression: a pending account never reaches onboarding, even though both conditions are true", () => {
    expect(
      resolvePrivateRouteState({
        ...viewBase,
        isPending: true,
        needsOnboarding: true,
      })
    ).toBe("pending-approval");
  });
});

describe("signinAfterStoredSession", () => {
  it("renews from the stored refresh token without a redirect", async () => {
    vi.mocked(resumeStoredSession).mockResolvedValue(true);
    const redirect = vi.fn(() => Promise.resolve());

    await signinAfterStoredSession(redirect);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects when the stored session cannot be renewed", async () => {
    vi.mocked(resumeStoredSession).mockResolvedValue(false);
    const redirect = vi.fn(() => Promise.resolve());

    await signinAfterStoredSession(redirect);
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it("does not redirect when a sign-out started during the renew", async () => {
    vi.mocked(resumeStoredSession).mockResolvedValue(false);
    vi.mocked(isSignoutInProgress).mockReturnValueOnce(true);
    const redirect = vi.fn(() => Promise.resolve());

    await signinAfterStoredSession(redirect);
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("attemptSignin", () => {
  it("clears the tried flag after a resume, so a later sign-out can redirect", async () => {
    vi.mocked(resumeStoredSession).mockResolvedValue(true);
    const tried = { current: false };

    await attemptSignin(tried, () => Promise.resolve());
    expect(tried.current).toBe(false);
  });

  it("keeps the tried flag after a redirect, one redirect per mount", async () => {
    vi.mocked(resumeStoredSession).mockResolvedValue(false);
    const tried = { current: false };
    const redirect = vi.fn(() => Promise.resolve());

    await attemptSignin(tried, redirect);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(tried.current).toBe(true);
  });

  it("sets the tried flag before the renew settles", () => {
    vi.mocked(resumeStoredSession).mockReturnValue(new Promise(() => undefined));
    const tried = { current: false };

    void attemptSignin(tried, () => Promise.resolve());
    expect(tried.current).toBe(true);
  });
});
