import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RETRY_AFTER_S,
  busyCountdownCopy,
  busyFinalCopy,
  clearBusyNotice,
  getBusyNotice,
  isServiceBusyError,
  busyRetryAfter,
  parseRetryAfterSeconds,
  setBusyNotice,
  takeBusyDraft,
  withBusyRetry,
} from "./serviceBusy";

const OVERLOADED_BODY = {
  detail: {
    code: "overloaded",
    message: "The service is busy, retry in a few seconds",
  },
};

const RATE_LIMITED_BODY = {
  detail: {
    code: "rate_limited",
    message: "Too many requests, retry in a few seconds",
  },
};

const refusal = (data: unknown, headers: unknown = {}, status = 429) => ({
  response: { status, data, headers },
});

afterEach(() => {
  clearBusyNotice();
  vi.useRealTimers();
});

describe("busyRetryAfter", () => {
  it("reads the parsed body of the blocking request", () => {
    expect(
      busyRetryAfter(refusal(OVERLOADED_BODY, { "retry-after": "4" })),
    ).toBe(4);
  });

  it("reads the raw JSON string of the streaming request", () => {
    expect(
      busyRetryAfter(
        refusal(JSON.stringify(OVERLOADED_BODY), { "retry-after": "7" }),
      ),
    ).toBe(7);
  });

  it("reads Retry-After through an AxiosHeaders-like getter", () => {
    const headers = { get: (name: string) => (name === "retry-after" ? "5" : null) };
    expect(busyRetryAfter(refusal(OVERLOADED_BODY, headers))).toBe(5);
  });

  it("falls back to 10 s without a usable Retry-After", () => {
    expect(busyRetryAfter(refusal(OVERLOADED_BODY))).toBe(
      DEFAULT_RETRY_AFTER_S,
    );
    expect(DEFAULT_RETRY_AFTER_S).toBe(10);
  });

  it("ignores the token-budget 429 even though it carries Retry-After", () => {
    expect(
      busyRetryAfter(
        refusal(
          JSON.stringify({ detail: "Token limit exceeded for this period" }),
          { "retry-after": "3600" },
        ),
      ),
    ).toBeNull();
  });

  it("ignores another status with the same code", () => {
    expect(busyRetryAfter(refusal(OVERLOADED_BODY, {}, 503))).toBeNull();
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
  it("hands the draft over once and keeps the final notice", () => {
    const attachments = [
      { id: "a1", url: "/a1", filename: "map.png", content_type: "image/png" },
    ];
    setBusyNotice({
      conversationId: "c1",
      phase: "stopped",
      draft: { text: "hello", attachments },
    });
    expect(takeBusyDraft("other")).toBeNull();
    expect(takeBusyDraft("c1")).toEqual({ text: "hello", attachments });
    expect(takeBusyDraft("c1")).toBeNull();
    expect(getBusyNotice("c1")).toMatchObject({ phase: "stopped" });
  });

  it("clears a canceled wait once the draft is taken", () => {
    setBusyNotice({ conversationId: "c1", phase: "canceled", draft: { text: "hi" } });
    expect(takeBusyDraft("c1")).toEqual({ text: "hi" });
    expect(getBusyNotice("c1")).toBeNull();
  });

  it("keeps one notice per conversation", () => {
    setBusyNotice({ conversationId: "a", phase: "waiting", secondsLeft: 4 });
    setBusyNotice({ conversationId: "b", phase: "waiting", secondsLeft: 9 });
    expect(getBusyNotice("a")).toMatchObject({ secondsLeft: 4 });
    clearBusyNotice("b");
    expect(getBusyNotice("a")).toMatchObject({ secondsLeft: 4 });
    expect(getBusyNotice("b")).toBeNull();
  });
});

describe("withBusyRetry on a rate limited 429", () => {
  it("waits the Retry-After seconds and retries once", async () => {
    vi.useFakeTimers();
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(
        refusal(JSON.stringify(RATE_LIMITED_BODY), { "retry-after": "7" }),
      )
      .mockResolvedValueOnce("ok");

    const run = withBusyRetry("c1", attempt);
    await vi.advanceTimersByTimeAsync(0);
    expect(getBusyNotice("c1")).toEqual({
      conversationId: "c1",
      phase: "waiting",
      secondsLeft: 7,
      reason: "rate_limited",
    });

    await vi.advanceTimersByTimeAsync(6000);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(getBusyNotice("c1")).toMatchObject({ secondsLeft: 1 });

    await vi.advanceTimersByTimeAsync(1000);
    await expect(run).resolves.toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(getBusyNotice("c1")).toBeNull();
  });

  it("uses the default delay without a Retry-After header", async () => {
    vi.useFakeTimers();
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(refusal(RATE_LIMITED_BODY))
      .mockResolvedValueOnce("ok");

    const run = withBusyRetry("c1", attempt);
    await vi.advanceTimersByTimeAsync(0);
    expect(getBusyNotice("c1")).toMatchObject({
      secondsLeft: DEFAULT_RETRY_AFTER_S,
      reason: "rate_limited",
    });

    await vi.advanceTimersByTimeAsync((DEFAULT_RETRY_AFTER_S - 1) * 1000);
    expect(attempt).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(run).resolves.toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("gives up at once when Retry-After exceeds 60 s", async () => {
    vi.useFakeTimers();
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(refusal(RATE_LIMITED_BODY, { "retry-after": "3600" }))
      .mockResolvedValueOnce("ok");

    const error = await withBusyRetry("c1", attempt).catch((e: unknown) => e);
    expect(isServiceBusyError(error)).toBe(true);
    expect(error).toMatchObject({ canceled: false, reason: "rate_limited" });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(getBusyNotice("c1")).toBeNull();
  });

  it("still caps an overload Retry-After at 60 s and retries", async () => {
    vi.useFakeTimers();
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(refusal(OVERLOADED_BODY, { "retry-after": "3600" }))
      .mockResolvedValueOnce("ok");

    const run = withBusyRetry("c1", attempt);
    await vi.advanceTimersByTimeAsync(0);
    expect(getBusyNotice("c1")).toMatchObject({ secondsLeft: 60 });
    await vi.advanceTimersByTimeAsync(60000);
    await expect(run).resolves.toBe("ok");
  });

  it("gives up after a second refusal and keeps the reason", async () => {
    vi.useFakeTimers();
    const attempt = vi
      .fn()
      .mockRejectedValue(refusal(RATE_LIMITED_BODY, { "retry-after": "1" }));

    const run = withBusyRetry("c1", attempt).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(1000);
    const error = await run;
    expect(isServiceBusyError(error)).toBe(true);
    expect(error).toMatchObject({ canceled: false, reason: "rate_limited" });
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 429 with another code", async () => {
    vi.useFakeTimers();
    const other = refusal(
      { detail: { code: "token_budget", message: "Token limit exceeded" } },
      { "retry-after": "5" },
    );
    const attempt = vi.fn().mockRejectedValue(other);

    await expect(withBusyRetry("c1", attempt)).rejects.toBe(other);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(getBusyNotice("c1")).toBeNull();
  });
});

describe("busy copy", () => {
  it("blames the pace of requests on a rate limit", () => {
    expect(busyCountdownCopy(7, "rate_limited")).toBe(
      "You are sending requests too fast. Retrying in 7 s",
    );
    expect(busyCountdownCopy(7)).toBe("EVE is busy right now. Retrying in 7 s");
    expect(busyFinalCopy("rate_limited")).toBe(
      "Still too many requests. Please try again in a moment",
    );
    expect(busyFinalCopy()).toBe("Still busy. Please try again in a moment");
  });
});
