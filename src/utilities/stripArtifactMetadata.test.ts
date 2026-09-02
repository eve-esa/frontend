import { describe, expect, it } from "vitest";
import { stripArtifactMetadata } from "./stripArtifactMetadata";

describe("stripArtifactMetadata", () => {
  it("drops the metadata line and keeps the markdown link", () => {
    const text = [
      "![chart](/artifacts/abc123)",
      '{"artifact_id": "abc123", "url": "/artifacts/abc123", "content_type": "image/png"}',
    ].join("\n");

    expect(stripArtifactMetadata(text)).toBe("![chart](/artifacts/abc123)");
  });

  it("leaves other JSON lines alone", () => {
    const text = '{"hits": 3}';

    expect(stripArtifactMetadata(text)).toBe(text);
  });

  it("returns an empty string for a non-string, instead of throwing", () => {
    // A persisted source can hold an object or a list where the type says
    // string; .split on one used to take the whole Sources panel down.
    expect(stripArtifactMetadata({} as unknown as string)).toBe("");
    expect(stripArtifactMetadata(["a", "b"] as unknown as string)).toBe("");
    expect(stripArtifactMetadata(undefined as unknown as string)).toBe("");
  });
});
