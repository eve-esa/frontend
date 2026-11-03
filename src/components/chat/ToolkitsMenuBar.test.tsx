import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/useGetMcpServers", () => ({
  useGetMcpServers: () => ({
    data: {
      pages: [{ data: [{ name: "eve_retrieval", enabled: true }] }],
    },
    isPending: false,
    isError: false,
  }),
}));

vi.mock("@/components/onboarding/TourContext", () => ({
  useTour: () => ({ isRunning: false }),
}));

vi.mock("./DynamicSidebarProvider", () => ({
  useSidebar: () => ({
    openDynamicSidebar: () => undefined,
    content: null,
    isOpenDynamicSidebar: false,
  }),
}));

vi.mock("@/components/ui/Menubar", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Item = ({
    children,
    ...props
  }: { children?: ReactNode } & Record<string, unknown>) => (
    <button type="button" {...props}>
      {children}
    </button>
  );
  return {
    Menubar: Pass,
    MenubarMenu: Pass,
    MenubarTrigger: Pass,
    MenubarContent: Pass,
    MenubarItem: Item,
  };
});

describe("Toolkits menu", () => {
  it("opens the shared toolkits panel", async () => {
    const { ToolkitsMenuBar } = await import("./ToolkitsMenuBar");
    const html = renderToStaticMarkup(<ToolkitsMenuBar isOpen={true} />);

    expect(html).toContain("Shared toolkits");
    expect(html).toContain('data-testid="sidebar-toolkits-shared"');
    expect(html).not.toContain('data-testid="sidebar-toolkits-skills"');
  });
});
