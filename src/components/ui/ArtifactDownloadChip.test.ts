import { describe, expect, it } from "vitest";
import {
  linkedImageSrc,
  workspaceDownloadName,
  workspaceMarkdownHrefs,
} from "./ArtifactDownloadChip";

const REPORT =
  "/conversations/6afc7801e283102b6482b636/workspace/attica_fire_2018_report.md";
const MAP = "/artifacts/6afc784fe283102b6482b693/severity_map.png";

describe("workspaceDownloadName", () => {
  it("uses the file name from a workspace link", () => {
    expect(workspaceDownloadName(REPORT)).toBe("attica_fire_2018_report.md");
  });

  it("uses the last segment of a nested path", () => {
    expect(
      workspaceDownloadName(
        "/conversations/conv-1/workspace/plots/ndvi.png",
      ),
    ).toBe("ndvi.png");
  });

  it("decodes a percent-encoded name", () => {
    expect(
      workspaceDownloadName(
        "/conversations/conv-1/workspace/fire%20report.md",
      ),
    ).toBe("fire report.md");
  });

  it("rejects paths that are not a workspace file", () => {
    expect(workspaceDownloadName("/artifacts/abc")).toBeUndefined();
    expect(workspaceDownloadName("https://example.com" + REPORT)).toBeUndefined();
    expect(
      workspaceDownloadName("/conversations/conv-1/workspace/../secret.md"),
    ).toBeUndefined();
    expect(
      workspaceDownloadName("/conversations/conv-1/workspace/%2e%2e/secret.md"),
    ).toBeUndefined();
    expect(
      workspaceDownloadName("/conversations/conv-1/workspace/report.md?x=1"),
    ).toBeUndefined();
    expect(
      workspaceDownloadName("//evil.example/conversations/conv-1/workspace/a.md"),
    ).toBeUndefined();
  });
});

describe("linkedImageSrc", () => {
  it("loads an artifact picture from the artifact id", () => {
    expect(linkedImageSrc(MAP)).toBe("/artifacts/6afc784fe283102b6482b693");
  });

  it("keeps a workspace picture on the workspace route", () => {
    const href = "/conversations/conv-1/workspace/plots/ndvi.png";
    expect(linkedImageSrc(href)).toBe(href);
  });

  it("does not treat a report or a data file as a picture", () => {
    expect(linkedImageSrc(REPORT)).toBeUndefined();
    expect(
      linkedImageSrc("/artifacts/6afc7815e283102b6482b638/burnt_areas.geojson"),
    ).toBeUndefined();
  });
});

describe("workspaceMarkdownHrefs", () => {
  it("lists each report once and skips pictures", () => {
    const text = `[here](${REPORT}) and [again](${REPORT}) ![map](${MAP})`;
    expect(workspaceMarkdownHrefs(text)).toEqual([REPORT]);
  });
});
