import type { Document } from "@/types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Keep only entries that look like a retrieval Document (object with a
 * `payload` object or a `collection_name` string). Older persisted agentic
 * messages hold {tool, content} entries that must not render as sources.
 */
export const NO_SOURCE_TEXT = "No text";

/**
 * A field that can actually be rendered as text: a non-empty string, or a list
 * of strings joined by newline. Anything else is undefined, so the chain below
 * keeps looking.
 *
 * The types say these fields are strings. Persisted documents disagree: a Wiley
 * source can carry an object or a list in payload.content, which used to travel
 * all the way to stripArtifactMetadata and take the whole Sources panel down on
 * `text.split`.
 */
const asText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value.trim() ? value : undefined;
  }
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "string")
  ) {
    const joined = (value as string[]).join("\n");
    return joined.trim() ? joined : undefined;
  }
  return undefined;
};

/**
 * Text to render for a source. Backend versions differ in where the chunk
 * body lives: agentic messages persist payload.text (sometimes
 * payload.content), classic ones the top-level text. content wins, then
 * payload.text, then text; anything missing, blank or not renderable falls
 * back to "No text".
 */
export const getSourceText = (source: Document | null | undefined): string =>
  asText(source?.payload?.content) ??
  asText(source?.payload?.text) ??
  asText(source?.text) ??
  NO_SOURCE_TEXT;

export const getRenderableDocuments = (documents: unknown): Document[] => {
  if (!Array.isArray(documents)) return [];
  return documents.filter((entry): entry is Document => {
    if (!isRecord(entry)) return false;
    return isRecord(entry.payload) || typeof entry.collection_name === "string";
  });
};
