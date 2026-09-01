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
 * Text to render for a source. Backend versions differ in where the chunk
 * body lives: agentic messages persist payload.text (sometimes
 * payload.content), classic ones the top-level text. content wins, then
 * payload.text, then text; anything missing falls back to "No text".
 */
export const getSourceText = (source: Document | null | undefined): string =>
  source?.payload?.content ?? source?.payload?.text ?? source?.text ?? NO_SOURCE_TEXT;

export const getRenderableDocuments = (documents: unknown): Document[] => {
  if (!Array.isArray(documents)) return [];
  return documents.filter((entry): entry is Document => {
    if (!isRecord(entry)) return false;
    return isRecord(entry.payload) || typeof entry.collection_name === "string";
  });
};
