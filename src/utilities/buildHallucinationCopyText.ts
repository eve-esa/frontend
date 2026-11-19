export type HallucinationCopyParts = {
  label: number | null;
  reason: string;
  rewrittenQuery: string;
  alternativeAnswer: string;
};

/**
 * Heading of the detector result. The backend labels 0 as factual and 1 as
 * hallucination; while no label has arrived yet (the reason is streaming) the
 * heading is neutral, so it never flips from a wrong verdict.
 */
export function hallucinationHeading(label: number | null): string {
  if (label === 1) return "Possible hallucination detected";
  if (label === 0) return "No hallucination detected";
  return "Checking the answer";
}

/**
 * Builds the text the hallucination "copy" button puts on the clipboard so it
 * matches what the panel actually shows. The old button copied only the
 * "Alternative answer", which the backend fills in *only* when a hallucination
 * is flagged (label === 1); for the common "no hallucination" result it was
 * empty, so the button copied an empty string while still flashing success.
 *
 * The sections mirror MessageFooter's rendered panel:
 *   - "<heading>: <reason>", the heading being "No hallucination detected" or
 *     "Possible hallucination detected" (see hallucinationHeading)
 *   - "Searched for: <rewrittenQuery>"      (only when a rewrite exists)
 *   - "Alternative answer:\n<answer>"        (only when flagged, matching the UI)
 *
 * Returns "" only when there is genuinely nothing on screen to copy.
 */
export function buildHallucinationCopyText({
  label,
  reason,
  rewrittenQuery,
  alternativeAnswer,
}: HallucinationCopyParts): string {
  const sections: string[] = [];

  const trimmedReason = reason.trim();
  if (label === 0 || label === 1) {
    const heading = hallucinationHeading(label);
    sections.push(trimmedReason ? `${heading}: ${trimmedReason}` : heading);
  } else if (trimmedReason) {
    sections.push(`${hallucinationHeading(null)}: ${trimmedReason}`);
  }

  const trimmedQuery = rewrittenQuery.trim();
  if (trimmedQuery) {
    sections.push(`Searched for: ${trimmedQuery}`);
  }

  // The panel only renders the alternative answer when a hallucination is
  // flagged, so the copy mirrors that same gate.
  const trimmedAlternative = alternativeAnswer.trim();
  if (label === 1 && trimmedAlternative) {
    sections.push(`Alternative answer:\n${trimmedAlternative}`);
  }

  return sections.join("\n\n");
}
