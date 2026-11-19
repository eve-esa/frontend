import { flagOn, flagOrEnvOn } from "../pages";
import { expect, test } from "../fixtures";
import { QUESTION, lastPersistedTurn } from "./conversation";

/** A phone: below the `md` breakpoint, where the composer sits at the bottom of the empty chat. */
const PHONE = { width: 390, height: 844 };
/** The composer stays this close to the bottom edge, empty chat and conversation alike. */
const BOTTOM_GAP_MAX = 24;
const SHORT_LINE = "EVE is AI and can make mistakes.";
const FULL_TEXT =
  "EVE outputs represent an automated synthesis and do not constitute statements by, or endorsements from, the original data providers or authors. EVE could make errors. Always check the content.";

test.describe("composer on a phone @dev", () => {
  test.use({ viewport: PHONE, isMobile: true, hasTouch: true });

  test("empty chat: composer at the bottom, suggestions above it, model in the header", async ({
    chat,
    authedPage: page,
  }) => {
    test.skip(
      !flagOrEnvOn(await chat.servedConfig(), "FEATURE_MOBILE_COMPOSER", false),
      "FEATURE_MOBILE_COMPOSER is off in the served config",
    );
    await chat.goto();
    const { composer } = chat;

    await test.step("the composer sits at the bottom edge and no notice is shown", async () => {
      expect(await composer.distanceToViewportBottom()).toBeLessThanOrEqual(BOTTOM_GAP_MAX);
      await expect(composer.disclaimer).toHaveCount(0);
      expect(await page.content()).not.toContain("automated synthesis");
    });

    await test.step("three suggestions sit above the box, not inside it", async () => {
      await expect(composer.suggestions).toHaveCount(3);
      const box = await composer.boxFrame();
      for (const row of await composer.suggestions.all()) {
        const frame = await row.boundingBox();
        expect(frame, "suggestion row frame").not.toBeNull();
        expect(frame!.y + frame!.height).toBeLessThanOrEqual(box.y);
      }
    });

    await test.step("focus does not grow the box", async () => {
      const before = await composer.boxFrame();
      await composer.input.tap();
      const after = await composer.boxFrame();
      expect(after.height).toBe(before.height);
      expect(after.y).toBe(before.y);
    });

    await test.step("tapping a suggestion fills the input", async () => {
      const text = (await composer.suggestions.first().innerText()).trim();
      await composer.suggestions.first().tap();
      await expect(composer.input).toHaveValue(text);
      await expect(composer.sendButton).toBeEnabled();
    });

    await test.step("the model picker is not in the composer, the header holds the model", async () => {
      await expect(composer.modelPicker).toHaveCount(0);
      await expect(chat.headerMenu).toHaveAccessibleName("Open sidebar");
      await expect(chat.headerNewChat).toHaveAccessibleName("New chat");
      await expect(chat.headerModelField).toContainText("Model");
      const frame = await chat.headerModelField.boundingBox();
      expect(frame!.height).toBeGreaterThanOrEqual(44);
      // Equal space left and right of the field, between the hamburger and New chat.
      const menu = (await chat.headerMenu.boundingBox())!;
      const add = (await chat.headerNewChat.boundingBox())!;
      const left = frame!.x - (menu.x + menu.width);
      const right = add.x - (frame!.x + frame!.width);
      expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    });

    await test.step("the model sheet marks the current model and switches it", async () => {
      const original = (await chat.headerModelName.innerText()).trim();
      await chat.headerModelField.tap();
      await expect(chat.modelSheet).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(chat.modelSheet).toBeHidden();
      await expect(chat.headerModelField).toBeFocused();
      await expect(chat.headerModelName).toHaveText(original);
      await chat.headerModelField.tap();
      await expect(chat.modelSheet).toBeVisible();
      const options = chat.modelSheetOptions;
      const count = await options.count();
      expect(count).toBeGreaterThan(0);
      const marks = await options.evaluateAll((rows) => rows.map((row) => row.getAttribute("data-current")));
      expect(marks.filter((mark) => mark === "true")).toHaveLength(1);
      const currentIndex = marks.indexOf("true");
      await expect(options.nth(currentIndex)).toContainText(original);

      if (count > 1) {
        const otherIndex = marks.findIndex((mark) => mark === "false");
        const name = (await options.nth(otherIndex).innerText()).trim();
        await options.nth(otherIndex).tap();
        await expect(chat.modelSheet).toBeHidden();
        await expect(chat.headerModelName).toHaveText(name);
        const stored = await page.evaluate(() => localStorage.getItem("model_selection"));
        expect(stored, "the choice is stored for the next send").not.toBeNull();
        // Put it back: the stored choice is the account's browser state, not this test's.
        await chat.headerModelField.tap();
        await options.nth(currentIndex).tap();
        await expect(chat.headerModelName).toHaveText(original);
      } else {
        await options.nth(currentIndex).tap();
        await expect(chat.modelSheet).toBeHidden();
      }
      await expect(chat.headerModelField).toBeFocused();
    });
  });

  test("after the first answer: the composer keeps its place, one line and a Learn more dialog", async ({
    chat,
    api,
    authedPage: page,
  }) => {
    test.skip(
      !flagOrEnvOn(await chat.servedConfig(), "FEATURE_MOBILE_COMPOSER", false),
      "FEATURE_MOBILE_COMPOSER is off in the served config",
    );
    await chat.goto();
    const { composer } = chat;
    const emptyFrame = await composer.boxFrame();

    await composer.send(QUESTION);
    const conversationId = await chat.waitForConversationId();
    await composer.waitIdle();

    await test.step("the box did not move and still sits at the bottom edge", async () => {
      const frame = await composer.boxFrame();
      expect(Math.abs(frame.y - emptyFrame.y)).toBeLessThanOrEqual(1);
      expect(await composer.distanceToViewportBottom()).toBeLessThanOrEqual(BOTTOM_GAP_MAX);
    });

    await test.step("one short line under the box, the full text one tap away", async () => {
      await expect(composer.disclaimer).toBeVisible();
      await expect(composer.disclaimer).toContainText(SHORT_LINE);
      expect(await page.content()).not.toContain("automated synthesis");
      const line = (await composer.disclaimer.boundingBox())!;
      expect(line.height).toBeLessThanOrEqual(20);

      await composer.learnMore.tap();
      await expect(composer.learnMoreDialog).toBeVisible();
      await expect(composer.learnMoreDialog).toContainText("About EVE's answers");
      await expect(composer.learnMoreDialog).toContainText(FULL_TEXT);
      await page.keyboard.press("Escape");
      await expect(composer.learnMoreDialog).toBeHidden();
      await expect(composer.learnMore).toBeFocused();

      await composer.learnMore.tap();
      await composer.learnMoreClose.tap();
      await expect(composer.learnMoreDialog).toBeHidden();
    });

    await test.step("the backend holds the turn", async () => {
      const turn = await lastPersistedTurn(api, conversationId);
      expect(turn.status).toBe(200);
      expect(turn.messages).toBe(1);
    });

    await test.step("New chat in the header returns to the empty chat, composer in the same place", async () => {
      await chat.headerNewChat.tap();
      await expect.poll(() => chat.conversationId(), { timeout: 15_000 }).toBeNull();
      await composer.waitReady();
      await expect(composer.disclaimer).toHaveCount(0);
      const frame = await composer.boxFrame();
      expect(Math.abs(frame.y - emptyFrame.y)).toBeLessThanOrEqual(1);
    });
  });
});

