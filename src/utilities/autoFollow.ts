// Follow-the-stream tracker for the chat autoscroll. A plain closure, not
// React state, because the autoscroll effect fires on every smooth-stream
// frame (~100/s) and must read the CURRENT value synchronously: a setState
// here is stale by one render, which is exactly the race that made the view
// fight the user's scroll-up.
//
// The programmatic flag exists because our own scrollTo fires the container's
// scroll handler too; without it, the "we are at the bottom" measurement of
// our own scroll would re-latch follow=true right over the user's intent.

export type AutoFollow = {
  // Arms a one-shot flag meaning "the next scroll event is ours, ignore it".
  markProgrammatic: () => void;
  onScroll: (distanceFromBottom: number) => void;
  onWheel: (deltaY: number) => void;
  shouldFollow: () => boolean;
};

export function createAutoFollow(threshold: number): AutoFollow {
  let follow = true;
  let programmatic = false;

  return {
    markProgrammatic() {
      programmatic = true;
    },
    onScroll(distanceFromBottom: number) {
      if (programmatic) {
        programmatic = false;
        return;
      }
      follow = distanceFromBottom <= threshold;
    },
    onWheel(deltaY: number) {
      // Wheel-up is user intent to leave the bottom, and it arrives before
      // the position moves (also covers trackpad momentum), so disengage
      // immediately. Wheel-down never re-engages by itself: re-engagement is
      // the scroll position's job.
      if (deltaY < 0) {
        follow = false;
      }
    },
    shouldFollow() {
      return follow;
    },
  };
}
