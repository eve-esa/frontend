import { describe, expect, it, vi } from "vitest";
import { signedOutCopy } from "./signedOutCopy";

vi.mock("@/services/oidc", () => ({}));

describe("signedOutCopy", () => {
  it("says the session expired when the refresh token was refused", () => {
    expect(signedOutCopy("expired").message).toBe(
      "Your session has expired. Sign in again."
    );
  });

  it("says another tab signed out after a sign-out", () => {
    expect(signedOutCopy("signed-out").message).toBe(
      "You signed out of EVE in another tab or window."
    );
  });
});
