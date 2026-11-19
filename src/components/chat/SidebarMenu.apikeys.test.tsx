// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";

/**
 * With FEATURE_SETTINGS_PAGE on, API keys live only in the Settings section, so the sidebar has
 * no API keys item. With it off, the item opens the API keys dialog. Siblings that fetch or pull
 * in the page tree are stubbed; the dialog stub shows whether it is open.
 */
vi.mock("@/services/axios", () => ({ default: { post: vi.fn() } }));
vi.mock("@/services/useMe", () => ({
  useGetProfile: () => ({ data: { email: "dev@eve.example.com" }, isLoading: false }),
}));
vi.mock("@/components/auth/LogoutDialog", () => ({ LogoutDialog: () => null }));
vi.mock("@/components/profile/ProfileDialog", () => ({ ProfileDialog: () => null }));
vi.mock("@/components/profile/CO2eqDialog", () => ({ CO2eqDialog: () => null }));
vi.mock("@/components/api-keys/ApiKeysDialog", () => ({
  ApiKeysDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="api-keys-dialog-stub" /> : null,
}));
vi.mock("./KnowledgeBaseMenuBar", () => ({ KnowledgeBaseMenuBar: () => null }));
vi.mock("./ToolkitsMenuBar", () => ({ ToolkitsMenuBar: () => null }));
vi.mock("./ProfileMenubar", () => ({ ProfileMenubar: () => null }));
vi.mock("@/utilities/routes", () => ({ routes: { ARTIFACTS: { path: "/artifacts" } } }));
vi.mock("@/components/ui/Tooltip", () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const mount = async (config: Record<string, string>) => {
  stubRuntimeConfig(config);
  const { SidebarMenu } = await import("./SidebarMenu");
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SidebarMenu isOpen={true} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("SidebarMenu API keys item", () => {
  it("is absent with the Settings page on, API keys on or off", async () => {
    await mount({ FEATURE_SETTINGS_PAGE: "true", FEATURE_API_KEYS: "true" });
    expect(screen.queryByTestId("sidebar-api-keys")).toBeNull();
  });

  it("is present with the Settings page off and opens the dialog", async () => {
    await mount({ FEATURE_SETTINGS_PAGE: "false", FEATURE_API_KEYS: "true" });
    const item = screen.getByTestId("sidebar-api-keys");
    expect(screen.queryByTestId("api-keys-dialog-stub")).toBeNull();
    fireEvent.click(item);
    expect(screen.getByTestId("api-keys-dialog-stub")).toBeTruthy();
  });

  it("is absent with API keys off", async () => {
    await mount({ FEATURE_SETTINGS_PAGE: "false", FEATURE_API_KEYS: "false" });
    expect(screen.queryByTestId("sidebar-api-keys")).toBeNull();
  });
});
