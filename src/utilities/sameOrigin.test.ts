import { describe, expect, it } from "vitest";
import { isTrustedRequestUrl, resolveApiOrigin } from "./sameOrigin";

const PAGE_ORIGIN = "https://app.example.com";
const API_ORIGIN = "https://api.example.com";

describe("resolveApiOrigin", () => {
  it("resolves the origin of an absolute VITE_API_URL", () => {
    expect(resolveApiOrigin("https://api.example.com/v1", PAGE_ORIGIN)).toBe(
      API_ORIGIN,
    );
  });

  it("falls back to the page origin when VITE_API_URL is unset", () => {
    expect(resolveApiOrigin(undefined, PAGE_ORIGIN)).toBe(PAGE_ORIGIN);
  });

  it("falls back to the page origin when VITE_API_URL is unparseable", () => {
    expect(resolveApiOrigin("http://", PAGE_ORIGIN)).toBe(PAGE_ORIGIN);
  });
});

describe("isTrustedRequestUrl", () => {
  it("trusts a relative path resolved against baseUrl", () => {
    expect(
      isTrustedRequestUrl("/conversations/1", API_ORIGIN, PAGE_ORIGIN, API_ORIGIN),
    ).toBe(true);
  });

  it("trusts a relative path resolved against the page origin when baseUrl is unset", () => {
    expect(
      isTrustedRequestUrl("/foo", undefined, PAGE_ORIGIN, API_ORIGIN),
    ).toBe(true);
  });

  it("trusts an absolute URL on the page origin", () => {
    expect(
      isTrustedRequestUrl(
        `${PAGE_ORIGIN}/foo`,
        API_ORIGIN,
        PAGE_ORIGIN,
        API_ORIGIN,
      ),
    ).toBe(true);
  });

  it("trusts an absolute URL on the API origin", () => {
    expect(
      isTrustedRequestUrl(
        `${API_ORIGIN}/foo`,
        API_ORIGIN,
        PAGE_ORIGIN,
        API_ORIGIN,
      ),
    ).toBe(true);
  });

  it("rejects a cross-origin absolute URL", () => {
    expect(
      isTrustedRequestUrl(
        "https://attacker.example/x",
        API_ORIGIN,
        PAGE_ORIGIN,
        API_ORIGIN,
      ),
    ).toBe(false);
  });

  it("rejects a protocol-relative URL", () => {
    expect(
      isTrustedRequestUrl("//attacker.example/x", API_ORIGIN, PAGE_ORIGIN, API_ORIGIN),
    ).toBe(false);
  });

  it("rejects backslash variants that browsers normalize to protocol-relative", () => {
    expect(
      isTrustedRequestUrl("/\\attacker.example/x", API_ORIGIN, PAGE_ORIGIN, API_ORIGIN),
    ).toBe(false);
    expect(
      isTrustedRequestUrl("\\/attacker.example/x", API_ORIGIN, PAGE_ORIGIN, API_ORIGIN),
    ).toBe(false);
    expect(
      isTrustedRequestUrl("\\\\attacker.example/x", API_ORIGIN, PAGE_ORIGIN, API_ORIGIN),
    ).toBe(false);
  });

  it("rejects non-http(s) protocols like javascript: or data:", () => {
    expect(
      isTrustedRequestUrl(
        "javascript:alert(1)",
        API_ORIGIN,
        PAGE_ORIGIN,
        API_ORIGIN,
      ),
    ).toBe(false);
    expect(
      isTrustedRequestUrl("data:text/plain,hi", API_ORIGIN, PAGE_ORIGIN, API_ORIGIN),
    ).toBe(false);
  });

  it("rejects an unparseable target", () => {
    expect(
      isTrustedRequestUrl("http://", API_ORIGIN, PAGE_ORIGIN, API_ORIGIN),
    ).toBe(false);
  });
});
