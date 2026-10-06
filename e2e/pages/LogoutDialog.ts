import { expect, type Locator, type Page } from "@playwright/test";
import type { ChatPage } from "./ChatPage";

/** The confirmation dialog the user menu's Logout entry opens. */
export class LogoutDialog {
  readonly root: Locator;
  readonly confirmButton: Locator;

  constructor(page: Page, private readonly chat: ChatPage) {
    this.root = page.getByTestId("logout-dialog");
    this.confirmButton = page.getByTestId("logout-confirm");
  }

  async open(): Promise<void> {
    await this.chat.openUserMenuItem("user-menu-logout");
    await expect(this.root).toBeVisible();
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click();
  }
}
