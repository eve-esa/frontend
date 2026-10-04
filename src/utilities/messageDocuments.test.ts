import { describe, expect, it } from "vitest";
import {
  getRenderableDocuments,
  getSourceGroupKey,
  getSourceText,
  getSourceTitle,
  groupSourcesByDocument,
} from "./messageDocuments";
import type { Document } from "@/types";
import { wileyEnvelopeDoc } from "./wileyEnvelope.fixture";

const doc = (id: string): Document => ({
  id,
  text: "body",
  collection_name: "esa_moocs",
  payload: { title: `Title ${id}`, url: "https://example.org", text: "body" },
  metadata: {
    additionalMetadata: {
      link: "https://example.org",
      title: `Title ${id}`,
      journalTitle: "",
      citationLine: "",
    },
  },
});

describe("getRenderableDocuments", () => {
  it("keeps a classic Document array unchanged", () => {
    const docs = [doc("a"), doc("b")];
    expect(getRenderableDocuments(docs)).toEqual(docs);
  });

  it("drops legacy {tool, content} entries", () => {
    expect(
      getRenderableDocuments([
        { tool: "eve_retrieval_retrieve", content: '{"hits": []}' },
      ]),
    ).toEqual([]);
  });

  it("keeps only Document entries from a mixed list", () => {
    const keep = doc("a");
    expect(
      getRenderableDocuments([
        { tool: "eve_retrieval_retrieve", content: "{}" },
        keep,
        null,
        "text",
        { collection_name: "wiley" },
      ]),
    ).toEqual([keep, { collection_name: "wiley" }]);
  });

  it("returns [] for null and undefined", () => {
    expect(getRenderableDocuments(null)).toEqual([]);
    expect(getRenderableDocuments(undefined)).toEqual([]);
  });
});

describe("getSourceText", () => {
  it("prefers payload.content", () => {
    const d = doc("a");
    d.payload.content = "content";
    d.payload.text = "payload text";
    expect(getSourceText(d)).toBe("content");
  });

  it("falls back to payload.text, then text", () => {
    const d = doc("a");
    d.payload.text = "payload text";
    expect(getSourceText(d)).toBe("payload text");
    delete d.payload.text;
    expect(getSourceText(d)).toBe("body");
  });

  it("returns \"No text\" when nothing is available", () => {
    const d = doc("a");
    delete d.payload.text;
    d.text = undefined as unknown as string;
    expect(getSourceText(d)).toBe("No text");
    expect(getSourceText(undefined)).toBe("No text");
  });

  // The types call these fields strings; persisted documents disagree, and an
  // object used to travel unchecked to stripArtifactMetadata's .split.
  it("falls through to payload.text when content is an object", () => {
    const d = doc("a");
    d.payload.content = { body: "text" } as unknown as string;
    d.payload.text = "payload text";
    expect(getSourceText(d)).toBe("payload text");
  });

  it("falls through when content is blank or an empty list", () => {
    const d = doc("a");
    d.payload.text = "payload text";
    d.payload.content = "";
    expect(getSourceText(d)).toBe("payload text");
    d.payload.content = "   ";
    expect(getSourceText(d)).toBe("payload text");
    d.payload.content = [] as unknown as string;
    expect(getSourceText(d)).toBe("payload text");
  });

  it("joins a list of strings with newlines", () => {
    const d = doc("a");
    d.payload.content = ["a", "b"] as unknown as string;
    expect(getSourceText(d)).toBe("a\nb");
  });

  it("returns \"No text\" when every field is unrenderable", () => {
    const d = doc("a");
    d.payload.content = { body: "text" } as unknown as string;
    d.payload.text = 42 as unknown as string;
    d.text = [{ chunk: 1 }] as unknown as string;
    expect(getSourceText(d)).toBe("No text");
  });

  it("unwraps a Wiley Scholar Gateway envelope on text", () => {
    const d = wileyEnvelopeDoc();
    expect(getSourceText(d)).toContain(
      "Gully erosion varies seasonally at catchment scale.",
    );
    expect(getSourceText(d)).not.toContain(
      "Sentinel-2 provides optical imagery for land monitoring.",
    );
  });

  it("unwraps a JSON-string Wiley envelope", () => {
    const d = wileyEnvelopeDoc();
    d.text = JSON.stringify(d.text);
    expect(getSourceText(d)).toContain("Gully erosion varies seasonally");
  });
});

