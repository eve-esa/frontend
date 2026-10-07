import type { Locator, Page } from "@playwright/test";

/** The view a tab shows once another tab of the same browser signed out. */
export class SignedOutPage {
  readonly root: Locator;
  readonly signInButton: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("signed-out-page");
    this.signInButton = page.getByTestId("signed-out-sign-in");
  }
}
