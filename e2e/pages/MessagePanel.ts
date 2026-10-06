import { expect, type Locator, type Page } from "@playwright/test";

/** The last assistant turn of the open conversation and its footer. */
export class MessagePanel {
  readonly messages: Locator;

  constructor(private readonly page: Page) {
    this.messages = page.getByTestId("message");
  }

  get last(): Locator {
    return this.messages.last();
  }

  count(): Promise<number> {
    return this.messages.count();
  }

  /** Persisted id of the last message, or null while it is optimistic. */
  lastMessageId(): Promise<string | null> {
    return this.last.getAttribute("data-message-id");
  }

  /** Waits for the answer text of the last turn and returns it. */
  async lastAnswerText(timeout = 150_000): Promise<string> {
    const answer = this.last.getByTestId("message-answer");
    await expect(answer).toBeVisible({ timeout });
    return (await answer.innerText()).trim();
  }

  /** True when the classic pipeline rewrote the query and the label is rendered. */
  async hasSearchedForLabel(): Promise<boolean> {
    const answer = this.last.getByTestId("message-answer");
    const flagged = (await answer.getAttribute("data-searched-for")) === "true";
    return flagged && (await answer.innerText()).includes("Searched for:");
  }

  get sourcesButton(): Locator {
    return this.last.getByTestId("message-sources-button");
  }

  /** Number in the "Sources (n)" button of the last turn; 0 when there is none. */
  async sourcesCount(): Promise<number> {
    if (!(await this.sourcesButton.isVisible())) return 0;
    const match = (await this.sourcesButton.innerText()).match(/\((\d+)\)/);
    return match ? Number(match[1]) : 0;
  }

  async openSources(): Promise<number> {
    await this.sourcesButton.click();
    const titles = this.page.getByTestId("source-title");
    await expect(titles.first()).toBeVisible();
    return titles.count();
  }

  /**
   * Clicks the first source title in the open sources panel and returns the
   * tab it opens, once that tab has left about:blank.
   */
  async openFirstSourceTab(): Promise<Page> {
    const opened = this.page.context().waitForEvent("page");
    await this.page.getByTestId("source-title").first().click();
    const tab = await opened;
    await expect.poll(() => tab.url(), { timeout: 30_000 }).not.toBe("about:blank");
    return tab;
  }

  /** Waits until the last turn carries its server id instead of the optimistic one. */
  async waitForPersistedId(timeout = 30_000): Promise<string> {
    await expect
      .poll(async () => (await this.lastMessageId()) ?? "", { timeout })
      .toMatch(/^[0-9a-f]{24}$/);
    return (await this.lastMessageId()) as string;
  }

  async thumbUp(): Promise<void> {
    await this.last.getByTestId("message-thumb-up").click();
  }

  async thumbDown(): Promise<void> {
    await this.last.getByTestId("message-thumb-down").click();
  }

  hasTraceButton(): Promise<boolean> {
    return this.last.getByTestId("message-trace-button").isVisible();
  }

  isStopped(): Promise<boolean> {
    return this.last.getByTestId("message-stopped").isVisible();
  }

  /** The inline failure text of the last turn ("Something went wrong!" and its variants). */
  get lastError(): Locator {
    return this.last.getByTestId("message-error");
  }

  /** Fails as soon as the last turn shows the failure text within `ms`; resolves otherwise. */
  async expectNoErrorFor(ms: number): Promise<void> {
    const appeared = await this.lastError
      .waitFor({ state: "visible", timeout: ms })
      .then(
        () => true,
        () => false,
      );
    expect(appeared, "the last turn showed the error copy").toBe(false);
  }

  /** The skeleton or notices shown before the first token of the last turn. */
  get lastLoading(): Locator {
    return this.last.getByTestId("message-loading");
  }

  async copyAnswer(): Promise<void> {
    await this.last.getByTestId("message-copy").click();
  }
}
