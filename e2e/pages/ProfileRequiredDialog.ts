import { expect, type Locator, type Page } from "@playwright/test";
import { pickCountry } from "./ProfileDialog";

/**
 * The dialog that asks for country and institution before the chat, with
 * FEATURE_PROFILE_FIELDS on and either missing. It cannot be dismissed.
 */
export class ProfileRequiredDialog {
  readonly root: Locator;
  readonly country: Locator;
  readonly institution: Locator;
  readonly saveButton: Locator;
  readonly logoutButton: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByTestId("profile-required-dialog");
    this.country = page.getByTestId("profile-required-country");
    this.institution = page.getByTestId("profile-required-institution");
    this.saveButton = page.getByTestId("profile-required-save");
    this.logoutButton = page.getByTestId("profile-required-logout");
  }

  isOpen(): Promise<boolean> {
    return this.root.isVisible();
  }

  async fill(fields: { country: string; institution: string }): Promise<void> {
    await pickCountry(this.country, fields.country);
    await this.institution.fill(fields.institution);
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await expect(this.root).toBeHidden();
  }
}
