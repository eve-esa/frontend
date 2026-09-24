import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";

/**
 * Only the report a bug entries are under test. Every sibling that fetches,
 * needs a provider or pulls in the whole page tree is replaced by a stub, and
 * the Menubar kit renders its content inline (Radix menu content never
 * renders on the server), so the profile menu item is visible too.
 */
vi.mock("@/services/axios", () => ({ default: { post: vi.fn() } }));
vi.mock("@/services/useMe", () => ({
  useGetProfile: () => ({
    data: { email: "dev@eve.example.com" },
    isLoading: false,
  }),
}));
vi.mock("@/components/auth/LogoutDialog", () => ({ LogoutDialog: () => null }));
vi.mock("@/components/profile/ProfileDialog", () => ({
  ProfileDialog: () => null,
}));
vi.mock("@/components/profile/CO2eqDialog", () => ({ CO2eqDialog: () => null }));
vi.mock("@/components/api-keys/ApiKeysDialog", () => ({
  ApiKeysDialog: () => null,
}));
vi.mock("./KnowledgeBaseMenuBar", () => ({ KnowledgeBaseMenuBar: () => null }));
vi.mock("./ToolkitsMenuBar", () => ({ ToolkitsMenuBar: () => null }));
vi.mock("@/utilities/routes", () => ({
  routes: { ARTIFACTS: { path: "/artifacts" } },
}));
vi.mock("@/components/ui/Menubar", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Item = ({ children }: { children?: ReactNode }) => (
    <div role="menuitem">{children}</div>
  );
  return {
    Menubar: Pass,
    MenubarMenu: Pass,
    MenubarTrigger: Pass,
    MenubarContent: Pass,
    MenubarItem: Item,
  };
});

const render = async (flag?: string) => {
  stubRuntimeConfig(flag === undefined ? {} : { FEATURE_REPORT_BUG: flag });
  const { SidebarMenu } = await import("./SidebarMenu");
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SidebarMenu isOpen={true} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const count = (html: string, text: string) => html.split(text).length - 1;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("SidebarMenu report a bug entries", () => {
  it("renders none when FEATURE_REPORT_BUG is unset", async () => {
    const html = await render();
    expect(html).toContain("API keys");
    expect(html).not.toContain("Report a bug");
  });

  it("renders none when FEATURE_REPORT_BUG is false", async () => {
    expect(await render("false")).not.toContain("Report a bug");
  });

  it("renders the sidebar item and the profile menu item when true", async () => {
    const html = await render("true");
    expect(html).toContain('data-testid="sidebar-report-bug"');
    // Sidebar item: aria-label plus its visible label; profile menu: one item.
    expect(count(html, "Report a bug")).toBe(3);
    expect(html).toMatch(/role="menuitem"><span>Report a bug<\/span>/);
  });
});
