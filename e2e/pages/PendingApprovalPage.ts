import type { Locator, Page } from "@playwright/test";

/** The on hold page an account past the sign-up approval limit sees instead of the chat. */
export class PendingApprovalPage {
  readonly root: Locator;
  readonly message: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("pending-approval-page");
    this.message = page.getByTestId("pending-approval-message");
  }

  isOpen(): Promise<boolean> {
    return this.root.isVisible();
  }
}
