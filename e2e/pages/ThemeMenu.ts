import { expect, type Locator, type Page } from "@playwright/test";
import { flagOn, type ChatPage } from "./ChatPage";
import { isSettingsUrl, settingsPageOn } from "./SettingsPage";

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

  /** The theme option inside the user menu. Only there with FEATURE_SETTINGS_PAGE off. */
  option(choice: ThemeChoice): Locator {
    return this.page.getByTestId(`theme-option-${choice}`);
  }

  /** The theme radio of `/settings/appearance`. Only there with FEATURE_SETTINGS_PAGE on. */
  radio(choice: ThemeChoice): Locator {
    return this.page.getByTestId(`settings-theme-${choice}`);
  }

  /** True when the theme is chosen in the user menu, false when through the settings page. */
  async inUserMenu(): Promise<boolean> {
    return !settingsPageOn(await this.chat.servedConfig());
  }

  /**
   * Runs `work` on the settings page, reached from the user menu, then returns to the page the
   * test was on: the specs go on from the chat after a pick.
   */
  private async onSettingsPage<T>(work: () => Promise<T>): Promise<T> {
    const back = this.page.url();
    const alreadyThere = isSettingsUrl(back);
    if (!alreadyThere) await this.chat.openUserMenuItem("user-menu-settings");
    await expect(this.page.getByTestId("settings-page")).toBeVisible();
    try {
      return await work();
    } finally {
      if (!alreadyThere) {
        await this.page.goto(back);
        await this.chat.composer.waitReady();
      }
    }
  }

  /**
   * Picks a theme. With the settings page off: opens the user menu, which closes on the pick.
   * With it on: the radio of Appearance, then back to the page the test was on.
   */
  async pick(choice: ThemeChoice): Promise<void> {
    if (await this.inUserMenu()) {
      await this.chat.userMenu.click();
      await this.option(choice).click();
      await expect(this.option(choice)).toBeHidden();
      return;
    }
    await this.onSettingsPage(async () => {
      await this.page.getByTestId("settings-nav-appearance").click();
      await expect(this.page.getByTestId("settings-section-appearance")).toBeVisible();
      await this.radio(choice).check();
      await expect(this.radio(choice)).toBeChecked();
    });
  }

  /**
   * Whether the target offers a theme choice: the group in the user menu, or the Appearance
   * section of the settings page. Leaves the page as it found it.
   */
  async isOffered(): Promise<boolean> {
    if (!(await this.inUserMenu())) {
      return this.onSettingsPage(
        async () => (await this.page.getByTestId("settings-nav-appearance").count()) > 0,
      );
    }
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
