import { expect, type Locator, type Page } from "@playwright/test";
import type { Composer } from "./Composer";

/** The Control Panel side sheet (retrieval settings). */
export class SettingsPanel {
  readonly root: Locator;
  readonly yearRange: Locator;
  readonly minCitations: Locator;
  readonly classificationFilters: Locator;

  constructor(page: Page, private readonly composer: Composer) {
    this.root = page.getByTestId("settings-panel");
    this.yearRange = page.getByTestId("settings-year-range");
    this.minCitations = page.getByTestId("settings-min-citations");
    this.classificationFilters = page
      .getByTestId("settings-filter-thematic")
      .or(page.getByTestId("settings-filter-scientific"))
      .or(page.getByTestId("settings-filter-market"));
  }

  async open(): Promise<void> {
    await this.composer.settingsButton.click();
    await expect(this.root).toBeVisible();
  }

  async minCitationsValue(): Promise<number> {
    return Number(await this.minCitations.locator("input").first().inputValue());
  }

  async yearRangeText(): Promise<string> {
    return (await this.yearRange.innerText()).trim();
  }

  classificationFilterCount(): Promise<number> {
    return this.classificationFilters.count();
  }

  /** Visible text of the whole panel, for "this label must not exist" checks. */
  text(): Promise<string> {
    return this.root.innerText();
  }
}
