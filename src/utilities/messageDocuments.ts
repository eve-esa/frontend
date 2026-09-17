import type { Document } from "@/types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Keep only entries that look like a retrieval Document (object with a
 * `payload` object or a `collection_name` string). Older persisted agentic
 * messages hold {tool, content} entries that must not render as sources.
 */
export const NO_SOURCE_TEXT = "No text";
const PLACEHOLDER_TITLE = "Title not available";

const CHUNK_TEXT_KEYS = [
  "text",
  "content",
  "document",
  "chunk",
  "passage",
  "snippet",
  "page_content",
] as const;

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

const coerceJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

type WileyEnvelope = Record<string, unknown> & { results: unknown[] };

/**
 * eve_retrieval stores Wiley MCP output as a Document whose `text` is the
 * Scholar Gateway envelope `{success, query, count, results}` instead of a
 * passage. Classic RAG already unwraps that envelope (see get_mcp_context in
 * eve-backend). Detect it here so the Sources panel can do the same.
 *
 * @see https://docs.scholargateway.ai/
 */
const isWileyEnvelope = (value: unknown): value is WileyEnvelope => {
  if (!isRecord(value) || !Array.isArray(value.results) || value.results.length === 0) {
    return false;
  }
  if (
    value.success === true ||
    typeof value.query === "string" ||
    typeof value.count === "number"
  ) {
    return true;
  }
  return value.results.some((item) => {
    if (!isRecord(item)) return false;
    if (typeof item.chunk_index === "number") return true;
    const metadata = item.metadata;
    return isRecord(metadata) && isRecord(metadata.additionalMetadata);
  });
};

const envelopeFrom = (value: unknown): WileyEnvelope | undefined => {
  const parsed = coerceJson(value);
  return isWileyEnvelope(parsed) ? parsed : undefined;
};

/** Renderable passage, not a Scholar Gateway envelope object/JSON string. */
const asPassage = (value: unknown): string | undefined => {
  if (envelopeFrom(value)) return undefined;
  return asText(value);
};

const chunkText = (result: unknown): string | undefined => {
  if (!isRecord(result)) return undefined;
  for (const key of CHUNK_TEXT_KEYS) {
    const text = asPassage(result[key]);
    if (text) return text;
  }
  return undefined;
};

const additionalMetadataOf = (
  result: Record<string, unknown>,
): Record<string, unknown> => {
  const metadata = isRecord(result.metadata) ? result.metadata : {};
  return isRecord(metadata.additionalMetadata) ? metadata.additionalMetadata : {};
};

const normalizeArticleUrl = (url: string): string => {
  const trimmed = url.trim();
  const doi = trimmed.match(/(?:doi\.org\/|dx\.doi\.org\/)(.+)$/i);
  if (doi?.[1]) return `doi:${doi[1].replace(/\/+$/, "").toLowerCase()}`;
  return trimmed.replace(/\/+$/, "").toLowerCase();
};

const envelopeFingerprint = (envelope: WileyEnvelope): string => {
  const query = typeof envelope.query === "string" ? envelope.query : "";
  const first = chunkText(envelope.results[0]) ?? "";
  return `${query}|${envelope.results.length}|${first.slice(0, 80)}`;
};

const chunkKey = (
  doc: Document,
  result: unknown,
  index: number,
): string => {
  const record = isRecord(result) ? result : {};
  if (
    record.id != null &&
    String(record.id) !== "" &&
    String(record.id) !== "null"
  ) {
    return `id:${String(record.id)}`;
  }
  const url =
    asText(doc.payload?.url) ?? asText(doc.metadata?.additionalMetadata?.link);
  const chunkIndex =
    typeof record.chunk_index === "number" ? record.chunk_index : index;
  if (url) return `chunk:${normalizeArticleUrl(url)}:${chunkIndex}`;
  const text =
    asPassage(doc.payload?.text) ?? asPassage(doc.text) ?? "";
  return text
    ? `text:${text.replace(/\s+/g, " ").trim().toLowerCase()}`
    : `idx:${index}`;
};

const wileyResultToDocument = (
  result: unknown,
  parent: Document,
  index: number,
): Document => {
  const record = isRecord(result) ? result : {};
  const metadata = isRecord(record.metadata) ? record.metadata : {};
  const additional = additionalMetadataOf(record);
  const text = chunkText(result) ?? "";
  const title =
    asText(additional.title) ??
    asText(additional.citationLine) ??
    asText(parent.payload?.title) ??
    PLACEHOLDER_TITLE;
  const url =
    asText(additional.link) ??
    asText(record.doi) ??
    asText(parent.payload?.url) ??
    "";
  const parentAdditional = parent.metadata?.additionalMetadata;
  const chunkIndex =
    typeof record.chunk_index === "number" ? record.chunk_index : index;
  const id =
    record.id ??
    (url ? `${url}_${chunkIndex}` : undefined) ??
    parent.id ??
    `${parent.collection_name ?? "wiley"}-${chunkIndex}`;

  return {
    id: id as Document["id"],
    text,
    collection_name: parent.collection_name || "Wiley AI Gateway",
    payload: {
      title,
      url,
      text,
    },
    metadata: {
      ...metadata,
      additionalMetadata: {
        ...additional,
        link: url || (parentAdditional?.link ?? ""),
        title,
        journalTitle:
          asText(additional.journalTitle) ?? parentAdditional?.journalTitle ?? "",
        citationLine:
          asText(additional.citationLine) ?? parentAdditional?.citationLine ?? "",
      },
    },
  };
};

const envelopeOfDocument = (source: Document | null | undefined) =>
  envelopeFrom(source?.payload?.content) ??
  envelopeFrom(source?.payload?.text) ??
  envelopeFrom(source?.text);

/**
 * Text to render for a source. Backend versions differ in where the chunk
 * body lives: agentic messages persist payload.text (sometimes
 * payload.content), classic ones the top-level text. content wins, then
 * payload.text, then text; anything missing, blank or not renderable falls
 * back to "No text".
 *
 * Wiley docs from eve_retrieval can nest the passage list inside a Scholar
 * Gateway envelope on `text`. Do not join every hit: that reprints the same
 * papers in one block. Prefer a real passage field; otherwise the first chunk.
 */
export const getSourceText = (source: Document | null | undefined): string =>
  asPassage(source?.payload?.content) ??
  asPassage(source?.payload?.text) ??
  asPassage(source?.text) ??
  chunkText(envelopeOfDocument(source)?.results[0]) ??
  NO_SOURCE_TEXT;

export const getRenderableDocuments = (documents: unknown): Document[] => {
  if (!Array.isArray(documents)) return [];
  const seenEnvelopes = new Set<string>();
  const seenChunks = new Set<string>();
  const out: Document[] = [];

  for (const entry of documents) {
    if (!isRecord(entry)) continue;
    if (!isRecord(entry.payload) && typeof entry.collection_name !== "string") {
      continue;
    }
    const doc = entry as Document;
    const envelope = envelopeOfDocument(doc);
    if (!envelope) {
      out.push(doc);
      continue;
    }

    const fingerprint = envelopeFingerprint(envelope);
    if (seenEnvelopes.has(fingerprint)) continue;
    seenEnvelopes.add(fingerprint);

    // Unique chunks only. Same paper can contribute several passages;
    // duplicate envelopes or the same chunk_index+DOI must not.
    for (const [index, result] of envelope.results.entries()) {
      const piece = wileyResultToDocument(result, doc, index);
      const key = chunkKey(piece, result, index);
      if (seenChunks.has(key)) continue;
      seenChunks.add(key);
      out.push(piece);
    }
  }
  return out;
};
