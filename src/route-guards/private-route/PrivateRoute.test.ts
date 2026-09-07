import { describe, expect, it } from "vitest";
import { resolvePrivateRouteState, shouldAttemptSignin } from "./PrivateRoute";

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
  authLoading: false,
  isAuthenticated: true,
  isProfileLoading: false,
  isPending: false,
  needsOnboarding: false,
};

describe("resolvePrivateRouteState", () => {
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
