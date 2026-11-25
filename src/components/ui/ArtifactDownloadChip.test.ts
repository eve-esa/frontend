import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A link in an answer becomes a download chip only when it names a stored
 * file the API serves: an artifact, or a workspace file the backend saved.
 * The chip fetches it with the token; a plain link would open the site.
 */

vi.mock("@/services/axios", () => ({ default: { get: vi.fn() } }));

import { downloadFilename, isArtifactDownloadLink } from "./ArtifactDownloadChip";

const PAGE = "https://app.example.test";
const CONVERSATION = "6b0449a298c0509f35a02337";
const WORKSPACE = `/conversations/${CONVERSATION}/workspace`;

beforeEach(() => {
  vi.stubGlobal("window", { location: { origin: PAGE } });
  vi.stubEnv("VITE_API_URL", "/api");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("isArtifactDownloadLink", () => {
  it.each([
    "/artifacts/6b044ad3b21a904b8785b71b",
    "/artifacts/6b044ad3b21a904b8785b71b/",
    `${WORKSPACE}/ndsi_pre.png`,
    `${WORKSPACE}/flood_indonesia_proper/flood_map_ki.png`,
    `${WORKSPACE}/my%20plot%231.csv`,
  ])("downloads %s", (href) => {
    expect(isArtifactDownloadLink(href)).toBe(true);
  });

  it.each([
    undefined,
    "/artifacts/abc/url",
    "/workspace/flood_indonesia_visible/ndsi_pre_visible.png",
    "ndsi_pre_visible.png",
    "file:///workspace/ndsi_pre_visible.png",
    `${WORKSPACE}/`,
    `${WORKSPACE}/out/`,
    `${WORKSPACE}/../secrets.txt`,
    `${WORKSPACE}/a//b.png`,
    `${WORKSPACE}/a.png?x=1`,
    `//attacker.test${WORKSPACE}/a.png`,
    `https://attacker.test${WORKSPACE}/a.png`,
  ])("leaves %s a plain link", (href) => {
    expect(isArtifactDownloadLink(href)).toBe(false);
  });
});

describe("downloadFilename", () => {
  it("names a workspace file after the file, not the link text", () => {
    expect(downloadFilename(`${WORKSPACE}/out/ndsi_pre.png`, "Download here")).toBe(
      "ndsi_pre.png",
    );
    expect(downloadFilename(`${WORKSPACE}/my%20plot%231.csv`)).toBe("my plot#1.csv");
  });

  it("names an artifact after the link text", () => {
    expect(downloadFilename("/artifacts/abc", "chart.png")).toBe("chart.png");
    expect(downloadFilename("/artifacts/abc")).toBe("artifact");
  });
});
