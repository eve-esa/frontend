/**
 * Inline citations (FEATURE_INLINE_CITATIONS): the Source descriptors the
 * backend attaches to an agentic answer, and the pure logic the UI needs to
 * draw them. Contract: `message.metadata.citations` (cited Sources, each with
 * `n`, `at` and `origin`) and `message.metadata.sources_retrieved` (the uncited
 * rest), also carried by the `token`, `final` and `stopped` stream frames.
 *
 * The answer text holds `[n]`; only an `[n]` found at a recorded `at` (a code
 * point offset) becomes a marker, so a literal `[1]` in a formula stays text.
 */

export type SourceKind =
  | "document"
  | "web_page"
  | "stac_item"
  | "user_file"
  | "skill"
  | "dataset"
  | "tool_result";

export type SourceOpen = {
  type?: "viewer" | "artifact" | "url" | "stac" | "skill" | "none" | string;
  href?: string;
  document_id?: string;
  artifact_id?: string;
  page?: number;
  name?: string;
  version?: string;
};

export type CitationSource = {
  id: string;
  handle?: string;
  kind?: SourceKind | string;
  provider?: string;
  provider_label?: string;
  /** Lowercase provider name the UI shows (`wiley`, `esa`, `oa`, `wikipedia`, `cdse`). */
  slug?: string;
  visibility?: "public" | "licensed" | "internal" | "private" | string;
  title: string;
  document_key?: string;
  passage?: string;
  highlight?: [number, number][];
  locator?: Record<string, unknown>;
  open?: SourceOpen;
  meta?: Record<string, unknown>;
  file?: {
    name?: string;
    mime?: string;
    size_bytes?: number;
    document_id?: string;
    artifact_id?: string;
    collection_id?: string;
    conversation_id?: string;
  };
  tool_call_id?: string;
};

export type Citation = CitationSource & {
  /** The number shown: one per document (see shareNumbersByDocument). */
  n: number;
  /** The number the answer text holds at `at`, when the client changed `n`. */
  textN?: number;
  /** Code point offsets of this Source's markers in the answer text. */
  at: number[];
  origin?: string;
};

export type RetrievedSource = CitationSource;

export type CitationMetadata = {
  citations?: unknown;
  sources_retrieved?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const STRING_FIELDS = [
  "handle",
  "kind",
  "provider",
  "provider_label",
  "slug",
  "visibility",
  "document_key",
  "passage",
  "tool_call_id",
  "origin",
] as const;
const OBJECT_FIELDS = ["locator", "open", "meta", "file"] as const;

/**
 * A descriptor the UI can draw: string id and title, every known text field a
 * string when present, every known object field an object, a file name a
 * string. Anything else drops the source rather than crash the message.
 */
const isSource = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || typeof value.title !== "string" || value.title.trim() === "") return false;
  for (const key of STRING_FIELDS) {
    if (value[key] !== undefined && typeof value[key] !== "string") return false;
  }
  for (const key of OBJECT_FIELDS) {
    if (value[key] !== undefined && !isRecord(value[key])) return false;
  }
  const file = value.file as Record<string, unknown> | undefined;
  if (file && file.name !== undefined && typeof file.name !== "string") return false;
  return true;
};

/** Keeps `highlight` only as a list of two-number spans. */
const cleanHighlight = (value: unknown): [number, number][] | undefined =>
  Array.isArray(value)
    ? value.filter(
        (span): span is [number, number] =>
          Array.isArray(span) && span.length === 2 && span.every((v) => typeof v === "number"),
      )
    : undefined;

/** Cited Sources from a frame or a stored message; malformed entries are dropped. */
export const normalizeCitations = (raw: unknown): Citation[] => {
  if (!Array.isArray(raw)) return [];
  const out: Citation[] = [];
  for (const entry of raw) {
    if (!isSource(entry)) continue;
    const n = entry.n;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1) continue;
    const at = Array.isArray(entry.at)
      ? entry.at.filter((v): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0)
      : typeof entry.at === "number"
        ? [entry.at]
        : [];
    out.push({ ...(entry as unknown as Citation), n, at, highlight: cleanHighlight(entry.highlight) });
  }
  return out;
};

/** Retrieved, uncited Sources; malformed entries are dropped. */
export const normalizeRetrieved = (raw: unknown): RetrievedSource[] =>
  Array.isArray(raw)
    ? raw
        .filter(isSource)
        .map((entry) => ({ ...(entry as unknown as RetrievedSource), highlight: cleanHighlight(entry.highlight) }))
    : [];

