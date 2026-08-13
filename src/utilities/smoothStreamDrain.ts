// Per-frame ceiling for the smooth-stream drain. Every appended character
// forces SmartText to reparse the whole markdown/KaTeX tree, so a large backlog
// must drain over several frames rather than one giant append that janks the
// render. At the hook's ~100 ticks/second this still reveals up to ~3200 chars
// per second, so even long answers finish promptly.
export const SMOOTH_STREAM_MAX_BURST = 32;

// Upper bound on the adaptive catch-up rate (chars/second). A huge backlog
// (fast endpoint, hidden tab, one big final chunk) accelerates past the typing
// rate but can't drive the budget arbitrarily high.
export const SMOOTH_STREAM_MAX_CATCHUP_RATE = 4000;

/**
 * One tick of the smooth-stream reveal, extracted from useSmoothStream so the
 * burst caps are unit-testable. Given the queued backlog, the carried-over
 * character budget and the time elapsed since the last tick, it returns how many
 * characters to append this frame and the budget to carry forward.
 *
 * The old formula let `effectiveRate = max(rate, backlog/2)` and
 * `maxBurst = max(chunkSize*50, 200, ceil(backlog/4))` both grow without bound,
 * so a big backlog appended hundreds of characters in a single frame and the
 * render spiked. Both are now clamped.
 */
export function computeDrainStep(params: {
  backlogLength: number;
  budget: number;
  elapsedMs: number;
  ratePerSecond: number;
  chunkSize: number;
}): { toAppend: number; nextBudget: number } {
  const { backlogLength, budget, elapsedMs, ratePerSecond, chunkSize } = params;
  if (backlogLength <= 0) return { toAppend: 0, nextBudget: budget };

  const effectiveRate = Math.min(
    Math.max(ratePerSecond, backlogLength / 2),
    SMOOTH_STREAM_MAX_CATCHUP_RATE,
  );
  const maxBurst = Math.max(chunkSize, SMOOTH_STREAM_MAX_BURST);
  // Never bank more than a single burst of credit, so a delayed or coalesced
  // frame drains at the same steady ceiling instead of dumping everything at
  // once when it finally runs.
  const nextBudget = Math.min(
    budget + (effectiveRate * elapsedMs) / 1000,
    maxBurst,
  );
  const toAppend = Math.min(backlogLength, Math.floor(nextBudget), maxBurst);
  return { toAppend, nextBudget: nextBudget - toAppend };
}
