import { describe, expect, it } from "vitest";
import {
  monotonicStreamingOutput,
  selectStreamingCandidate,
} from "./streamingOutput";

describe("selectStreamingCandidate", () => {
  it("shows the full output once the typewriter has caught up", () => {
    expect(selectStreamingCandidate("hello", "hello", true)).toBe("hello");
  });

  it("shows the revealed prefix while the typewriter is behind", () => {
    expect(selectStreamingCandidate("hel", "hello world", true)).toBe("hel");
  });

  it("shows the full output for a persisted (non-streaming) message", () => {
    expect(selectStreamingCandidate("", "final answer", false)).toBe(
      "final answer",
    );
  });
});

describe("monotonicStreamingOutput", () => {
  it("grows normally when the candidate keeps advancing", () => {
    const a = monotonicStreamingOutput("hel", "hello", 0);
    expect(a).toEqual({ text: "hel", shownLength: 3 });
    const b = monotonicStreamingOutput("hell", "hello", a.shownLength);
    expect(b).toEqual({ text: "hell", shownLength: 4 });
  });

  it("holds the length steady instead of flipping backward when the candidate shrinks", () => {
    // Previous frame showed the full 11-char output; the queue drained and the
    // next delta made `smoothed` momentarily shorter. Without the clamp this
    // rendered "hello" (5 chars) and the tail vanished.
    const held = monotonicStreamingOutput("hello", "hello world!", 11);
    expect(held).toEqual({ text: "hello world", shownLength: 11 });
    expect(held.shownLength).toBeGreaterThanOrEqual(11);
  });

  it("widens to the full output when the typewriter catches up", () => {
    const r = monotonicStreamingOutput("hello world!", "hello world!", 11);
    expect(r).toEqual({ text: "hello world!", shownLength: 12 });
  });

  it("pulls the shown length down when the output shrinks (a new turn reuses the slot)", () => {
    // High-water mark of 100 from the previous turn must not wedge the new,
    // shorter output.
    const r = monotonicStreamingOutput("", "new", 100);
    expect(r).toEqual({ text: "new", shownLength: 3 });
  });
});
