import { expect, type Locator, type Page } from "@playwright/test";
import { flagOn, type ChatPage } from "./ChatPage";

export type ThemeChoice = "system" | "light" | "dark";

/**
 * Whether the target serves the theme switch. Read from the injected config; the dev server
 * injects none, so locally `E2E_THEME_SWITCH=true` says the flag is on (compose default).
 */
export function themeSwitchOn(config: Record<string, string>): boolean {
  if (config.FEATURE_THEME_SWITCH !== undefined) {
    return flagOn(config, "FEATURE_THEME_SWITCH", false);
  }
  return process.env.E2E_THEME_SWITCH === "true";
}

/** System, Light and Dark in the user menu, and the theme the page shows. */
export class ThemeMenu {
  constructor(
    private readonly page: Page,
    private readonly chat: ChatPage,
  ) {}

  option(choice: ThemeChoice): Locator {
    return this.page.getByTestId(`theme-option-${choice}`);
  }

  /** Opens the user menu and picks a theme; the menu closes on the pick. */
  async pick(choice: ThemeChoice): Promise<void> {
    await this.chat.userMenu.click();
    await this.option(choice).click();
    await expect(this.option(choice)).toBeHidden();
  }

  /** Whether the user menu offers the theme group. Leaves the menu closed. */
  async isOffered(): Promise<boolean> {
    await this.chat.userMenu.click();
    await expect(this.page.getByTestId("user-menu-profile")).toBeVisible();
    const offered = (await this.option("system").count()) > 0;
    await this.page.keyboard.press("Escape");
    await expect(this.page.getByTestId("user-menu-profile")).toBeHidden();
    return offered;
  }

  /** `<html data-theme>`, or null when the app set none (flag off). */
  current(): Promise<string | null> {
    return this.page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  }

  /** The choice persisted in local storage, or null. */
  stored(): Promise<string | null> {
    return this.page.evaluate(() => localStorage.getItem("theme"));
  }

  async expectTheme(theme: "light" | "dark"): Promise<void> {
    await expect.poll(() => this.current()).toBe(theme);
  }
}
