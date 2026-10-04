import { expect, test } from "../fixtures";
import { STOP_QUESTION, lastPersistedTurn } from "./conversation";

test.describe("stop @dev", () => {
  test("Stop ends the turn and the backend persists it as stopped", async ({ chat, api }) => {
    await chat.newChat();
    await chat.composer.send(STOP_QUESTION);
    const conversationId = await chat.waitForConversationId();
    await chat.composer.stop();
    await chat.composer.waitIdle(60_000);

    await expect
      .poll(async () => (await lastPersistedTurn(api, conversationId)).stopped, {
        timeout: 30_000,
        intervals: [2_000],
      })
      .toBe(true);
    expect(await chat.messages.isStopped()).toBe(true);
  });
});
