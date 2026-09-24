import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";

/**
 * The menu items live in Radix menu content that only renders once opened, and
 * never on the server, so the Menubar kit is replaced by plain elements that
 * always render their children. What is under test is which items exist.
 */
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

const noop = () => undefined;

const render = async (flag: string | undefined, withHandler = true) => {
  stubRuntimeConfig(flag === undefined ? {} : { FEATURE_REPORT_BUG: flag });
  const { ProfileMenubar } = await import("./ProfileMenubar");
  return renderToStaticMarkup(
    <ProfileMenubar
      email="dev@eve.example.com"
      isOpen={true}
      isLoadingProfile={false}
      onProfileClick={noop}
      onCO2eqClick={noop}
      onLogoutClick={noop}
      onReportBugClick={withHandler ? noop : undefined}
    />,
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ProfileMenubar report a bug entry", () => {
  it("is absent when FEATURE_REPORT_BUG is unset", async () => {
    const html = await render(undefined);
    expect(html).toContain("Logout");
    expect(html).not.toContain("Report a bug");
  });

  it("is absent when FEATURE_REPORT_BUG is false", async () => {
    expect(await render("false")).not.toContain("Report a bug");
  });

  it("is there when FEATURE_REPORT_BUG is true", async () => {
    expect(await render("true")).toContain("Report a bug");
  });

  it("is absent without a handler even with the flag on", async () => {
    expect(await render("true", false)).not.toContain("Report a bug");
  });
});
