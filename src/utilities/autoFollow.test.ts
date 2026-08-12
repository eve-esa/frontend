import { describe, expect, it } from "vitest";
import { createAutoFollow } from "./autoFollow";

describe("createAutoFollow", () => {
  it("starts following; scrolling away disengages, back to bottom re-engages", () => {
    const follow = createAutoFollow(20);
    expect(follow.shouldFollow()).toBe(true);

    follow.onScroll(500);
    expect(follow.shouldFollow()).toBe(false);

    follow.onScroll(0);
    expect(follow.shouldFollow()).toBe(true);

    // The threshold is inclusive: 20px still counts as "near bottom".
    follow.onScroll(21);
    expect(follow.shouldFollow()).toBe(false);
    follow.onScroll(20);
    expect(follow.shouldFollow()).toBe(true);
  });

  it("never lets a programmatic scroll re-latch a disengaged state", () => {
    const follow = createAutoFollow(20);
    follow.onScroll(500); // user scrolled up
    follow.markProgrammatic();
    follow.onScroll(0); // our own scrollTo landing at the bottom
    expect(follow.shouldFollow()).toBe(false);
  });

  it("disengages on wheel-up before the position moves; wheel-down never re-engages", () => {
    const follow = createAutoFollow(20);
    // Still at the bottom (distance 0) and following: wheel-up alone wins.
    follow.onWheel(-1);
    expect(follow.shouldFollow()).toBe(false);

    follow.onWheel(1);
    expect(follow.shouldFollow()).toBe(false);
  });

  it("keeps the user's disengage across a streaming interleave, then a real return re-engages", () => {
    const follow = createAutoFollow(20);

    // Streaming while followed: our own scroll event is consumed silently.
    follow.markProgrammatic();
    follow.onScroll(0);
    expect(follow.shouldFollow()).toBe(true);

    // The user scrolls up: disengage sticks (no arm outstanding, so the
    // autoscroll effect stops calling markProgrammatic from here on).
    follow.onScroll(300);
    expect(follow.shouldFollow()).toBe(false);

    // A real user scroll back to the bottom MUST re-engage.
    follow.onScroll(0);
    expect(follow.shouldFollow()).toBe(true);
  });

  it("arms for exactly one scroll event", () => {
    const follow = createAutoFollow(20);
    follow.onScroll(500);
    expect(follow.shouldFollow()).toBe(false);

    follow.markProgrammatic();
    follow.onScroll(0); // consumed: no state change
    expect(follow.shouldFollow()).toBe(false);
    follow.onScroll(0); // real event: re-engages
    expect(follow.shouldFollow()).toBe(true);
  });
});
