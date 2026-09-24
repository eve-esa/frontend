import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";

/**
 * The report a bug entry belongs to a conversation (its header and the error
 * under a failed turn), never to the app level sidebar or profile
 * menu, where a report would carry no conversation or message. Under test is
 * that neither shows one, whatever the flag says. Every sibling that fetches,
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("SidebarMenu has no report a bug entry", () => {
  it.each([undefined, "false", "true"])(
    "with FEATURE_REPORT_BUG %s, in the sidebar and in the profile menu",
    async (flag) => {
      const html = await render(flag);
      expect(html).toContain("API keys");
      expect(html).toMatch(/role="menuitem"><span[^>]*>Logout<\/span>/);
      expect(html).not.toContain("Report a bug");
      expect(html).not.toContain("report-bug");
    },
  );
});
