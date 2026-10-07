import { expect, type Locator, type Page } from "@playwright/test";

/** The Toolkits sidebar entry and the Shared toolkits panel behind it. */
export class ToolkitsPanel {
  readonly entry: Locator;
  readonly sharedItem: Locator;
  readonly root: Locator;
  readonly names: Locator;

  constructor(page: Page) {
    this.entry = page.getByTestId("sidebar-toolkits");
    this.sharedItem = page.getByTestId("sidebar-toolkits-shared");
    this.root = page.getByTestId("toolkits-panel");
    this.names = this.root.getByTestId("toolkit-item").getByTestId("toolkit-name");
  }

  async open(): Promise<void> {
    await this.entry.click();
    await this.sharedItem.click();
    await expect(this.root).toBeVisible();
  }

  /** Toolkit names the panel lists, once at least one row has rendered. */
  async listedNames(): Promise<string[]> {
    await expect(this.names.first()).toBeVisible();
    return (await this.names.allInnerTexts()).map((name) => name.trim());
  }
}
