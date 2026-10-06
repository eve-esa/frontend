import type { Locator, Page } from "@playwright/test";

/** The on hold page an account past the sign-up approval limit sees instead of the chat. */
export class PendingApprovalPage {
  readonly root: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("pending-approval-page");
  }

  isOpen(): Promise<boolean> {
    return this.root.isVisible();
  }
}