describe("Wiley eve_retrieval documents", () => {
  it("explodes a Wiley envelope into one source per chunk", () => {
    const sources = getRenderableDocuments([wileyEnvelopeDoc()]);
    expect(sources).toHaveLength(2);
    expect(sources[0]?.payload.title).toBe(
      "Modelling seasonal variation of gully erosion at the catchment scale",
    );
    expect(sources[0]?.payload.url).toBe("https://doi.org/10.1002/esp.5041");
    expect(sources[0]?.collection_name).toBe("Wiley AI Gateway");
    expect(getSourceText(sources[0])).toContain(
      "Gully erosion varies seasonally at catchment scale.",
    );
    expect(getSourceText(sources[1])).toContain(
      "Sentinel-2 provides optical imagery for land monitoring.",
    );
  });

  it("falls back to citationLine when a Wiley chunk has no title", () => {
    const wrapped = wileyEnvelopeDoc();
    const envelope = wrapped.text as unknown as {
      results: Array<{ metadata: { additionalMetadata: { title?: string; citationLine: string } } }>;
    };
    delete envelope.results[0]?.metadata.additionalMetadata.title;
    const sources = getRenderableDocuments([wrapped]);
    expect(sources[0]?.payload.title).toContain("Agostini, M.");
  });

  it("does not explode unrelated objects that happen to have results", () => {
    const d = doc("a");
    d.text = { results: [{ unrelated: true }] } as unknown as string;
    expect(getRenderableDocuments([d])).toEqual([d]);
    expect(getSourceText(d)).toBe("body");
  });

  it("keeps distinct chunks from the same Wiley paper", () => {
    const wrapped = wileyEnvelopeDoc();
    const envelope = wrapped.text as unknown as {
      results: Array<Record<string, unknown>>;
    };
    envelope.results.push({
      chunk_index: 17,
      text: "A second chunk from the same gully-erosion article.",
      metadata: {
        additionalMetadata: {
          title:
            "Modelling seasonal variation of gully erosion at the catchment scale",
          link: "https://doi.org/10.1002/esp.5041",
          citationLine:
            "Agostini, M., Mondini, A. C., Torri, D., & Rossi, M. (2021). Modelling seasonal variation of gully erosion at the catchment scale.",
        },
      },
    });
    const sources = getRenderableDocuments([wrapped]);
    expect(sources).toHaveLength(3);
    expect(
      sources.some((source) =>
        getSourceText(source).includes(
          "A second chunk from the same gully-erosion article.",
        ),
      ),
    ).toBe(true);
  });

  it("does not duplicate chunks when the same Wiley envelope appears twice", () => {
    const sources = getRenderableDocuments([
      wileyEnvelopeDoc(),
      wileyEnvelopeDoc(),
    ]);
    expect(sources).toHaveLength(2);
  });

  it("does not collapse distinct untitled Wiley papers", () => {
    const wrapped = wileyEnvelopeDoc();
    const envelope = wrapped.text as unknown as {
      results: Array<Record<string, unknown>>;
    };
    envelope.results = [
      {
        chunk_index: 1,
        text: "First untitled paper passage.",
        metadata: { additionalMetadata: {} },
      },
      {
        chunk_index: 2,
        text: "Second untitled paper passage.",
        metadata: { additionalMetadata: {} },
      },
    ];
    const sources = getRenderableDocuments([wrapped]);
    expect(sources).toHaveLength(2);
    expect(getSourceText(sources[0])).toContain("First untitled paper");
    expect(getSourceText(sources[1])).toContain("Second untitled paper");
  });

  it("drops a Wiley chunk that is the same DOI and chunk_index", () => {
    const wrapped = wileyEnvelopeDoc();
    const envelope = wrapped.text as unknown as {
      results: Array<Record<string, unknown>>;
    };
    envelope.results.push({
      chunk_index: 3,
      text: "Duplicate Sentinel-2 chunk that should be dropped.",
      metadata: {
        additionalMetadata: {
          title: "Sentinel-2 mission overview (copy)",
          link: "http://dx.doi.org/10.1016/j.rse.2011.11.026",
        },
      },
    });
    const sources = getRenderableDocuments([wrapped]);
    expect(sources).toHaveLength(2);
    expect(
      sources.some((source) =>
        getSourceText(source).includes(
          "Duplicate Sentinel-2 chunk that should be dropped.",
        ),
      ),
    ).toBe(false);
  });

  it("drops duplicate Wiley documents that are not wrapped in an envelope", () => {
    const chunk = {
      id: null,
      collection_name: "Wiley AI Gateway",
      payload: {
        title: "Sentinel-2 mission overview",
        url: "https://doi.org/10.1016/j.rse.2011.11.026",
        text: "Sentinel-2 provides optical imagery for land monitoring.",
      },
      text: "Sentinel-2 provides optical imagery for land monitoring.",
      metadata: {
        additionalMetadata: {
          title: "Sentinel-2 mission overview",
          link: "https://doi.org/10.1016/j.rse.2011.11.026",
          journalTitle: "",
          citationLine: "",
        },
      },
    } as unknown as Document;
    const copy = { ...chunk, payload: { ...chunk.payload } };
    expect(getRenderableDocuments([chunk, copy])).toHaveLength(1);
  });
});

