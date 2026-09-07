import { describe, expect, it } from "vitest";
import { shouldShowPreAnswerNotice } from "./preAnswerNotices";

describe("shouldShowPreAnswerNotice", () => {
  it("always shows requery, whatever the flag is", () => {
    expect(shouldShowPreAnswerNotice("requery", true)).toBe(true);
    expect(shouldShowPreAnswerNotice("requery", false)).toBe(true);
  });

  it("shows status only when the flag is on", () => {
    expect(shouldShowPreAnswerNotice("status", true)).toBe(true);
    expect(shouldShowPreAnswerNotice("status", false)).toBe(false);
  });

  it("shows nothing for any other event type", () => {
    expect(shouldShowPreAnswerNotice("token", true)).toBe(false);
    expect(shouldShowPreAnswerNotice("final", true)).toBe(false);
    expect(shouldShowPreAnswerNotice("tool_call", true)).toBe(false);
    expect(shouldShowPreAnswerNotice("error", true)).toBe(false);
    expect(shouldShowPreAnswerNotice(undefined, true)).toBe(false);
  });
});
