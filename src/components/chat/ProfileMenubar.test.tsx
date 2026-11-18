import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import type { ConfigKey } from "@/utilities/runtimeConfig";

/**
 * The user menu with FEATURE_SETTINGS_PAGE on and off. The Menubar kit renders its content inline
 * (Radix menu content never renders on the server), so every item is in the markup. Under test is
 * which items are there, in which order, and the labels.
 */
vi.mock("@/components/ui/Menubar", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Item = ({
    children,
    ...props
  }: {
    children?: ReactNode;
    "data-testid"?: string;
  }) => (
    <div role="menuitem" data-testid={props["data-testid"]}>
      {children}
    </div>
  );
  return {
    Menubar: Pass,
    MenubarMenu: Pass,
    MenubarTrigger: Pass,
    MenubarContent: Pass,
    MenubarItem: Item,
    MenubarLabel: Pass,
    MenubarRadioGroup: Pass,
    MenubarRadioItem: Pass,
    MenubarSeparator: () => <hr />,
  };
});

const noop = () => undefined;

const menuTexts = async (config: Partial<Record<ConfigKey, string>>) => {
  stubRuntimeConfig(config);
  const { ProfileMenubar } = await import("./ProfileMenubar");
  const html = renderToStaticMarkup(
    <ProfileMenubar
      isOpen={true}
      isLoadingProfile={false}
      email="dev@eve.example.com"
      onProfileClick={noop}
      onSettingsClick={noop}
      onCO2eqClick={noop}
      onLogoutClick={noop}
    />
  );
  return {
    html,
    items: [
      ...html.matchAll(/<div role="menuitem"[^>]*>(?:<span[^>]*>)?([^<]*)/g),
    ].map((m) => m[1].trim()),
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ProfileMenubar", () => {
  it("is today's menu with FEATURE_SETTINGS_PAGE off, theme group included", async () => {
    const { html, items } = await menuTexts({ FEATURE_THEME_SWITCH: "true" });
    expect(items).toEqual([
      "Profile",
      "CO2eq",
      "About Us",
      "Contact Us",
      "Privacy Policy",
      "Logout",
    ]);
    expect(html).toContain("Theme");
    expect(html).not.toContain("user-menu-settings");
  });

  it("is today's menu when FEATURE_SETTINGS_USAGE is on but the page is off", async () => {
    const { items } = await menuTexts({ FEATURE_SETTINGS_USAGE: "true" });
    expect(items).toEqual([
      "Profile",
      "CO2eq",
      "About Us",
      "Contact Us",
      "Privacy Policy",
      "Logout",
    ]);
  });

  it("holds Settings, About us, Contact us, Privacy policy and Log out with the page and Usage on", async () => {
    const { html, items } = await menuTexts({
      FEATURE_SETTINGS_PAGE: "true",
      FEATURE_SETTINGS_USAGE: "true",
      FEATURE_THEME_SWITCH: "true",
    });
    expect(items).toEqual([
      "Settings",
      "About us",
      "Contact us",
      "Privacy policy",
      "Log out",
    ]);
    expect(html).toContain('data-testid="user-menu-settings"');
    expect(html).not.toContain("user-menu-profile");
    expect(html).not.toContain("Theme");
    expect(html).not.toContain("theme-option");
  });

  it("keeps CO2eq in the menu with the page on and Usage off", async () => {
    const { items } = await menuTexts({ FEATURE_SETTINGS_PAGE: "true" });
    expect(items).toEqual([
      "Settings",
      "CO2eq",
      "About us",
      "Contact us",
      "Privacy policy",
      "Log out",
    ]);
  });
});
