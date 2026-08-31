import { describe, expect, it } from "vitest";
import { getRenderableDocuments, getSourceText } from "./messageDocuments";
import type { Document } from "@/types";

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
});
