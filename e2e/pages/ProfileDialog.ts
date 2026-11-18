import { expect, type Locator, type Page } from "@playwright/test";
import type { ChatPage } from "./ChatPage";
import { isSettingsUrl, settingsPageOn } from "./SettingsPage";

export type ProfileFields = {
  email: string;
  firstName: string;
  lastName: string;
  country: string | null;
  institution: string | null;
};

/**
 * Country is a select of country names: pick by label, "" picks the empty choice. A stored
 * country outside the list is one of the options, so restoring it works the same way.
 */
export const pickCountry = async (select: Locator, country: string): Promise<void> => {
  await select.selectOption(country === "" ? { value: "" } : { label: country });
};

/**
 * The profile form. With FEATURE_SETTINGS_PAGE off it is the dialog opened from the user menu;
 * with it on, the Profile section of the settings page (same `profile-*` field testids, Save
 * is `settings-profile-save`, there is no Cancel). `close` leaves either one.
 */
export class ProfileDialog {
  readonly root: Locator;
  readonly email: Locator;
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly country: Locator;
  readonly institution: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  /** Where the test was before `open` went to the settings page, so `close` can return. */
  private returnTo: string | null = null;

  constructor(
    private readonly page: Page,
    private readonly chat: ChatPage,
  ) {
    this.root = page.getByTestId("profile-dialog").or(page.getByTestId("settings-section-profile"));
    this.email = page.getByTestId("profile-email");
    this.firstName = page.getByTestId("profile-first-name");
    this.lastName = page.getByTestId("profile-last-name");
    this.country = page.getByTestId("profile-country");
    this.institution = page.getByTestId("profile-institution");
    this.saveButton = page.getByTestId("profile-save").or(page.getByTestId("settings-profile-save"));
    this.cancelButton = page.getByTestId("profile-cancel");
  }

  /** True when the form is a settings page section, false when it is the dialog. */
  async usesPage(): Promise<boolean> {
    return settingsPageOn(await this.chat.servedConfig());
  }

  async open(): Promise<void> {
    if (await this.usesPage()) {
      if (!/\/settings\/profile$/.test(new URL(this.page.url()).pathname)) {
        if (isSettingsUrl(this.page.url())) {
          await this.page.getByTestId("settings-nav-profile").click();
        } else {
          this.returnTo = this.page.url();
          await this.chat.openUserMenuItem("user-menu-settings");
        }
        await expect(this.page).toHaveURL(/\/settings\/profile$/);
      }
    } else {
      await this.chat.openUserMenuItem("user-menu-profile");
    }
    await expect(this.root).toBeVisible();
    await expect(this.email).not.toHaveValue("");
  }

  async read(): Promise<ProfileFields> {
    const optional = async (field: Locator) =>
      (await field.isVisible()) ? await field.inputValue() : null;
    return {
      email: await this.email.inputValue(),
      firstName: await this.firstName.inputValue(),
      lastName: await this.lastName.inputValue(),
      country: await optional(this.country),
      institution: await optional(this.institution),
    };
  }

  async fill(fields: Partial<Omit<ProfileFields, "email">>): Promise<void> {
    if (fields.firstName !== undefined) await this.firstName.fill(fields.firstName);
    if (fields.lastName !== undefined) await this.lastName.fill(fields.lastName);
    if (fields.country != null) await pickCountry(this.country, fields.country);
    if (fields.institution != null) await this.institution.fill(fields.institution);
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    if (await this.usesPage()) {
      await expect(this.page.getByTestId("settings-profile-status")).toHaveText("Saved.");
    } else {
      await expect(this.root).toBeHidden();
    }
  }

  /** Cancels the dialog, or leaves the settings page for the page the test came from. */
  async close(): Promise<void> {
    if (await this.usesPage()) {
      if (this.returnTo !== null) {
        const back = this.returnTo;
        this.returnTo = null;
        await this.page.goto(back);
        await this.chat.composer.waitReady();
      }
      return;
    }
    await this.cancelButton.click();
    await expect(this.root).toBeHidden();
  }
}
