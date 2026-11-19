import { expect, type Locator, type Page, type Response } from "@playwright/test";
import type { ChatPage } from "./ChatPage";
import { isSettingsUrl, SettingsPage, settingsPageOn } from "./SettingsPage";

export type ApiKeyExpiry = "30" | "90" | "365" | "never";

/**
 * API keys (FEATURE_API_KEYS). With FEATURE_SETTINGS_PAGE off they open from the sidebar entry
 * (`sidebar-api-keys`) as a dialog. With it on the sidebar has no such entry: the user menu goes to
 * Settings and the API keys nav item to `/settings/api-keys`. The list is the page section
 * (`root`), Create key is `settings-apikeys-create` and opens a dialog with the same form and
 * reveal, the list shares the dialog's `api-key-*` and `api-keys-*` testids, and there is no
 * Close button.
 */
export class ApiKeysDialog {
  readonly root: Locator;
  readonly rows: Locator;
  readonly count: Locator;
  readonly closeButton: Locator;
  readonly createOpen: Locator;
  readonly nameInput: Locator;
  readonly createSubmit: Locator;
  readonly createCancel: Locator;
  readonly reveal: Locator;
  readonly secret: Locator;
  readonly secretDone: Locator;
  readonly usageSnippet: Locator;
  readonly quickstartToggle: Locator;
  readonly deleteConfirm: Locator;
  readonly deleteTarget: Locator;
  readonly deleteSubmit: Locator;

  private readonly settings: SettingsPage;

  /** Where the test was before `open` went to the settings page, so `close` can return. */
  private returnTo: string | null = null;

  constructor(private readonly page: Page, private readonly chat: ChatPage) {
    this.settings = new SettingsPage(page, chat);
    this.root = page.getByTestId("api-keys-dialog").or(page.getByTestId("settings-section-api-keys"));
    this.rows = page.getByTestId("api-key-row");
    this.count = page.getByTestId("api-keys-count");
    this.closeButton = page.getByTestId("api-keys-close");
    this.createOpen = page.getByTestId("api-keys-create-open").or(page.getByTestId("settings-apikeys-create"));
    this.nameInput = page.getByTestId("api-key-name-input");
    this.createSubmit = page.getByTestId("api-key-create-submit");
    this.createCancel = page.getByTestId("api-key-create-cancel");
    this.reveal = page.getByTestId("api-key-secret-reveal");
    this.secret = page.getByTestId("api-key-secret");
    this.secretDone = page.getByTestId("api-key-secret-done");
    this.usageSnippet = page.getByTestId("api-keys-usage-snippet");
    this.quickstartToggle = page.getByTestId("api-keys-quickstart-toggle");
    this.deleteConfirm = page.getByTestId("api-key-delete-confirm");
    this.deleteTarget = page.getByTestId("api-key-delete-target");
    this.deleteSubmit = page.getByTestId("api-key-delete-confirm-submit");
  }

  /**
   * Whether the target offers API keys: the sidebar entry, or with the settings page on the
   * API keys item of the settings list (the sidebar has none then; this goes to Settings).
   */
  async isEntryVisible(): Promise<boolean> {
    if (!(await this.usesPage())) return this.chat.apiKeysEntry.isVisible();
    await expect(this.chat.apiKeysEntry).toHaveCount(0);
    await this.settings.openFromUserMenu();
    return this.settings.offers("api-keys");
  }

  /** True when API keys live on the settings page, false when the sidebar entry opens the dialog. */
  async usesPage(): Promise<boolean> {
    return settingsPageOn(await this.chat.servedConfig());
  }

  async open(): Promise<void> {
    const onPage = await this.usesPage();
    if (onPage && !isSettingsUrl(this.page.url())) this.returnTo = this.page.url();
    if (onPage) {
      if (!isSettingsUrl(this.page.url())) await this.settings.openFromUserMenu();
      await this.settings.openSection("api-keys");
    } else {
      await this.chat.apiKeysEntry.click();
    }
    await expect(this.root).toBeVisible();
  }

  /**
   * The Quickstart snippet that must not show beside the one-time secret. On the settings page the
   * Quickstart stays on the page behind the create dialog, so only that dialog is read.
   */
  async snippetBesideReveal(): Promise<Locator> {
    return (await this.usesPage()) ? this.page.getByTestId("settings-apikeys-create-dialog").getByTestId("api-keys-usage-snippet") : this.usageSnippet;
  }

  /** Opens the Quickstart: it starts collapsed in the dialog and in the settings section alike. */
  async expandQuickstart(): Promise<void> {
    await this.quickstartToggle.click();
    await expect(this.usageSnippet).toBeVisible();
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

  /** Leaves the create form unsent: back to the list, the only view with Close. */
  async cancelCreateForm(): Promise<void> {
    await this.createCancel.click();
    await expect(this.createOpen).toBeVisible();
    await expect(this.createSubmit).toBeHidden();
  }

  /** The next response to `method` on the API keys route, armed before the click that sends it. */
  private apiKeysResponse(method: "POST" | "DELETE"): Promise<Response> {
    return this.page.waitForResponse(
      (response) =>
        response.request().method() === method &&
        /\/users\/api-keys(\/[^/]+)?$/.test(new URL(response.url()).pathname),
    );
  }

  /**
   * Fills and submits the open create form, waits for the POST to answer 201,
   * then for the reveal view.
   */
  async create({ name, expiry }: { name: string; expiry: ApiKeyExpiry }): Promise<void> {
    await this.nameInput.fill(name);
    await this.expiryOption(expiry).click();
    await expect(this.expiryInput(expiry)).toBeChecked();
    const created = this.apiKeysResponse("POST");
    await this.createSubmit.click();
    expect((await created).status()).toBe(201);
    await expect(this.reveal).toBeVisible();
  }

  async openDeleteConfirm(name: string): Promise<void> {
    await this.row(name).getByTestId("api-key-delete").click();
    await expect(this.deleteConfirm).toBeVisible();
  }

  /**
   * Confirms the delete and waits for the DELETE to answer 204: the row leaves
   * the list before the request ends, so the row alone proves nothing server side.
   */
  async confirmDelete(name: string): Promise<void> {
    const deleted = this.apiKeysResponse("DELETE");
    await this.deleteSubmit.click();
    expect((await deleted).status()).toBe(204);
    await expect(this.row(name)).toHaveCount(0);
  }

  /** Closes the dialog, or leaves the settings page for the page the test came from. */
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
    await this.closeButton.click();
    await expect(this.root).toBeHidden();
  }
}
