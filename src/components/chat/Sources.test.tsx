import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Document } from "@/types";

/**
 * The Sources panel lists one group per retrieved document. Untitled
 * documents used to collapse into a single "Title not available" group.
 */
vi.mock("@/services/useLogSourceClick", () => ({
  useLogSourceClick: () => ({ mutate: () => undefined }),
}));
vi.mock("./SourceContent", () => ({
  SourceContent: ({ source }: { source: Document }) => (
    <p data-testid="source-chunk">{String(source.id)}</p>
  ),
}));

const chunk = (id: string, link: string, title: string | null = null) =>
  ({
    id,
    text: `body ${id}`,
    collection_name: "qwen-512-filtered",
    payload: { title, url: link },
    metadata: { additionalMetadata: { title, link } },
  }) as unknown as Document;

const render = async (sources: Document[]) => {
  const { Sources } = await import("./Sources");
  return renderToStaticMarkup(
    <MemoryRouter>
      <Sources onToggle={() => undefined} sources={sources} messageId="m1" />
    </MemoryRouter>,
  );
};

const titles = (html: string) =>
  [...html.matchAll(/data-testid="source-title"[^>]*>[\s\S]*?<\/svg>([^<]*)</g)].map(
    (m) => m[1],
  );
const chunkCount = (html: string) =>
  html.match(/data-testid="source-chunk"/g)?.length ?? 0;

describe("Sources", () => {
  it("renders two untitled documents as two groups", async () => {
    const html = await render([
      chunk("1", "https://example.org/a"),
      chunk("2", "https://example.org/b"),
    ]);
    expect(titles(html)).toEqual(["Title not available", "Title not available"]);
    expect(chunkCount(html)).toBe(2);
  });

  it("renders two chunks of one document as one group", async () => {
    const html = await render([
      chunk("1", "https://example.org/a", "Sea ice extent"),
      chunk("2", "https://example.org/a", "Sea ice extent"),
    ]);
    expect(titles(html)).toEqual(["Sea ice extent"]);
    expect(chunkCount(html)).toBe(2);
    expect(html).toContain("Sources (2)");
  });
});
