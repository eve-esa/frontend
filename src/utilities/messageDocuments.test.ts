import { describe, expect, it } from "vitest";
import { getRenderableDocuments, getSourceText } from "./messageDocuments";
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
    expect(getSourceText(d)).toContain(
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
});