describe("getSourceTitle", () => {
  const titled = (payloadTitle: unknown, additionalTitle?: unknown): Document =>
    ({
      id: "t",
      text: "body",
      collection_name: "qwen-512-filtered",
      payload: { title: payloadTitle },
      metadata:
        additionalTitle === undefined
          ? {}
          : { additionalMetadata: { title: additionalTitle } },
    }) as unknown as Document;

  it("prefers additionalMetadata.title, then payload.title", () => {
    expect(getSourceTitle(titled("Payload", "Additional"))).toBe("Additional");
    expect(getSourceTitle(titled("Payload"))).toBe("Payload");
  });

  it.each(["nan", "NaN", "None", "null", "", "  "])(
    "treats %j as a missing title",
    (marker) => {
      expect(getSourceTitle(titled(marker))).toBe("Title not available");
      expect(getSourceTitle(titled("Real title", marker))).toBe("Real title");
    },
  );

  it("falls back when there is no title or no source", () => {
    expect(getSourceTitle(titled(null))).toBe("Title not available");
    expect(getSourceTitle(undefined)).toBe("Title not available");
  });

  it("keeps a title that only contains a marker word", () => {
    expect(getSourceTitle(titled("Nan Shan glacier survey"))).toBe(
      "Nan Shan glacier survey",
    );
  });
});

describe("groupSourcesByDocument", () => {
  const chunk = (
    id: string,
    fields: { title?: string | null; link?: string; documentId?: string },
  ): Document =>
    ({
      id,
      text: `body ${id}`,
      collection_name: "qwen-512-filtered",
      payload: { title: fields.title ?? null, url: fields.link ?? "" },
      metadata: {
        document_id: fields.documentId,
        additionalMetadata: {
          title: fields.title ?? null,
          link: fields.link ?? "",
        },
      },
    }) as unknown as Document;

  const shape = (sources: Document[]) =>
    groupSourcesByDocument(sources).map((g) => [g.title, g.sources.length]);

  it("keeps two untitled documents apart", () => {
    expect(
      shape([
        chunk("1", { link: "https://example.org/a" }),
        chunk("2", { link: "https://example.org/b" }),
      ]),
    ).toEqual([
      ["Title not available", 1],
      ["Title not available", 1],
    ]);
  });

  it("keeps untitled chunks with no document identity apart", () => {
    expect(shape([chunk("1", {}), chunk("2", {})])).toEqual([
      ["Title not available", 1],
      ["Title not available", 1],
    ]);
  });

  it("groups the chunks of one document, titled or not", () => {
    const link = "https://doi.org/10.1002/esp.5041";
    expect(
      shape([
        chunk("1", { link }),
        chunk("2", { link: `${link}/` }),
        chunk("3", { title: "Glaciers", link: "https://example.org/g" }),
        chunk("4", { title: "Glaciers", link: "https://example.org/g" }),
        chunk("5", { title: "Glaciers", link: "https://example.org/g" }),
      ]),
    ).toEqual([
      ["Title not available", 2],
      ["Glaciers", 3],
    ]);
  });

  it("groups a private upload by its document id", () => {
    expect(
      shape([
        chunk("1", { documentId: "6ab5", link: "https://s3/x" }),
        chunk("2", { documentId: "6ab5", title: "Report", link: "https://s3/x" }),
        chunk("3", { documentId: "6ab6", link: "https://s3/x" }),
      ]),
    ).toEqual([
      ["Title not available", 2],
      ["Title not available", 1],
    ]);
  });

  it("keeps two documents with the same title apart", () => {
    expect(
      shape([
        chunk("1", { title: "Introduction", link: "https://example.org/a" }),
        chunk("2", { title: "Introduction", link: "https://example.org/b" }),
      ]),
    ).toEqual([
      ["Introduction", 1],
      ["Introduction", 1],
    ]);
  });

  it("falls back to the title, then to the chunk id", () => {
    expect(getSourceGroupKey(chunk("1", { title: "Only title" }))).toBe(
      "title:Only title",
    );
    expect(getSourceGroupKey(chunk("7", { title: "nan" }))).toBe("chunk:7");
    expect(getSourceGroupKey(undefined, 3)).toBe("index:3");
  });

  it("returns no groups for missing sources", () => {
    expect(groupSourcesByDocument(undefined)).toEqual([]);
  });
});
