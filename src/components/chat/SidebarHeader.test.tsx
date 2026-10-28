import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";

/**
 * The logo at the top of the open sidebar is a link home, the empty chat page
 * that New chat opens. The collapsed rail keeps its logo as the open sidebar
 * control, so it carries no home link. Click behaviour (the New chat handler)
 * is covered by the e2e navigation spec; this checks the markup only.
 */
vi.mock("@/utilities/routes", () => ({
  routes: { EMPTY_CHAT: { path: "/" } },
}));

const render = async (isOpen: boolean) => {
  stubRuntimeConfig({});
  const { SidebarHeader } = await import("./SidebarHeader");
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/chat/abc"]}>
      <SidebarHeader
        isOpen={isOpen}
        isMobile={false}
        onToggle={vi.fn()}
        handleNewChat={vi.fn()}
        onDiscoverEve={vi.fn()}
      />
    </MemoryRouter>,
  );
};

describe("SidebarHeader logo", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("links home with an accessible name when the sidebar is open", async () => {
    const html = await render(true);
    const anchor = html.match(/<a [^>]*data-testid="brand-home-link"[^>]*>/)?.[0];
    expect(anchor).toBeDefined();
    expect(anchor).toContain('href="/"');
    expect(anchor).toContain('aria-label="EVE home"');
  });

  it("keeps the collapsed rail logo as the open sidebar control", async () => {
    const html = await render(false);
    expect(html).not.toContain('data-testid="brand-home-link"');
  });
});
