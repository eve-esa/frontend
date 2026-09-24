import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_REMEMBERED_CONVERSATIONS,
  clearLastTraces,
  getLastTraceId,
  isTraceId,
  rememberTraceFromFinalEvent,
  rememberTraceId,
} from "./lastTrace";

const TRACE_A = "0af7651916cd43dd8448eb211c80319c";
const TRACE_B = "4bf92f3577b34da6a3ce929d0e0e4736";

beforeEach(() => {
  clearLastTraces();
});

describe("isTraceId", () => {
  it("accepts 32 lowercase hex characters", () => {
    expect(isTraceId(TRACE_A)).toBe(true);
  });

  it.each([
    ["null", null],
    ["a number", 42],
    ["too short", "abc"],
    ["upper case", TRACE_A.toUpperCase()],
    ["the all zero id", "0".repeat(32)],
  ])("rejects %s", (_label, value) => {
    expect(isTraceId(value)).toBe(false);
  });
});

describe("rememberTraceId", () => {
  it("keeps the last trace per conversation", () => {
    rememberTraceId("conv-1", TRACE_A);
    rememberTraceId("conv-2", TRACE_B);
    expect(getLastTraceId("conv-1")).toBe(TRACE_A);
    expect(getLastTraceId("conv-2")).toBe(TRACE_B);
  });

  it("replaces an older trace of the same conversation", () => {
    rememberTraceId("conv-1", TRACE_A);
    rememberTraceId("conv-1", TRACE_B);
    expect(getLastTraceId("conv-1")).toBe(TRACE_B);
  });

  it("returns the latest trace of any conversation without an id", () => {
    rememberTraceId("conv-1", TRACE_A);
    rememberTraceId("conv-2", TRACE_B);
    expect(getLastTraceId()).toBe(TRACE_B);
  });

  it("keeps the previous value when the backend sends no trace id", () => {
    rememberTraceId("conv-1", TRACE_A);
    rememberTraceId("conv-1", null);
    rememberTraceId("conv-1", "not-a-trace");
    expect(getLastTraceId("conv-1")).toBe(TRACE_A);
  });

  it("is unknown for a conversation it never saw", () => {
    expect(getLastTraceId("conv-x")).toBeUndefined();
  });

  it("evicts the oldest conversation beyond the bound", () => {
    for (let i = 0; i <= MAX_REMEMBERED_CONVERSATIONS; i++) {
      rememberTraceId(`conv-${i}`, TRACE_A);
    }
    expect(getLastTraceId("conv-0")).toBeUndefined();
    expect(getLastTraceId(`conv-${MAX_REMEMBERED_CONVERSATIONS}`)).toBe(
      TRACE_A,
    );
  });
});

describe("rememberTraceFromFinalEvent", () => {
  it("reads trace_id from the final event", () => {
    rememberTraceFromFinalEvent("conv-1", {
      type: "final",
      answer: "hello",
      trace_id: TRACE_A,
    });
    expect(getLastTraceId("conv-1")).toBe(TRACE_A);
  });

  it("leaves answer and artifact_ids on the event untouched", () => {
    const event = {
      type: "final",
      answer: "hello",
      artifact_ids: ["a1", "a2"],
      trace_id: TRACE_A,
    };
    const before = structuredClone(event);
    rememberTraceFromFinalEvent("conv-1", event);
    expect(event).toEqual(before);
  });

  it("ignores a final event without trace_id", () => {
    rememberTraceFromFinalEvent("conv-1", { type: "final", answer: "hello" });
    expect(getLastTraceId("conv-1")).toBeUndefined();
  });

  it("ignores something that is not an event", () => {
    rememberTraceFromFinalEvent("conv-1", "final");
    rememberTraceFromFinalEvent("conv-1", null);
    expect(getLastTraceId()).toBeUndefined();
  });
});
