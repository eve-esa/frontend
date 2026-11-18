import { describe, expect, it } from "vitest";
import {
  MARKER_CLOSE,
  MARKER_OPEN,
  MARKER_PATTERN,
  citationText,
  doiOf,
  documentKey,
  externalHref,
  scrubPlaceholders,
  shareNumbersByDocument,
  uncitedSources,
  groupCitedSources,
  hasInlineCitations,
  markCitations,
  markerLabel,
  normalizeCitations,
  normalizeRetrieved,
  plainPassage,
  safeHref,
  sourcesSummary,
  truncateMiddle,
  type Citation,
} from "./citations";

const cite = (n: number, at: number[], extra: Partial<Citation> = {}): Citation => ({
  id: `src_${n}`,
  kind: "document",
  provider: "qwen-512-filtered",
  provider_label: "EVE open access",
  visibility: "public",
  title: `Title ${n}`,
  n,
  at,
  origin: "model",
  ...extra,
});

const markers = (text: string) => [...text.matchAll(MARKER_PATTERN)].map((m) => Number(m[1]));

describe("markCitations", () => {
  it("turns only the [n] found at a recorded offset into a marker", () => {
    const text = "dNBR is the difference.[1] A formula [1] stays text.";
    const out = markCitations(text, [cite(1, [23])]);
    expect(out.markers).toHaveLength(1);
    expect(out.markers[0].ns).toEqual([1]);
    expect(markers(out.text)).toEqual([0]);
    expect(out.text).toContain("A formula [1] stays text.");
  });

  it("converts code point offsets to UTF-16 before matching", () => {
    // The satellite emoji is one code point and two UTF-16 units.
    const text = "\u{1F6F0} orbit.[2]";
    const at = [...text].indexOf("[");
    expect(at).toBe(8);
    const out = markCitations(text, [cite(2, [at])]);
    expect(out.markers.map((m) => m.ns)).toEqual([[2]]);
    expect(out.text.startsWith("\u{1F6F0} orbit.")).toBe(true);
  });

  it("ignores an unknown n and an offset that does not hold its own number", () => {
    const text = "One.[1] Two.[7] Three.[2]";
    // [7] has no entry; the entry for 2 points at [7] by mistake.
    const out = markCitations(text, [cite(1, [4]), cite(2, [12])]);
    expect(out.markers.map((m) => m.ns)).toEqual([[1]]);
    expect(out.text).toContain("Two.[7] Three.[2]");
  });

  it("keeps adjacent markers apart and folds three or more consecutive numbers into a range", () => {
    const text = "A.[1][3] B.[1][2][3][4] C.[5]";
    const out = markCitations(text, [
      cite(1, [2, 11]),
      cite(2, [14]),
      cite(3, [5, 17]),
      cite(4, [20]),
      cite(5, [26]),
    ]);
    expect(out.markers.map((m) => m.ns)).toEqual([[1], [3], [1, 2, 3, 4], [5]]);
  });

  it("matches a marker the stream has not finished yet only once it is whole", () => {
    const full = "Burn.[12]";
    const entries = [cite(12, [5])];
    expect(markCitations("Burn.[1", entries).markers).toHaveLength(0);
    expect(markCitations(full, entries).markers).toHaveLength(1);
  });

  it("picks the entry whose offset the marker sits at when two passages share n", () => {
    const text = "X.[1] Y.[1]";
    const first = cite(1, [2], { id: "src_a", passage: "first" });
    const second = cite(1, [8], { id: "src_b", passage: "second" });
    const out = markCitations(text, [first, second]);
    expect(out.markers[0].entries[0].id).toBe("src_a");
    expect(out.markers[1].entries[0].id).toBe("src_b");
  });
});

describe("normalizeCitations", () => {
  it("drops entries without a positive integer n, a title or offsets", () => {
    const out = normalizeCitations([
      cite(1, [3]),
      { ...cite(2, [4]), n: 0 },
      { ...cite(3, [5]), title: "" },
      { n: 4 },
      "junk",
    ]);
    expect(out.map((c) => c.n)).toEqual([1]);
    expect(normalizeCitations(undefined)).toEqual([]);
  });

  it("keeps retrieved sources that carry an id and a title", () => {
    expect(normalizeRetrieved([{ id: "a", title: "T", provider: "p", provider_label: "P" }, { id: "b" }])).toHaveLength(1);
  });
});

describe("hasInlineCitations", () => {
  it("is true only for a turn that carries the citation lists", () => {
    expect(hasInlineCitations(undefined)).toBe(false);
    expect(hasInlineCitations({})).toBe(false);
    expect(hasInlineCitations({ citations: [], sources_retrieved: [] })).toBe(false);
    expect(hasInlineCitations({ citations: [cite(1, [0])] })).toBe(true);
    expect(hasInlineCitations({ citations: [], sources_retrieved: [{ id: "a", title: "T" }] })).toBe(true);
  });
});

