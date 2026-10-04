import { flagOn } from "../pages";
import { expect, test } from "../fixtures";
import { QUESTION, lastPersistedTurn } from "./conversation";

test.describe("answer with sources @dev", () => {
  test("an answer shows sources and persists its documents", async ({ chat, api }) => {
    const agentic = flagOn(await chat.servedConfig(), "FEATURE_AGENTIC_CHAT", true);

    await chat.newChat();
    await chat.composer.send(QUESTION);
    const conversationId = await chat.waitForConversationId();
    await chat.composer.waitIdle();

    expect((await chat.messages.lastAnswerText()).length).toBeGreaterThan(0);
    const uiSources = await chat.messages.sourcesCount();
    expect(uiSources).toBeGreaterThan(0);

    if (agentic) {
      // Agentic route (dev today): the trace replaces the rewritten query label.
      expect(await chat.messages.hasTraceButton()).toBe(true);
    } else {
      // Classic route (prod at 1.0.0): rewritten query shown, no trace.
      expect(await chat.messages.hasSearchedForLabel()).toBe(true);
      expect(await chat.messages.hasTraceButton()).toBe(false);
    }

    await expect
      .poll(async () => (await lastPersistedTurn(api, conversationId)).documents, {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);
  });
});
