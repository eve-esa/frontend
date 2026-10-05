import { expect, type Locator, type Page } from "@playwright/test";
import type { ChatPage } from "./ChatPage";

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

/** Profile dialog, opened from the user menu. */
export class ProfileDialog {
  readonly root: Locator;
  readonly email: Locator;
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly country: Locator;
  readonly institution: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page, private readonly chat: ChatPage) {
    this.root = page.getByTestId("profile-dialog");
    this.email = page.getByTestId("profile-email");
    this.firstName = page.getByTestId("profile-first-name");
    this.lastName = page.getByTestId("profile-last-name");
    this.country = page.getByTestId("profile-country");
    this.institution = page.getByTestId("profile-institution");
    this.saveButton = page.getByTestId("profile-save");
    this.cancelButton = page.getByTestId("profile-cancel");
  }

  async open(): Promise<void> {
    await this.chat.openUserMenuItem("user-menu-profile");
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
    await expect(this.root).toBeHidden();
  }

  async close(): Promise<void> {
    await this.cancelButton.click();
    await expect(this.root).toBeHidden();
  }
}
