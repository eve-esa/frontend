import { describe, expect, it } from "vitest";
import { shouldToastStreamError } from "./streamError";

describe("shouldToastStreamError", () => {
  it("toasts when the stream produced nothing", () => {
    expect(shouldToastStreamError("")).toBe(true);
  });

  it("toasts when the stream produced only whitespace (nothing visible)", () => {
    expect(shouldToastStreamError(" \n\t \n")).toBe(true);
  });

  it("suppresses the toast once a single visible character streamed", () => {
    expect(shouldToastStreamError("T")).toBe(false);
  });

  it("suppresses the toast for a longer partial answer", () => {
    expect(
      shouldToastStreamError("The wildfire perimeter grew by 12% overnight"),
    ).toBe(false);
  });
});