/**
 * Whether a turn carries the citation lists. Turns without them (classic
 * answers, the flag off on the backend, older history) keep today's Sources
 * button.
 */
export const hasInlineCitations = (metadata: CitationMetadata | null | undefined): boolean =>
  Boolean(metadata) &&
  (normalizeCitations(metadata?.citations).length > 0 ||
    (Array.isArray(metadata?.citations) && normalizeRetrieved(metadata?.sources_retrieved).length > 0));

// ---------------------------------------------------------------------------
// Markers in the answer text
// ---------------------------------------------------------------------------

/** Placeholder a marker becomes before markdown parsing: private use code points around its index. */
export const MARKER_OPEN = "\uE000";
export const MARKER_CLOSE = "\uE001";
export const MARKER_PATTERN = /\uE000(\d+)\uE001/g;

/**
 * Replaces the placeholder code points in text that did not come from
 * `markCitations` (the answer, a requery), so no text can forge a marker. One
 * code point for one, so recorded offsets after it still hold.
 */
export const scrubPlaceholders = (text: string): string => text.replace(/[\uE000\uE001]/g, "\uFFFD");

export type MarkerInstance = {
  /** Index in the marker list; the placeholder carries it. */
  key: number;
  /** One number, or a range of three or more consecutive ones shown as one chip. */
  ns: number[];
  /** The entries this marker names: per number, the entry whose offset it sits at first. */
  entries: Citation[];
};

/** Maps code point offsets to UTF-16 offsets for one string. */
const utf16Offsets = (text: string, wanted: ReadonlySet<number>): Map<number, number> => {
  const out = new Map<number, number>();
  if (wanted.size === 0) return out;
  let cp = 0;
  let u16 = 0;
  for (const ch of text) {
    if (wanted.has(cp)) out.set(cp, u16);
    cp += 1;
    u16 += ch.length;
  }
  if (wanted.has(cp)) out.set(cp, u16);
  return out;
};

type Occurrence = { start: number; end: number; n: number; entries: Citation[] };

/** Splits a run of adjacent markers into single chips and ranges of three or more consecutive numbers. */
const chunkRun = (run: Occurrence[]): Occurrence[][] => {
  const chunks: Occurrence[][] = [];
  let current: Occurrence[] = [];
  for (const occ of run) {
    const prev = current[current.length - 1];
    if (prev && occ.n === prev.n + 1) {
      current.push(occ);
    } else {
      if (current.length) chunks.push(current);
      current = [occ];
    }
  }
  if (current.length) chunks.push(current);
  return chunks.flatMap((chunk) => (chunk.length >= 3 ? [chunk] : chunk.map((occ) => [occ])));
};

/**
 * Replaces each `[n]` found at a recorded offset with a placeholder and lists
 * the markers. Works on a streamed prefix too: a marker the text has not
 * finished yet stays text until it is whole.
 */
export const markCitations = (
  text: string,
  citations: readonly Citation[],
): { text: string; markers: MarkerInstance[] } => {
  text = scrubPlaceholders(text);
  if (!text || citations.length === 0) return { text, markers: [] };
  const wanted = new Set<number>();
  for (const entry of citations) for (const at of entry.at) wanted.add(at);
  const offsets = utf16Offsets(text, wanted);

  const byStart = new Map<number, Occurrence>();
  for (const entry of citations) {
    const token = `[${entry.textN ?? entry.n}]`;
    for (const at of entry.at) {
      const start = offsets.get(at);
      if (start === undefined || !text.startsWith(token, start)) continue;
      const known = byStart.get(start);
      if (known) {
        if (known.n === entry.n && !known.entries.includes(entry)) known.entries.push(entry);
        continue;
      }
      byStart.set(start, { start, end: start + token.length, n: entry.n, entries: [entry] });
    }
  }
  if (byStart.size === 0) return { text, markers: [] };

  const sorted = [...byStart.values()].sort((a, b) => a.start - b.start);
  const runs: Occurrence[][] = [];
  for (const occ of sorted) {
    const run = runs[runs.length - 1];
    const last = run?.[run.length - 1];
    if (last && last.end === occ.start) run.push(occ);
    else runs.push([occ]);
  }

  // Adjacent markers that show one number (two passages of one document) draw one chip.
  for (const run of runs) {
    const kept: Occurrence[] = [];
    for (const occ of run) {
      if (kept.some((k) => k.n === occ.n)) kept[kept.length - 1].end = occ.end;
      else kept.push(occ);
    }
    run.splice(0, run.length, ...kept);
  }

  const markers: MarkerInstance[] = [];
  let out = "";
  let cursor = 0;
  for (const chunk of runs.flatMap(chunkRun)) {
    const key = markers.length;
    markers.push({
      key,
      ns: chunk.map((occ) => occ.n),
      entries: chunk.flatMap((occ) => occ.entries),
    });
    out += text.slice(cursor, chunk[0].start) + MARKER_OPEN + key + MARKER_CLOSE;
    cursor = chunk[chunk.length - 1].end;
  }
  out += text.slice(cursor);
  return { text: out, markers };
};

