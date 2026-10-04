import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_RETRY_AFTER_S,
  clearBusyNotice,
  getBusyNotice,
  overloadedRetryAfter,
  parseRetryAfterSeconds,
  setBusyNotice,
  takeBusyDraft,
} from "./serviceBusy";

const OVERLOADED_BODY = {
  detail: {
    code: "overloaded",
    message: "The service is busy, retry in a few seconds",
  },
};

const refusal = (data: unknown, headers: unknown = {}, status = 429) => ({
  response: { status, data, headers },
});

afterEach(() => clearBusyNotice());

describe("overloadedRetryAfter", () => {
  it("reads the parsed body of the blocking request", () => {
    expect(
      overloadedRetryAfter(refusal(OVERLOADED_BODY, { "retry-after": "4" })),
    ).toBe(4);
  });

  it("reads the raw JSON string of the streaming request", () => {
    expect(
      overloadedRetryAfter(
        refusal(JSON.stringify(OVERLOADED_BODY), { "retry-after": "7" }),
      ),
    ).toBe(7);
  });

  it("reads Retry-After through an AxiosHeaders-like getter", () => {
    const headers = { get: (name: string) => (name === "retry-after" ? "5" : null) };
    expect(overloadedRetryAfter(refusal(OVERLOADED_BODY, headers))).toBe(5);
  });

  it("falls back to 10 s without a usable Retry-After", () => {
    expect(overloadedRetryAfter(refusal(OVERLOADED_BODY))).toBe(
      DEFAULT_RETRY_AFTER_S,
    );
    expect(DEFAULT_RETRY_AFTER_S).toBe(10);
  });

  it("ignores the token-budget 429 even though it carries Retry-After", () => {
    expect(
      overloadedRetryAfter(
        refusal(
          JSON.stringify({ detail: "Token limit exceeded for this period" }),
          { "retry-after": "3600" },
        ),
      ),
    ).toBeNull();
  });

  it("ignores another status with the same code", () => {
    expect(overloadedRetryAfter(refusal(OVERLOADED_BODY, {}, 503))).toBeNull();
  });
});

describe("parseRetryAfterSeconds", () => {
  it("rounds up, caps at 60 and rejects dates and negatives", () => {
    expect(parseRetryAfterSeconds("2.2")).toBe(3);
    expect(parseRetryAfterSeconds("600")).toBe(60);
    expect(parseRetryAfterSeconds("Wed, 21 Oct 2026 07:28:00 GMT")).toBe(10);
    expect(parseRetryAfterSeconds("-1")).toBe(10);
    expect(parseRetryAfterSeconds(undefined)).toBe(10);
  });
});

describe("takeBusyDraft", () => {
  it("hands the text over once and keeps the final notice", () => {
    setBusyNotice({ conversationId: "c1", phase: "stopped", draft: "hello" });
    expect(takeBusyDraft("other")).toBeNull();
    expect(takeBusyDraft("c1")).toBe("hello");
    expect(takeBusyDraft("c1")).toBeNull();
    expect(getBusyNotice()).toMatchObject({ phase: "stopped" });
  });

  it("clears a canceled wait once the text is taken", () => {
    setBusyNotice({ conversationId: "c1", phase: "canceled", draft: "hi" });
    expect(takeBusyDraft("c1")).toBe("hi");
    expect(getBusyNotice()).toBeNull();
  });
});
