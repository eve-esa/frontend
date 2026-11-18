import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi } from "vitest";
import { QUERY_KEYS } from "@/services/keys";
import type { FileListing, Sandbox } from "@/types";
import { conversationFileUrl } from "@/services/useSandbox";
import { SandboxExplorer, liveError, relativeTime } from "./SandboxExplorer";

/**
 * Rendered on the server with the cache already filled, so no request runs: the panel reads
 * what the three queries hold.
 */
vi.mock("@/services/axios", () => ({
  default: { get: vi.fn(() => new Promise(() => undefined)) },
}));

const CONVERSATION = "6ab522e6b3d679705f5b340a";

const sandbox = (overrides: Partial<Sandbox> = {}): Sandbox => ({
  status: "idle",
  provider: "agentcore",
  sandbox_id: "s-123",
  inflight: 0,
  created_at: "2026-11-18T16:00:00Z",
  expires_at: "2026-11-18T17:00:00Z",
  idle_deadline: "2026-11-18T16:20:00Z",
  skills_digest: null,
  ...overrides,
});

const listing = (paths: string[], truncated = false): FileListing => ({
  items: paths.map((path) => ({ path, size: 2048, modified_at: null })),
  truncated,
});

const render = ({
  status,
  live,
  saved,
}: {
  status: Sandbox;
  live?: FileListing;
  saved?: FileListing;
}) => {
  const client = new QueryClient();
  client.setQueryData([QUERY_KEYS.sandbox, CONVERSATION], status);
  if (live) client.setQueryData([QUERY_KEYS.sandboxFiles, CONVERSATION], live);
  if (saved) client.setQueryData([QUERY_KEYS.conversationFiles, CONVERSATION], saved);
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <SandboxExplorer onToggle={() => undefined} conversationId={CONVERSATION} />
    </QueryClientProvider>,
  );
};

const httpError = (status: number) =>
  new AxiosError("failed", String(status), undefined, undefined, {
    status,
    statusText: "",
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

describe("SandboxExplorer", () => {
  it("shows the status, the live tree and the saved tree", () => {
    const html = render({
      status: sandbox(),
      live: listing(["workspace/out/plot.png", "skills/demo/SKILL.md"]),
      saved: listing(["workspace/out/plot.png", "workspace_state"]),
    });

    expect(html).toContain("Idle");
    expect(html).toContain("s-123");
    expect(html).toContain("agentcore");
    expect(html).toContain('data-testid="sandbox-live-files"');
    expect(html).toContain('data-testid="sandbox-saved-files"');
    expect(html).toContain("Live sandbox (2)");
    expect(html).toContain("skills/");
    expect(html).toContain("plot.png");
    expect(html).toContain("2.0 KB");
    // Saved files download, live ones do not.
    expect(html.match(/aria-label="Download /g)).toHaveLength(2);
    expect(html).toContain('aria-label="Download workspace_state"');
  });

  it("says a sandbox is running a turn", () => {
    const html = render({
      status: sandbox({ status: "busy", inflight: 1 }),
      live: listing([]),
      saved: listing([]),
    });
    expect(html).toContain("Running a turn");
    expect(html).toContain("No files.");
  });

  it.each<[Sandbox["status"], string]>([
    ["none", "No sandbox running for this conversation."],
    ["disabled", "This environment runs no sandbox."],
  ])("does not list a live tree with status %s", (status, text) => {
    const html = render({
      status: sandbox({ status, provider: null, sandbox_id: null }),
      saved: listing(["workspace/a.txt"]),
    });
    expect(html).toContain(text);
    expect(html).not.toContain('data-testid="sandbox-live-files"');
    expect(html).toContain('data-testid="sandbox-saved-files"');
  });

  it("says when a listing is truncated", () => {
    const html = render({
      status: sandbox(),
      live: listing(["workspace/a.txt"], true),
      saved: listing([]),
    });
    expect(html).toContain("Showing the first 1 files; there are more.");
  });
});

describe("liveError", () => {
  it("explains an ended sandbox", () => {
    expect(liveError(httpError(410))).toContain("The sandbox has ended");
  });

  it("explains a missing sandbox", () => {
    expect(liveError(httpError(404))).toBe("No sandbox for this conversation.");
  });

  it("names the status of any other failure", () => {
    expect(liveError(httpError(502))).toBe("Could not read the sandbox (502).");
    expect(liveError(new Error("boom"))).toBe("Could not read the sandbox.");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-11-18T16:00:00Z");

  it("reads ahead and behind in minutes and hours", () => {
    expect(relativeTime("2026-11-18T16:08:00Z", now)).toBe("in 8 minutes");
    expect(relativeTime("2026-11-18T15:57:00Z", now)).toBe("3 minutes ago");
    expect(relativeTime("2026-11-18T18:00:00Z", now)).toBe("in 2 hours");
  });
});

describe("conversationFileUrl", () => {
  it("encodes each segment and keeps the slashes", () => {
    expect(conversationFileUrl("c1", "workspace/my plot#1.png")).toBe(
      "/conversations/c1/files/workspace/my%20plot%231.png",
    );
  });
});