describe("groupCitedSources", () => {
  const wiley = cite(1, [0], { provider: "wiley", provider_label: "Wiley AI Gateway", visibility: "licensed" });
  const kb2 = cite(2, [0]);
  const kb3 = cite(3, [0]);
  const kb2b = cite(2, [9], { id: "src_2b" });
  const stac = cite(4, [0], { provider: "cdse", provider_label: "cdse", kind: "stac_item" });
  const file = cite(5, [0], { provider: "my-collections", provider_label: "My collections", kind: "user_file", visibility: "private" });
  const convFile = cite(6, [0], { provider: "conversation", provider_label: "This conversation", kind: "user_file", visibility: "private" });

  it("groups by provider in first-citation order, one item per number, the user's files together", () => {
    const groups = groupCitedSources([kb3, file, stac, wiley, kb2, kb2b, convFile]);
    expect(groups.map((g) => g.key)).toEqual(["wiley", "qwen-512-filtered", "cdse", "own"]);
    expect(groups[1].items.map((i) => i.n)).toEqual([2, 3]);
    expect(groups[1].items[0].entries.map((e) => e.id)).toEqual(["src_2", "src_2b"]);
    expect(groups[3].items.map((i) => i.n)).toEqual([5, 6]);
    expect(groups[3].label).toBe("Your files");
  });

  it("summarises the folded list in one line", () => {
    expect(sourcesSummary(groupCitedSources([wiley, kb2, kb3, stac, file]))).toBe(
      "Sources: 5 cited from 3 providers and your file",
    );
    expect(sourcesSummary(groupCitedSources([wiley, kb2, kb3, stac, file, convFile]))).toBe(
      "Sources: 6 cited from 3 providers and your files",
    );
    expect(sourcesSummary(groupCitedSources([kb2]))).toBe("Sources: 1 cited from 1 provider");
    expect(sourcesSummary(groupCitedSources([file, convFile]))).toBe("Sources: 2 cited from your files");
  });
});

describe("truncateMiddle", () => {
  it("cuts a long file name in the middle and keeps the extension", () => {
    const name = "evros_field_campaign_2023_composite_burn_index_plots_final.pdf";
    const short = truncateMiddle(name, 34);
    expect(short.length).toBeLessThanOrEqual(34);
    expect(short.endsWith("_final.pdf")).toBe(true);
    expect(short.startsWith("evros_field_campaign")).toBe(true);
    expect(short).toContain("...");
  });

  it("leaves a short name alone and copes with no extension", () => {
    expect(truncateMiddle("notes.md", 34)).toBe("notes.md");
    const out = truncateMiddle("a".repeat(60), 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out).toContain("...");
  });
});

describe("names and links", () => {
  it("names a marker with its number, title and provider", () => {
    expect(markerLabel(cite(3, [0]))).toBe("Source 3: Title 3, EVE open access");
    const file = cite(5, [0], {
      kind: "user_file",
      provider_label: "My collections",
      title: "short.pdf",
      file: { name: "a_very_long_original_file_name_kept_whole.pdf" },
    });
    expect(markerLabel(file)).toBe("Source 5: a_very_long_original_file_name_kept_whole.pdf, My collections");
  });

  it("lets only http and https become links", () => {
    expect(safeHref("https://doi.org/10.1/x")).toBe("https://doi.org/10.1/x");
    expect(safeHref("http://a.b")).toBe("http://a.b/");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref(undefined)).toBeNull();
  });

  it("builds a plain citation line", () => {
    const doc = cite(1, [0], {
      title: "Calibrating dNBR",
      meta: { venue: "Remote Sensing", year: 2022 },
      locator: { page: 7, doi: "10.1002/x" },
    });
    expect(citationText(doc)).toBe("Calibrating dNBR. Remote Sensing, 2022. Page 7. doi:10.1002/x");
  });
});

describe("plainPassage", () => {
  it("drops heading hashes and link targets and folds blank lines", () => {
    expect(plainPassage("## Methods\n\n\n\nSee Marino [2016](#bib-0045) and ![fig](x.png).")).toBe(
      "Methods\n\nSee Marino 2016 and fig.",
    );
  });
});