/** Puts the `[n]` text back in place of the placeholders (plain text fallbacks). */
export const unmarkText = (text: string, markers: readonly MarkerInstance[]): string =>
  text.replace(MARKER_PATTERN, (_, key: string) => {
    const marker = markers[Number(key)];
    return marker ? marker.ns.map((n) => `[${n}]`).join("") : "";
  });

// ---------------------------------------------------------------------------
// Sources list
// ---------------------------------------------------------------------------

export type CitedSource = {
  n: number;
  /** Passages of this document, the first one stands for it. */
  entries: Citation[];
};

export type SourceGroup = {
  /** Provider key, or `own` for the user's files. */
  key: string;
  label: string;
  items: CitedSource[];
};

export const isUserFile = (source: CitationSource): boolean =>
  source.kind === "user_file" || source.visibility === "private";

/**
 * The provider as a lowercase text label: the descriptor `slug`, else the
 * lowercase `provider`; the user's files read `Your files`.
 */
export const providerSlug = (source: CitationSource): string => {
  if (isUserFile(source)) return "Your files";
  const slug = source.slug?.trim() || source.provider?.trim() || source.provider_label?.trim() || "";
  return slug.toLowerCase() || "source";
};

/** One item per number, in number order. */
export const citedSources = (citations: readonly Citation[]): CitedSource[] => {
  const byN = new Map<number, Citation[]>();
  for (const entry of citations) {
    const list = byN.get(entry.n);
    if (list) list.push(entry);
    else byN.set(entry.n, [entry]);
  }
  return [...byN.entries()]
    .sort(([a], [b]) => a - b)
    .map(([n, entries]) => ({ n, entries }));
};

/** Groups by provider in first-citation order; the user's files form one group. */
export const groupCitedSources = (citations: readonly Citation[]): SourceGroup[] => {
  const groups = new Map<string, SourceGroup>();
  for (const item of citedSources(citations)) {
    const first = item.entries[0];
    const own = isUserFile(first);
    const key = own ? "own" : first.provider || first.provider_label || "other";
    const group = groups.get(key);
    if (group) group.items.push(item);
    else
      groups.set(key, {
        key,
        label: own ? "Your files" : first.provider_label || first.provider || "Other",
        items: [item],
      });
  }
  return [...groups.values()];
};

/** `Sources: 5 cited from 3 providers and your files`. */
export const sourcesSummary = (groups: readonly SourceGroup[]): string => {
  const cited = groups.reduce((sum, g) => sum + g.items.length, 0);
  const providers = groups.filter((g) => g.key !== "own").length;
  const ownFiles = groups.find((g) => g.key === "own")?.items.length ?? 0;
  const yours = ownFiles === 1 ? "your file" : "your files";
  const from =
    providers > 0
      ? `${providers} ${providers === 1 ? "provider" : "providers"}${ownFiles ? ` and ${yours}` : ""}`
      : yours;
  return `Sources: ${cited} cited from ${from}`;
};

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Middle truncation that keeps the extension; the full name goes to the title and the accessible name. */
export const truncateMiddle = (name: string, max = 34): string => {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 && name.length - dot <= 8 ? name.slice(dot) : "";
  const stem = name.slice(0, name.length - ext.length);
  const room = max - ext.length - 3;
  const tail = Math.min(6, Math.floor(room / 3));
  const head = room - tail;
  return `${stem.slice(0, head)}...${tail > 0 ? stem.slice(-tail) : ""}${ext}`;
};

/** The title a user sees: the full file name for a user file. */
export const sourceTitle = (source: CitationSource): string =>
  (isUserFile(source) && source.file?.name) || source.title;

