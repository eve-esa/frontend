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

  test("Stop before the first token shows the stopped state, not an error", async ({ chat, api }) => {
    await chat.newChat();
    await chat.composer.send(STOP_QUESTION);
    // The Stop request needs the conversation id, which the new chat gets
    // before the stream opens.
    const conversationId = await chat.waitForConversationId();
    // Skeleton phase: the turn is in flight and no answer text is painted yet.
    await expect(chat.messages.lastLoading).toBeVisible({ timeout: 60_000 });

    // The refetch the client fires right after the stop brings back the row
    // the backend wrote when generation started (empty, not yet stopped). That
    // is the moment the old client painted the error copy, so it is checked
    // there, not after the backend has caught up.
    const firstRefetch = chat.page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname.endsWith(`/conversations/${conversationId}`),
      { timeout: 60_000 },
    );
    await chat.composer.stop();
    await firstRefetch;
    // No auto-waiting assertion before this one: waiting for the stopped
    // state first would wait through the error flash until the reconcile
    // repaints the turn.
    await chat.messages.expectNoErrorFor(1_500);
    await expect(chat.messages.last.getByTestId("message-stopped")).toBeVisible();
    await chat.composer.waitIdle(60_000);

    await expect
      .poll(async () => (await lastPersistedTurn(api, conversationId)).stopped, {
        timeout: 30_000,
        intervals: [2_000],
      })
      .toBe(true);
    // Nothing was generated: the stop landed before the first token.
    expect((await lastPersistedTurn(api, conversationId)).outputChars).toBe(0);
    await expect(chat.messages.last.getByTestId("message-stopped")).toBeVisible();
    await expect(chat.messages.lastError).toBeHidden();
  });
});
