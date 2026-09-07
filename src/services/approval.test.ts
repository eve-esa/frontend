import { describe, expect, it } from "vitest";
import { isPendingApproval } from "./approval";

const pendingApprovalError = {
  response: {
    status: 403,
    data: { detail: { code: "pending_approval", message: "nope" } },
  },
};

describe("isPendingApproval", () => {
  it("is true for a 403 with the pending_approval code", () => {
    expect(isPendingApproval(pendingApprovalError)).toBe(true);
  });

  it("is false for a bare 403 with no detail code", () => {
    expect(isPendingApproval({ response: { status: 403, data: {} } })).toBe(
      false
    );
  });

  it("is false for a 403 with an unrelated code", () => {
    expect(
      isPendingApproval({
        response: { status: 403, data: { detail: { code: "forbidden" } } },
      })
    ).toBe(false);
  });

  it("is false for a 401", () => {
    expect(
      isPendingApproval({
        response: {
          status: 401,
          data: { detail: { code: "pending_approval" } },
        },
      })
    ).toBe(false);
  });

  it("is false for a network error with no response", () => {
    expect(isPendingApproval(new Error("Network Error"))).toBe(false);
  });

  it("is false for undefined or null", () => {
    expect(isPendingApproval(undefined)).toBe(false);
    expect(isPendingApproval(null)).toBe(false);
  });
});
