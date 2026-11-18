import { expect, type Locator, type Page } from "@playwright/test";
import { flagOrEnvOn, type ChatPage } from "./ChatPage";

export const SETTINGS_SECTION_IDS = [
  "profile",
  "appearance",
  "models",
  "usage",
  "api-keys",
  "account",
] as const;

/**
 * Whether the target serves the settings page. With it on, the user menu has Settings and no
 * Profile or Theme group: those controls live under `/settings/profile` and
 * `/settings/appearance`. Locally `E2E_SETTINGS_PAGE=true` says the flag is on.
 */
export function settingsPageOn(config: Record<string, string>): boolean {
  return flagOrEnvOn(config, "FEATURE_SETTINGS_PAGE", false);
}

/** Whether a URL is the settings page or one of its sections. */
export const isSettingsUrl = (url: string): boolean => /\/settings(\/|$)/.test(new URL(url).pathname);

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

/**
 * The settings page at `/settings/:section` (FEATURE_SETTINGS_PAGE), reached from the user menu.
 * Not the Control Panel side sheet: that one is `SettingsPanel`.
 */
export class SettingsPage {
  readonly root: Locator;
  readonly logout: Locator;
  readonly profileLastName: Locator;
  readonly profileSave: Locator;
  readonly profileStatus: Locator;

  constructor(
    private readonly page: Page,
    private readonly chat: ChatPage,
  ) {
    this.root = page.getByTestId("settings-page");
    this.logout = page.getByTestId("settings-logout");
    this.profileLastName = page.getByTestId("profile-last-name");
    this.profileSave = page.getByTestId("settings-profile-save");
    this.profileStatus = page.getByTestId("settings-profile-status");
  }

  nav(section: SettingsSectionId): Locator {
    return this.page.getByTestId(`settings-nav-${section}`);
  }

  section(section: SettingsSectionId): Locator {
    return this.page.getByTestId(`settings-section-${section}`);
  }

  themeOption(choice: "system" | "light" | "dark"): Locator {
    return this.page.getByTestId(`settings-theme-${choice}`);
  }

  /** Whether the list offers a section. Profile and Account are always there. */
  async offers(section: SettingsSectionId): Promise<boolean> {
    return (await this.nav(section).count()) > 0;
  }

  /** Opens the user menu, clicks Settings and waits for the first section. */
  async openFromUserMenu(): Promise<void> {
    await this.chat.openUserMenuItem("user-menu-settings");
    await expect(this.page).toHaveURL(/\/settings\/profile$/);
    await expect(this.section("profile")).toBeVisible();
  }

  /** Goes to a section by URL, as a bookmark or a reload would. */
  async goto(section: string): Promise<void> {
    await this.page.goto(`/settings/${section}`);
    await expect(this.root).toBeVisible();
  }

  async openSection(section: SettingsSectionId): Promise<void> {
    await this.nav(section).click();
    await expect(this.page).toHaveURL(new RegExp(`/settings/${section}$`));
    await expect(this.section(section)).toBeVisible();
  }

  /** The theme radio that is checked now, or null. */
  async checkedTheme(): Promise<"system" | "light" | "dark" | null> {
    for (const choice of ["system", "light", "dark"] as const) {
      if (await this.themeOption(choice).isChecked()) return choice;
    }
    return null;
  }

  /** `<html data-theme>`, or null when the app set none. */
  theme(): Promise<string | null> {
    return this.page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  }

  /** The API key rows of the API keys section, one per key. */
  apiKeyRows(): Locator {
    return this.page.getByTestId("settings-section-api-keys").getByTestId("api-key-row");
  }

  apiKeyRow(name: string): Locator {
    return this.apiKeyRows().filter({
      has: this.page.getByTestId("api-key-name").getByText(name, { exact: true }),
    });
  }
}
