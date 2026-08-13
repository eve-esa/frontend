import { describe, expect, it } from "vitest";
import {
  computeDrainStep,
  SMOOTH_STREAM_MAX_BURST,
} from "./smoothStreamDrain";

describe("computeDrainStep", () => {
  it("reveals about one character per frame at the normal typing pace", () => {
    // 100 cps over a 10ms frame == 1 char of budget.
    const { toAppend } = computeDrainStep({
      backlogLength: 4,
      budget: 0,
      elapsedMs: 10,
      ratePerSecond: 100,
      chunkSize: 1,
    });
    expect(toAppend).toBe(1);
  });

  it("never appends more than the per-frame burst ceiling, even with a big backlog", () => {
    const { toAppend } = computeDrainStep({
      backlogLength: 8000,
      budget: 0,
      elapsedMs: 20,
      ratePerSecond: 100,
      chunkSize: 1,
    });
    expect(toAppend).toBeLessThanOrEqual(SMOOTH_STREAM_MAX_BURST);
    expect(toAppend).toBe(SMOOTH_STREAM_MAX_BURST);
  });

  it("does not dump the whole backlog after a long gap (hidden tab / huge final chunk)", () => {
    // 60 seconds elapsed with a 10k backlog would, unclamped, append thousands
    // of characters in one frame and reparse a massive tree at once.
    const { toAppend, nextBudget } = computeDrainStep({
      backlogLength: 10000,
      budget: 0,
      elapsedMs: 60000,
      ratePerSecond: 100,
      chunkSize: 1,
    });
    expect(toAppend).toBe(SMOOTH_STREAM_MAX_BURST);
    // Credit is not banked past one burst, so the next frames drain steadily.
    expect(nextBudget).toBeLessThanOrEqual(SMOOTH_STREAM_MAX_BURST);
  });

  it("appends nothing when the queue is empty", () => {
    expect(
      computeDrainStep({
        backlogLength: 0,
        budget: 5,
        elapsedMs: 10,
        ratePerSecond: 100,
        chunkSize: 1,
      }),
    ).toEqual({ toAppend: 0, nextBudget: 5 });
  });

  it("drains a large backlog steadily over many frames, never in one append", () => {
    let budget = 0;
    let remaining = 4000;
    let frames = 0;
    while (remaining > 0 && frames < 10000) {
      const step = computeDrainStep({
        backlogLength: remaining,
        budget,
        elapsedMs: 10,
        ratePerSecond: 100,
        chunkSize: 1,
      });
      // The invariant that fixes the flicker: no single frame may append more
      // than the burst ceiling.
      expect(step.toAppend).toBeLessThanOrEqual(SMOOTH_STREAM_MAX_BURST);
      remaining -= step.toAppend;
      budget = step.nextBudget;
      frames += 1;
    }
    expect(remaining).toBe(0);
    // Many small frames, not one giant dump.
    expect(frames).toBeGreaterThan(4000 / SMOOTH_STREAM_MAX_BURST);
  });
});
