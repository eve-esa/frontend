/**
 * Picks which string the streaming bubble should show this frame: the fully
 * received `output` once the typewriter has caught up (or the message is no
 * longer the streaming target), otherwise the partially-revealed `smoothed`
 * prefix. Ported verbatim from Message.tsx's original inline expression so the
 * selection stays identical; the monotonic clamp below wraps it.
 */
export function selectStreamingCandidate(
  smoothed: string,
  output: string,
  isStreamingTarget: boolean,
): string {
  if (smoothed.length >= output.length) return output;
  if (smoothed.length > 0) return smoothed;
  if (!isStreamingTarget && output) return output;
  return smoothed;
}

/**
 * Keeps the streamed answer monotonic: it never shows fewer characters than the
 * previous frame. `smoothed` (the typewriter prefix) and `output` (the full text
 * received so far) are both prefixes of the same growing answer, so when the
 * typewriter queue momentarily empties and the candidate would shrink, we hold
 * the length steady by slicing the fuller `output` instead of flipping back to
 * the shorter string. That backward flip is what made the tail characters
 * appear, vanish, and re-type during fast streaming.
 *
 * When `output` itself shrinks (a brand-new turn reuses the slot) the min-clamp
 * pulls the shown length back down, so a stale high-water mark can't wedge.
 */
export function monotonicStreamingOutput(
  candidate: string,
  output: string,
  previousShownLength: number,
): { text: string; shownLength: number } {
  const targetLength = Math.min(
    output.length,
    Math.max(candidate.length, previousShownLength),
  );
  const text =
    candidate.length >= targetLength
      ? candidate
      : output.slice(0, targetLength);
  return { text, shownLength: text.length };
}