describe("client rules while the backend sends one number per passage", () => {
  const paper = (n: number, at: number[], key: string, id = `src_${n}`) =>
    cite(n, at, { id, document_key: key, provider: "wiley", provider_label: "Wiley AI Gateway" });

  it("reads the chunk suffix off a DOI key", () => {
    expect(documentKey(paper(1, [0], "doi:10.1155/2022/7936392_0000"))).toBe("doi:10.1155/2022/7936392");
    expect(documentKey(paper(1, [0], "stac:sentinel-2-l2a/S2B_X"))).toBe("stac:sentinel-2-l2a/S2B_X");
    expect(documentKey(cite(2, [0], { document_key: undefined }))).toBe("qwen-512-filtered|Title 2");
  });

  it("gives two passages of one document the number of its first citation", () => {
    const text = "A.[1] B.[2] C.[3]";
    const shared = shareNumbersByDocument([
      paper(1, [2], "doi:10.1/a_0000"),
      paper(2, [8], "doi:10.1/b_0000"),
      paper(3, [14], "doi:10.1/a_0003"),
    ]);
    expect(shared.map((c) => c.n)).toEqual([1, 2, 1]);
    const out = markCitations(text, shared);
    expect(out.markers.map((m) => m.ns)).toEqual([[1], [2], [1]]);
    expect(groupCitedSources(shared)[0].items.map((i) => i.n)).toEqual([1, 2]);
  });

  it("draws one chip for adjacent markers that now share a number", () => {
    const shared = shareNumbersByDocument([paper(1, [2], "doi:10.1/a_0000"), paper(2, [5], "doi:10.1/a_0001")]);
    const out = markCitations("A.[1][2] end", shared);
    expect(out.markers.map((m) => m.ns)).toEqual([[1]]);
    expect(out.text).toBe(`A.${MARKER_OPEN}0${MARKER_CLOSE} end`);
  });

  it("never lists a cited document under Also retrieved, and lists each document once", () => {
    const cited = [paper(1, [0], "doi:10.1/a_0000")];
    const retrieved = [
      { id: "r1", title: "A again", document_key: "doi:10.1/a_0004" },
      { id: "r2", title: "B", document_key: "doi:10.1/b_0000" },
      { id: "r3", title: "B again", document_key: "doi:10.1/b_0002" },
    ];
    expect(uncitedSources(retrieved, cited).map((s) => s.id)).toEqual(["r2"]);
  });
});

describe("review fixes", () => {
  it("never turns a placeholder written in the answer into a marker", () => {
    const forged = `Look ${MARKER_OPEN}0${MARKER_CLOSE} here.[1]`;
    const at = [...forged].indexOf("[");
    const out = markCitations(forged, [cite(1, [at])]);
    expect(out.markers).toHaveLength(1);
    expect([...out.text.matchAll(MARKER_PATTERN)]).toHaveLength(1);
    // Same length, so the offsets after it still hold.
    expect(scrubPlaceholders(`a${MARKER_OPEN}b${MARKER_CLOSE}`)).toHaveLength(4);
    expect(scrubPlaceholders(`a${MARKER_OPEN}b`)).not.toContain(MARKER_OPEN);
  });

  it("scrubs placeholders even when there is nothing to mark", () => {
    expect(markCitations(`x${MARKER_OPEN}0${MARKER_CLOSE}`, []).text).not.toMatch(MARKER_PATTERN);
  });

  it("drops a source whose descriptor fields are not strings", () => {
    const out = normalizeCitations([
      cite(1, [0]),
      { ...cite(2, [0]), provider_label: 42 },
      { ...cite(3, [0]), provider: { x: 1 } },
      { ...cite(4, [0]), kind: "user_file", file: { name: 7 } },
      { ...cite(5, [0]), locator: "page 3" },
      { ...cite(6, [0]), passage: ["a"] },
    ]);
    expect(out.map((c) => c.n)).toEqual([1]);
    expect(normalizeRetrieved([{ id: "a", title: "T", provider_label: null }, { id: "b", title: "U" }]).map((s) => s.id)).toEqual(["b"]);
  });

  it("normalises a DOI that already carries a resolver or a prefix", () => {
    const withDoi = (doi: string) => cite(1, [0], { locator: { doi } });
    expect(doiOf(withDoi("https://doi.org/10.1002/x.1"))).toBe("10.1002/x.1");
    expect(doiOf(withDoi("doi:10.1002/x.1"))).toBe("10.1002/x.1");
    expect(doiOf(withDoi("http://dx.doi.org/10.1002/x.1"))).toBe("10.1002/x.1");
    expect(externalHref(withDoi("doi:10.1002/a#b?c"))).toBe("https://doi.org/10.1002/a%23b%3Fc");
    expect(citationText(withDoi("https://doi.org/10.1002/x.1"))).toBe("Title 1. doi:10.1002/x.1");
  });
});
