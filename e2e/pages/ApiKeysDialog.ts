import { expect, type Locator, type Page } from "@playwright/test";
import type { ChatPage } from "./ChatPage";

/** API keys dialog, opened from the sidebar entry (FEATURE_API_KEYS). */
export class ApiKeysDialog {
  readonly root: Locator;
  readonly rows: Locator;
  readonly count: Locator;
  readonly closeButton: Locator;

  constructor(page: Page, private readonly chat: ChatPage) {
    this.root = page.getByTestId("api-keys-dialog");
    this.rows = page.getByTestId("api-key-row");
    this.count = page.getByTestId("api-keys-count");
    this.closeButton = page.getByTestId("api-keys-close");
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

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.root).toBeHidden();
  }
}
