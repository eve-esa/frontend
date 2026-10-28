import { expect, test } from "../fixtures";
import { contrastRatio, MIN_CONTRAST } from "../fixtures/contrast";
import { lastPersistedTurn } from "./conversation";

/** WCAG 1.4.11: a focus indicator reaches 3:1 against what is around it. */
const MIN_NON_TEXT_CONTRAST = 3;

/** Ten short lines, more than the six-line clamp; the last one keeps the answer to one word. */
const TEN_LINES = [
  "Copernicus Sentinel missions:",
  "Sentinel-1",
  "Sentinel-2",
  "Sentinel-3",
  "Sentinel-4",
  "Sentinel-5",
  "Sentinel-5P",
  "Sentinel-6",
  "Which agency operates them?",
  "Reply with one word only.",
].join("\n");

/** One line, far below the clamp. */
const ONE_LINE = "Reply with the single word yes.";

/**
 * Five short lines plus one line of about 900 px in Arial 16 px: it wraps to two lines at a
 * 1280 px viewport (text column at most about 720 px, sidebar open or not), so seven lines
 * overflow the clamp; at 2560 px the bubble reaches its 1200 px cap (about 1160 px of text),
 * the line fits and six lines fill the clamp exactly, with no overflow.
 */
const WRAPS_ON_NARROW = [
  "Reply with one word only.",
  "Line two",
  "Line three",
  "Line four",
  "Line five",
  Array(22).fill("earth").join(" "),
].join("\n");

const NARROW = { width: 1280, height: 900 };
const WIDE = { width: 2560, height: 900 };

test.describe("show more on long messages @dev", () => {
  test("a long user message has a visible, keyboard reachable Show more", async ({
    chat,
    api,
  }) => {
    await chat.newChat();
    await chat.composer.send(TEN_LINES);
    const conversationId = await chat.waitForConversationId();
    await chat.composer.waitIdle();

    const toggle = chat.messages.lastShowMore;
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText("Show more");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const inputId = await chat.messages.lastUserInput.getAttribute("id");
    expect(inputId).toBeTruthy();
    await expect(toggle).toHaveAttribute("aria-controls", inputId as string);

    const ratio = await contrastRatio(toggle);
    expect(ratio, `contrast ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_CONTRAST);

    await chat.messages.tabToShowMore();
    await expect(toggle).toBeFocused();
    await expect.poll(() => chat.messages.showMoreFocusVisible()).toBe(true);

    const probe = await chat.messages.ringProbe();
    const ringRatio = await contrastRatio(probe);
    await chat.messages.removeRingProbe();
    expect(ringRatio, `focus ring contrast ${ringRatio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      MIN_NON_TEXT_CONTRAST,
    );

    await chat.messages.pressEnter();
    await expect(toggle).toHaveText("Show less");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toBeFocused();

    await chat.messages.pressEnter();
    await expect(toggle).toHaveText("Show more");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();

    await expect
      .poll(async () => (await lastPersistedTurn(api, conversationId)).input, {
        timeout: 30_000,
        intervals: [2_000],
      })
      .toBe(TEN_LINES);
  });

  test("Show more appears only when the text overflows, also after a resize", async ({
    page,
    chat,
  }) => {
    await page.setViewportSize(NARROW);
    await chat.newChat();
    await chat.composer.send(ONE_LINE);
    await chat.waitForConversationId();
    await chat.composer.waitIdle();
    await expect(chat.messages.lastUserInput).toHaveText(ONE_LINE);
    await expect(chat.messages.lastShowMore).toHaveCount(0);

    await chat.composer.send(WRAPS_ON_NARROW);
    await chat.composer.waitIdle();
    await expect(chat.messages.lastUserInput).toHaveText(WRAPS_ON_NARROW);
    await expect(chat.messages.lastShowMore).toBeVisible();

    await page.setViewportSize(WIDE);
    await expect(chat.messages.lastShowMore).toHaveCount(0);

    await page.setViewportSize(NARROW);
    await expect(chat.messages.lastShowMore).toBeVisible();
  });
});
