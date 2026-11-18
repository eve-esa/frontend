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

  /** Footer "Sources (n)" button: the legacy surface, which opens the right sidebar panel. */
  get sourcesButton(): Locator {
    return this.last.getByTestId("message-sources-button");
  }

  /**
   * The sources list under an answer that carries citations (FEATURE_INLINE_CITATIONS on and the
   * backend sent the lists); the footer button is not rendered for such a turn.
   */
  get inlineSources(): Locator {
    return this.last.getByTestId("message-sources");
  }

  /**
   * Which surface lists the sources of the last turn, read from the markup and not from the
   * flag: with the flag on, a turn without citation lists still falls back to the footer button.
   */
  async sourcesSurface(): Promise<"panel" | "inline" | "none"> {
    if (await this.sourcesButton.isVisible()) return "panel";
    if (await this.inlineSources.isVisible()) return "inline";
    return "none";
  }

  /** Number in the "Retrieved, not cited: n" / "Also retrieved: n" toggle; 0 when it is not there. */
  private async uncitedCount(): Promise<number> {
    const toggle = this.last.getByTestId("message-sources-uncited-toggle");
    if (!(await toggle.isVisible())) return 0;
    const match = (await toggle.innerText()).match(/(\d+)\s*$/);
    return match ? Number(match[1]) : 0;
  }

  /**
   * Number of sources the last turn shows; 0 when there is none. Footer button: the number in
   * "Sources (n)". Inline list: the cited count of "Sources: n cited from ..." plus the
   * retrieved-but-not-cited count when that toggle is on screen (it is, alone, when nothing is
   * cited, and next to the cited list once the list is open).
   */
  async sourcesCount(): Promise<number> {
    const surface = await this.sourcesSurface();
    if (surface === "panel") {
      const match = (await this.sourcesButton.innerText()).match(/\((\d+)\)/);
      return match ? Number(match[1]) : 0;
    }
    if (surface === "inline") {
      const toggle = this.last.getByTestId("message-sources-toggle");
      const cited = (await toggle.isVisible())
        ? Number((await toggle.innerText()).match(/Sources:\s*(\d+)\s+cited/)?.[1] ?? 0)
        : 0;
      return cited + (await this.uncitedCount());
    }
    return 0;
  }

  /**
   * Opens the sources of the last turn and returns how many entries the opened surface lists:
   * the titles of the sidebar panel, or the cited items of the inline list (the retrieved items
   * when nothing is cited).
   */
  async openSources(): Promise<number> {
    if ((await this.sourcesSurface()) === "panel") {
      await this.sourcesButton.click();
      const titles = this.page.getByTestId("source-title");
      await expect(titles.first()).toBeVisible();
      return titles.count();
    }
    const toggle = this.last.getByTestId("message-sources-toggle");
    if (await toggle.isVisible()) {
      if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
      const items = this.last.getByTestId("source-item");
      await expect(items.first()).toBeVisible();
      return items.count();
    }
    // Nothing cited: only the retrieved list exists.
    const uncited = this.last.getByTestId("message-sources-uncited-toggle");
    await expect(uncited).toBeVisible();
    if ((await uncited.getAttribute("aria-expanded")) !== "true") await uncited.click();
    const items = this.last.getByTestId("source-uncited-item");
    await expect(items.first()).toBeVisible();
    return items.count();
  }

  /** Titles of the sources listed by the surface `openSources` opened. */
  async sourceTitles(): Promise<string[]> {
    if ((await this.sourcesSurface()) === "panel") {
      return this.page.getByTestId("source-title").allInnerTexts();
    }
    return this.last.getByTestId("source-item-title").allInnerTexts();
  }

  /**
   * The source card of the first cited source of the open inline list: the card a marker opens,
   * drawn with the same edge as the card of the sidebar panel. Inline surface only, after
   * `openSources`.
   */
  async openFirstSourceCard(): Promise<Locator> {
    await this.inlineSources.getByTestId("citation-marker").first().click();
    const card = this.page.getByTestId("source-card").first();
    await expect(card).toBeVisible();
    return card;
  }

  /**
   * Clicks the source title at `index` in the open sources surface and returns the tab it
   * opens, once that tab has left about:blank. On the inline list `index` counts only the
   * titles that are links.
   */
  async openSourceTab(index: number): Promise<Page> {
    const opened = this.page.context().waitForEvent("page");
    const title =
      (await this.sourcesSurface()) === "panel"
        ? this.page.getByTestId("source-title").nth(index)
        : this.last.locator('a[data-testid="source-item-title"]').nth(index);
    await title.click();
    const tab = await opened;
    await expect.poll(() => tab.url(), { timeout: 30_000 }).not.toBe("about:blank");
    return tab;
  }

  /** How many titles of the open inline list are links. */
  inlineLinkedTitles(): Promise<number> {
    return this.last.locator('a[data-testid="source-item-title"]').count();
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

  /** MCP tool chips of the last turn; rendered only while that turn streams, FEATURE_AGENT_STEPS off. */
  get lastToolChips(): Locator {
    return this.last.getByTestId("tool-chip");
  }

  /**
   * Footer Trace button of the last turn: rendered with FEATURE_AGENT_STEPS off, or on together
   * with FEATURE_TRACE_SIDEBAR.
   */
  hasTraceButton(): Promise<boolean> {
    return this.last.getByTestId("message-trace-button").isVisible();
  }

  /** The inline agent steps block of the last turn (agentic turns, FEATURE_AGENT_STEPS on). */
  get lastAgentSteps(): Locator {
    return this.last.getByTestId("agent-steps");
  }

  hasAgentSteps(): Promise<boolean> {
    return this.lastAgentSteps.isVisible();
  }

  /**
   * Whether the last turn shows what the agent did: the inline agent steps with
   * FEATURE_AGENT_STEPS on, the footer Trace button with it off or with FEATURE_TRACE_SIDEBAR on.
   */
  hasTrace(agentSteps: boolean, sidebar: boolean): Promise<boolean> {
    return !agentSteps || sidebar ? this.hasTraceButton() : this.hasAgentSteps();
  }

  /** Opens the agent steps block of the last turn when it folded itself after the answer. */
  async openLastAgentSteps(): Promise<void> {
    await expect(this.lastAgentSteps).toBeVisible();
    if ((await this.lastAgentSteps.getAttribute("data-state")) !== "open") {
      await this.last.getByTestId("agent-steps-toggle").click();
    }
    await expect(this.lastAgentSteps).toHaveAttribute("data-state", "open");
  }

  /**
   * Tool steps of the last turn that are on screen: the tool name and the row label
   * ("eve_retrieval Searched \"query\""). The block is open while the agent works and
   * folds when the answer starts; `openLastAgentSteps` shows the rows again.
   */
  lastToolSteps(): Promise<{ tool: string; label: string }[]> {
    return this.last
      .locator('[data-testid="agent-step"][data-tool]')
      .evaluateAll((rows) =>
        rows.map((row) => ({
          tool: row.getAttribute("data-tool") ?? "",
          label: (
            (row.querySelector('[data-testid="agent-step-toggle"]') as HTMLElement | null)?.innerText ?? ""
          ).trim(),
        })),
      );
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

  /** The user text of the last turn, clamped to six lines until expanded. */
  get lastUserInput(): Locator {
    return this.last.getByTestId("message-user-input");
  }

  /** The Show more / Show less toggle under the user text of the last turn. */
  get lastShowMore(): Locator {
    return this.last.getByTestId("message-show-more");
  }

  /**
   * Moves keyboard focus to the Show more toggle of the last turn the way a keyboard user
   * does: a click on the user text sets the sequential focus starting point (the text itself
   * is not focusable), then one Tab must land on the toggle.
   */
  async tabToShowMore(): Promise<void> {
    await this.lastUserInput.click();
    await this.page.keyboard.press("Tab");
  }

  /** Whether the Show more toggle of the last turn matches `:focus-visible`. */
  showMoreFocusVisible(): Promise<boolean> {
    return this.lastShowMore.evaluate((el) => el.matches(":focus-visible"));
  }

  /**
   * Paints the focus ring colour of the Show more toggle as the text colour of a probe placed
   * in the bubble next to it, so the ring can be measured against the bubble with the same
   * contrast helper as text. Returns the probe; `removeRingProbe` takes it away.
   */
  async ringProbe(): Promise<Locator> {
    await this.lastShowMore.evaluate((el) => {
      const shadow = getComputedStyle(el).boxShadow;
      // Each shadow is "<color> <x> <y> <blur> <spread>"; the ring is the one with a spread.
      const ring = shadow
        .split(/,(?![^()]*\))/)
        .map((part) => part.trim())
        .find((part) => /\s[1-9][\d.]*px$/.test(part));
      const color = ring?.match(/^(?:[a-z]+\([^()]*\)|#[0-9a-f]+)/i)?.[0] ?? "transparent";
      const probe = document.createElement("span");
      probe.dataset.testid = "e2e-ring-probe";
      probe.textContent = "ring";
      probe.style.color = color;
      el.parentElement?.appendChild(probe);
    });
    return this.last.getByTestId("e2e-ring-probe");
  }

  async removeRingProbe(): Promise<void> {
    await this.last.getByTestId("e2e-ring-probe").evaluate((el) => el.remove());
  }

  /** Activates the focused element with Enter, as a keyboard user toggles Show more. */
  async pressEnter(): Promise<void> {
    await this.page.keyboard.press("Enter");
  }

  async copyAnswer(): Promise<void> {
    await this.last.getByTestId("message-copy").click();
  }
}
