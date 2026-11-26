import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The Toolkits section of the settings page (FEATURE_TOOLKIT_CREDENTIALS): one row per toolkit
 * that accepts the user's own credentials, with a form dialog and a remove dialog.
 * Field values go through `fill` only: nothing here logs or returns them.
 */
export class ToolkitCredentialsSection {
  readonly dialog: Locator;
  readonly form: Locator;
  readonly save: Locator;
  readonly error: Locator;
  readonly removeDialog: Locator;
  readonly removeConfirm: Locator;

  constructor(
    private readonly page: Page,
    private readonly toolkit: string,
  ) {
    this.dialog = page.getByTestId("settings-toolkits-dialog");
    this.form = page.getByTestId("settings-toolkits-form");
    this.save = page.getByTestId("settings-toolkits-save");
    this.error = page.getByTestId("settings-toolkits-error");
    this.removeDialog = page.getByTestId("settings-toolkits-remove-dialog");
    this.removeConfirm = page.getByTestId("settings-toolkits-remove-confirm");
  }

  row(): Locator {
    return this.page.getByTestId(`settings-toolkits-row-${this.toolkit}`);
  }

  status(): Locator {
    return this.page.getByTestId(`settings-toolkits-status-${this.toolkit}`);
  }

  addButton(): Locator {
    return this.page.getByTestId(`settings-toolkits-add-${this.toolkit}`);
  }

  removeButton(): Locator {
    return this.page.getByTestId(`settings-toolkits-remove-${this.toolkit}`);
  }

  field(name: string): Locator {
    return this.page.getByTestId(`settings-toolkits-field-${name}`);
  }

  /** Opens the form dialog from the row's Add or Replace button. */
  async openForm(): Promise<void> {
    await expect(this.row()).toBeVisible();
    await this.addButton().click();
    await expect(this.dialog).toBeVisible();
    await expect(this.form).toBeVisible();
  }

  async fillField(name: string, value: string): Promise<void> {
    await this.field(name).fill(value);
  }

  /** Clicks Save and returns the response of the credentials PUT or POST. */
  async submit(): Promise<number> {
    const saved = this.page.waitForResponse(
      (response) =>
        response.request().method() !== "GET" &&
        /\/mcp-servers\/[^/]+\/credentials$/.test(new URL(response.url()).pathname),
    );
    await this.save.click();
    return (await saved).status();
  }

  /** Remove, then confirm in the dialog. Returns the DELETE status. */
  async remove(): Promise<number> {
    await this.removeButton().click();
    await expect(this.removeDialog).toBeVisible();
    const deleted = this.page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        /\/mcp-servers\/[^/]+\/credentials$/.test(new URL(response.url()).pathname),
    );
    await this.removeConfirm.click();
    return (await deleted).status();
  }
}
