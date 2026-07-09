/**
 * While the assistant output is still streaming, the final characters may hold a
 * half-typed image token (e.g. `![alt](/artifacts/ab`). Rendering it would flash raw
 * markdown and trigger a fetch of an incomplete URL. This removes a trailing image
 * token that hasn't been fully closed yet, leaving any earlier complete images and
 * text untouched. Apply it only to the actively-streaming message.
 */
export const stripIncompleteImage = (text: string): string => {
  const idx = text.lastIndexOf("![");
  if (idx === -1) return text;

  const suffix = text.slice(idx);

  // A complete image token at the very end: `![alt](url)`.
  if (/^!\[[^\]]*\]\([^)]*\)$/.test(suffix)) return text;
  // A complete image token followed by more text (so it isn't the trailing bit).
  if (/^!\[[^\]]*\]\([^)]*\)./.test(suffix)) return text;

  // Otherwise the trailing token is still being streamed — drop it.
  return text.slice(0, idx);
};