/** `Source 3: <title>, <provider>`. */
export const markerLabel = (source: Citation): string =>
  `Source ${source.n}: ${sourceTitle(source)}${source.provider_label ? `, ${source.provider_label}` : ""}`;

/** http and https only; anything else never becomes a link. */
export const safeHref = (href: unknown): string | null => {
  if (typeof href !== "string" || !href) return null;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : null;

export const locatorValue = (source: CitationSource, key: string): string | null =>
  str(source.locator?.[key]);

export const metaValue = (source: CitationSource, key: string): string | null => str(source.meta?.[key]);

/** The bare DOI: a resolver URL or a `doi:` prefix the source carries is read off. */
export const doiOf = (source: CitationSource): string | null => {
  const raw = locatorValue(source, "doi");
  if (!raw) return null;
  const bare = raw.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").trim();
  return bare || null;
};

/** The external link of a Source, when it has a safe one. */
export const externalHref = (source: CitationSource): string | null => {
  const open = source.open;
  if (open && (open.type === "url" || open.type === "stac")) return safeHref(open.href);
  const url = safeHref(source.locator?.url);
  if (url) return url;
  const doi = doiOf(source);
  return doi ? safeHref(`https://doi.org/${doi.split("/").map(encodeURIComponent).join("/")}`) : null;
};

/** One plain line for "Copy citation". */
export const citationText = (source: CitationSource): string => {
  const parts: string[] = [sourceTitle(source)];
  if (source.kind === "stac_item") {
    const collection = locatorValue(source, "stac_collection");
    const item = locatorValue(source, "stac_item_id");
    const where = [collection, item ? `item ${item}` : null].filter(Boolean).join(", ");
    if (where) parts.push(where);
  } else if (isUserFile(source)) {
    if (source.provider_label) parts.push(source.provider_label);
  } else {
    const venue = [metaValue(source, "venue"), metaValue(source, "year")].filter(Boolean).join(", ");
    if (venue) parts.push(venue);
  }
  const page = locatorValue(source, "page");
  if (page) parts.push(`Page ${page}`);
  const doi = doiOf(source);
  const href = doi ? `doi:${doi}` : externalHref(source);
  if (href) parts.push(href);
  return parts.join(". ");
};

/** The answer as copied with its numbered sources appended. */
export const copyWithSources = (answer: string, citations: readonly Citation[]): string => {
  const items = citedSources(citations);
  if (items.length === 0) return answer;
  const lines = items.map((item) => `[${item.n}] ${citationText(item.entries[0])}`);
  return `${answer.trimEnd()}\n\nSources\n${lines.join("\n")}`;
};

/**
 * A passage as plain text: retrieved chunks can hold markdown (headings,
 * links to in-page anchors). Headings lose their hashes, links keep their
 * text, runs of blank lines fold into one. Offsets of `highlight` are read on
 * the raw passage, so a cleaned passage is shown without the mark.
 */
export const plainPassage = (passage: string): string =>
  passage
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// ---------------------------------------------------------------------------
// Client rules while the backend numbers passages, not documents
// ---------------------------------------------------------------------------

/**
 * The document a Source belongs to. The backend key, with the chunk suffix a
 * DOI key still carries (`doi:10.1155/2022/7936392_0000`) read off, until the
 * backend sends the bare DOI; title and provider when there is no key.
 */
export const documentKey = (source: CitationSource): string => {
  const raw = source.document_key?.trim();
  if (raw) return raw.replace(/^(doi:.+?)_\d{4}$/i, "$1");
  return `${source.provider ?? ""}|${source.title}`;
};

/** Two passages of one document share the number of its first citation. */
export const shareNumbersByDocument = (citations: readonly Citation[]): Citation[] => {
  const first = new Map<string, number>();
  for (const entry of [...citations].sort((a, b) => a.n - b.n)) {
    const key = documentKey(entry);
    if (!first.has(key)) first.set(key, entry.n);
  }
  return citations.map((entry) => {
    const n = first.get(documentKey(entry)) ?? entry.n;
    return n === entry.n ? entry : { ...entry, n, textN: entry.textN ?? entry.n };
  });
};

/** The uncited rest, one per document, never a document the answer cites. */
export const uncitedSources = (
  retrieved: readonly RetrievedSource[],
  citations: readonly Citation[],
): RetrievedSource[] => {
  const cited = new Set(citations.map(documentKey));
  const seen = new Set<string>();
  return retrieved.filter((source) => {
    const key = documentKey(source);
    if (cited.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
