import { describe, expect, it, vi } from "vitest";
import {
  CONSOLE_RING_SIZE,
  RingBuffer,
  toConsoleEntry,
} from "./consoleRing";

describe("RingBuffer", () => {
  it("keeps the newest entries, oldest first", () => {
    const ring = new RingBuffer<number>(3);
    [1, 2, 3, 4, 5].forEach((n) => ring.push(n));
    expect(ring.snapshot()).toEqual([3, 4, 5]);
  });

  it("returns a copy", () => {
    const ring = new RingBuffer<number>(3);
    ring.push(1);
    ring.snapshot().push(99);
    expect(ring.snapshot()).toEqual([1]);
  });

  it("is sized for 20 console entries", () => {
    expect(CONSOLE_RING_SIZE).toBe(20);
  });
});

describe("toConsoleEntry", () => {
  it("joins, redacts and timestamps the arguments", () => {
    const entry = toConsoleEntry(
      "error",
      ["key", "eve_" + "a".repeat(64), { email: "a@b.io" }, new TypeError("x")],
      new Date("2026-09-24T10:00:00Z"),
    );
    expect(entry).toEqual({
      level: "error",
      message: 'key [REDACTED] {"email":"[REDACTED_EMAIL]"} TypeError: x',
      at: "2026-09-24T10:00:00.000Z",
    });
  });

  it("clips long messages and survives circular objects", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => toConsoleEntry("warn", [circular])).not.toThrow();
    expect(toConsoleEntry("warn", ["x".repeat(5000)]).message).toHaveLength(
      2000,
    );
  });
});

describe("installConsoleRing", () => {
  it("still calls the original console method first", async () => {
    vi.resetModules();
    const { installConsoleRing, getRecentConsoleErrors } = await import(
      "./consoleRing"
    );
    const original = vi.fn();
    const target = { error: original, warn: vi.fn() } as unknown as Console;
    installConsoleRing(target);
    target.error("hello", 1);
    expect(original).toHaveBeenCalledWith("hello", 1);
    expect(getRecentConsoleErrors().map((e) => e.message)).toEqual([
      "hello 1",
    ]);
  });
});
