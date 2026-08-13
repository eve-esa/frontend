export type HallucinationCopyParts = {
  label: number | null;
  reason: string;
  rewrittenQuery: string;
  alternativeAnswer: string;
};

/**
 * Builds the text the hallucination "copy" button puts on the clipboard so it
 * matches what the panel actually shows. The old button copied only the
 * "Alternative answer", which the backend fills in *only* when a hallucination
 * is flagged (label === 1); for the common "no hallucination" result it was
 * empty, so the button copied an empty string while still flashing success.
 *
 * The sections mirror MessageFooter's rendered panel:
 *   - "Possible hallucination detected: <Yes|No> — <reason>"
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

  const verdict = label === 1 ? "Yes" : label === 0 ? "No" : "";
  const trimmedReason = reason.trim();
  if (verdict || trimmedReason) {
    const detail = [verdict, trimmedReason].filter(Boolean).join(" — ");
    sections.push(`Possible hallucination detected: ${detail}`);
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
