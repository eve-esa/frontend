import { expect, type Locator, type Page } from "@playwright/test";

/** The My collections side panel: list, create dialog, one collection with its documents. */
export class MyCollectionsPanel {
  readonly menu: Locator;
  readonly menuEntry: Locator;
  readonly newButton: Locator;
  readonly nameInput: Locator;
  readonly createButton: Locator;
  readonly items: Locator;
  readonly uploadInput: Locator;
  readonly documents: Locator;
  readonly deleteCollectionButton: Locator;

  constructor(private readonly page: Page) {
    this.menu = page.getByTestId("knowledge-base-menu");
    this.menuEntry = page.getByTestId("knowledge-base-my-collections");
    this.newButton = page.getByTestId("my-collections-new");
    this.nameInput = page.getByTestId("create-collection-name");
    this.createButton = page.getByTestId("create-collection-submit");
    this.items = page.getByTestId("collection-item");
    this.uploadInput = page.getByTestId("document-upload-input");
    this.documents = page.getByTestId("collection-document");
    this.deleteCollectionButton = page.getByTestId("collection-delete");
  }

  /** Opens the panel from the Knowledge Base menu in the sidebar. */
  async open(): Promise<void> {
    await this.menu.click();
    await this.menuEntry.click();
    await expect(this.newButton).toBeVisible();
  }

  item(name: string): Locator {
    return this.items.filter({
      has: this.page.getByTestId("collection-name").getByText(name, { exact: true }),
    });
  }

  /** Creates a collection through the dialog and waits for it in the list. */
  async create(name: string): Promise<void> {
    await this.newButton.click();
    await this.nameInput.fill(name);
    await expect(this.createButton).toBeEnabled();
    await this.createButton.click();
    await expect(this.nameInput).toBeHidden({ timeout: 15_000 });
    await expect(this.item(name)).toBeVisible({ timeout: 15_000 });
  }

  /** The id the list item carries for this collection. */
  async collectionId(name: string): Promise<string> {
    return (await this.item(name).getAttribute("data-collection-id")) as string;
  }

  /** Turns the chat toggle on (or off) and waits for the switch to show it. */
  async setEnabled(name: string, enabled: boolean): Promise<void> {
    const toggle = this.item(name).getByTestId("collection-enable-toggle");
    const wanted = enabled ? "true" : "false";
    if ((await toggle.getAttribute("aria-checked")) !== wanted) await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", wanted);
  }

  /** Opens one collection: its documents and the upload area. */
  async openCollection(name: string): Promise<void> {
    await this.item(name).getByTestId("collection-name").click();
    await expect(this.deleteCollectionButton).toBeVisible();
  }

  /** Back from an open collection to the list. */
  async backToList(): Promise<void> {
    await this.page.getByTestId("collection-back").click();
    await expect(this.newButton).toBeVisible();
  }

  async upload(filePath: string): Promise<void> {
    await this.uploadInput.setInputFiles(filePath);
  }

  document(name: string): Locator {
    return this.documents.filter({
      has: this.page.getByTestId("collection-document-name").getByText(name, { exact: true }),
    });
  }

  /** The upload date shown under a document of the open collection. */
  documentDate(name: string): Locator {
    return this.document(name).getByTestId("collection-document-date");
  }

  /**
   * A backend timestamp as the panel shows it: offsetless means UTC, rendered
   * as the browser's local day ("7 October 2026"), computed in the page.
   */
  localDay(timestamp: string): Promise<string> {
    return this.page.evaluate((value) => {
      const months = [
        "January", "February", "March", "April", "May", "June", "July",
        "August", "September", "October", "November", "December",
      ];
      const iso = /(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
      const date = new Date(iso);
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }, timestamp);
  }

  /** Deletes a document of the open collection through the confirm dialog. */
  async deleteDocument(name: string): Promise<void> {
    const item = this.document(name);
    await item.hover();
    await item.getByTestId("collection-document-delete").click();
    const confirm = this.page.getByTestId("delete-document-confirm");
    await confirm.click();
    await expect(confirm).toBeHidden({ timeout: 15_000 });
    await expect(item).toHaveCount(0, { timeout: 15_000 });
  }

  /** Deletes the open collection through the confirm dialog; the panel goes back to the list. */
  async deleteOpenCollection(): Promise<void> {
    await this.deleteCollectionButton.click();
    const confirm = this.page.getByTestId("delete-collection-confirm");
    await confirm.click();
    await expect(confirm).toBeHidden({ timeout: 15_000 });
    await expect(this.newButton).toBeVisible();
  }
}
