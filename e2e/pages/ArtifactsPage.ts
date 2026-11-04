import { expect, type Locator, type Page } from "@playwright/test";

/** The Artifacts page (`/artifacts`) and its sidebar entry, behind FEATURE_ARTIFACTS. */
export class ArtifactsPage {
  readonly entry: Locator;
  readonly title: Locator;
  readonly cards: Locator;

  constructor(private readonly page: Page) {
    this.entry = page.getByTestId("sidebar-artifacts");
    this.title = page.getByTestId("artifacts-title");
    this.cards = page.getByTestId("artifact-card");
  }

  /** Opens the page from the sidebar and waits for its heading. */
  async open(): Promise<void> {
    await this.entry.click();
    await expect.poll(() => new URL(this.page.url()).pathname).toBe("/artifacts");
    await expect(this.title).toBeVisible();
  }

  /** The card of the artifact with this file name (the list is newest first). */
  card(filename: string): Locator {
    return this.cards
      .filter({
        has: this.page.getByTestId("artifact-card-filename").getByText(filename, { exact: true }),
      })
      .first();
  }

  /** The thumbnail of that card; a click opens the lightbox. */
  thumbnail(filename: string): Locator {
    return this.card(filename).getByTestId("artifact-card-image");
  }
}
