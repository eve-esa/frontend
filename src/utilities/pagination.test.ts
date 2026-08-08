import { describe, expect, it } from "vitest";
import { nextPageParam, nextPageParamAsString } from "./pagination";

const meta = (over: Partial<{ current_page: number; has_next: boolean; total_count: number; total_pages: number }> = {}) => ({
  meta: {
    current_page: 1,
    has_next: false,
    total_count: 0,
    total_pages: 0,
    ...over,
  },
});

describe("nextPageParam", () => {
  it("advances while the API says there is more", () => {
    expect(nextPageParam(meta({ current_page: 1, has_next: true, total_pages: 3 }))).toBe(2);
    expect(nextPageParam(meta({ current_page: 2, has_next: true, total_pages: 3 }))).toBe(3);
  });

  it("stops on the last page", () => {
    expect(nextPageParam(meta({ current_page: 3, has_next: false, total_pages: 3 }))).toBeUndefined();
  });

  it("stops on an empty list", () => {
    // The regression this exists for: the backend answers current_page 1 / total_pages 0, and a
    // `current_page !== total_pages` test held forever, asking for page 2, 3, 4… on a list with
    // nothing in it.
    expect(nextPageParam(meta({ current_page: 1, has_next: false, total_pages: 0 }))).toBeUndefined();
  });

  it("stops rather than throwing when a page never arrived", () => {
    // One failed request used to take down the whole route: every call site destructured
    // `{ meta: { … } }` straight off the page, so an undefined page threw a TypeError into
    // React Router's default error boundary.
    expect(nextPageParam(undefined)).toBeUndefined();
    expect(nextPageParam({} as { meta?: never })).toBeUndefined();
  });
});

describe("nextPageParamAsString", () => {
  it("returns the page as a string for the one query that pages by string", () => {
    expect(nextPageParamAsString(meta({ current_page: 1, has_next: true, total_pages: 2 }))).toBe("2");
  });

  it("returns undefined rather than the string \"undefined\"", () => {
    expect(nextPageParamAsString(meta({ has_next: false }))).toBeUndefined();
    expect(nextPageParamAsString(undefined)).toBeUndefined();
  });
});