test.describe("composer on a computer @dev", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the model picker stays inside the composer, the phone header is not rendered", async ({
    chat,
  }) => {
    test.skip(
      !flagOrEnvOn(await chat.servedConfig(), "FEATURE_MOBILE_COMPOSER", false),
      "FEATURE_MOBILE_COMPOSER is off in the served config",
    );
    test.skip(
      !flagOn(await chat.servedConfig(), "FEATURE_MODEL_PICKER", true),
      "FEATURE_MODEL_PICKER is off in the served config",
    );
    await chat.goto();
    const { composer } = chat;

    await expect(composer.modelPicker).toBeVisible();
    await expect(chat.headerModelField).toHaveCount(0);
    const box = await composer.boxFrame();
    const picker = await composer.modelPicker.boundingBox();
    expect(picker, "model picker frame").not.toBeNull();
    expect(picker!.x).toBeGreaterThanOrEqual(box.x);
    expect(picker!.y).toBeGreaterThanOrEqual(box.y);
    expect(picker!.x + picker!.width).toBeLessThanOrEqual(box.x + box.width);
    expect(picker!.y + picker!.height).toBeLessThanOrEqual(box.y + box.height);
    // No notice on the empty chat on a computer either.
    await expect(composer.disclaimer).toHaveCount(0);
  });
});
