import { expect, type Locator, type Page } from "@playwright/test";
import type { ChatPage } from "./ChatPage";

export type ApiKeyExpiry = "30" | "90" | "365" | "never";

/** API keys dialog, opened from the sidebar entry (FEATURE_API_KEYS). */
export class ApiKeysDialog {
  readonly root: Locator;
  readonly rows: Locator;
  readonly count: Locator;
  readonly closeButton: Locator;
  readonly createOpen: Locator;
  readonly nameInput: Locator;
  readonly createSubmit: Locator;
  readonly reveal: Locator;
  readonly secret: Locator;
  readonly secretDone: Locator;
  readonly usageSnippet: Locator;
  readonly quickstartToggle: Locator;
  readonly deleteConfirm: Locator;
  readonly deleteTarget: Locator;
  readonly deleteSubmit: Locator;

  constructor(private readonly page: Page, private readonly chat: ChatPage) {
    this.root = page.getByTestId("api-keys-dialog");
    this.rows = page.getByTestId("api-key-row");
    this.count = page.getByTestId("api-keys-count");
    this.closeButton = page.getByTestId("api-keys-close");
    this.createOpen = page.getByTestId("api-keys-create-open");
    this.nameInput = page.getByTestId("api-key-name-input");
    this.createSubmit = page.getByTestId("api-key-create-submit");
    this.reveal = page.getByTestId("api-key-secret-reveal");
    this.secret = page.getByTestId("api-key-secret");
    this.secretDone = page.getByTestId("api-key-secret-done");
    this.usageSnippet = page.getByTestId("api-keys-usage-snippet");
    this.quickstartToggle = page.getByTestId("api-keys-quickstart-toggle");
    this.deleteConfirm = page.getByTestId("api-key-delete-confirm");
    this.deleteTarget = page.getByTestId("api-key-delete-target");
    this.deleteSubmit = page.getByTestId("api-key-delete-confirm-submit");
  }

  isEntryVisible(): Promise<boolean> {
    return this.chat.apiKeysEntry.isVisible();
  }

  async open(): Promise<void> {
    await this.chat.apiKeysEntry.click();
    await expect(this.root).toBeVisible();
  }

  keyNames(): Promise<string[]> {
    return this.rows.getByTestId("api-key-name").allInnerTexts();
  }

  /** The native radio, visually hidden: read its state, click expiryOption instead. */
  expiryInput(value: ApiKeyExpiry): Locator {
    return this.page.getByTestId(`api-key-expiry-${value}`);
  }

  /** The visible tile the user clicks for an expiry. */
  expiryOption(value: ApiKeyExpiry): Locator {
    return this.page.getByTestId(`api-key-expiry-option-${value}`);
  }

  row(name: string): Locator {
    return this.rows.filter({
      has: this.page.getByTestId("api-key-name").getByText(name, { exact: true }),
    });
  }

  /** The code block of a Quickstart step (1-based), next to its copy button. */
  quickstartStep(step: number): Locator {
    return this.usageSnippet.locator("pre").nth(step - 1);
  }

  async openCreateForm(): Promise<void> {
    await this.createOpen.click();
    await expect(this.createSubmit).toBeVisible();
  }

  /** Fills and submits the open create form, then waits for the reveal view. */
  async create({ name, expiry }: { name: string; expiry: ApiKeyExpiry }): Promise<void> {
    await this.nameInput.fill(name);
    await this.expiryOption(expiry).click();
    await expect(this.expiryInput(expiry)).toBeChecked();
    await this.createSubmit.click();
    await expect(this.reveal).toBeVisible();
  }

  async openDeleteConfirm(name: string): Promise<void> {
    await this.row(name).getByTestId("api-key-delete").click();
    await expect(this.deleteConfirm).toBeVisible();
  }

  async confirmDelete(name: string): Promise<void> {
    await this.deleteSubmit.click();
    await expect(this.row(name)).toHaveCount(0);
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.root).toBeHidden();
  }
}
