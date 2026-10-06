import { expect, test } from "../fixtures";
import { QUESTION, persistedMessage } from "./conversation";

test.describe("answer actions @dev", () => {
  test("sources, thumbs up and copy on an answer persist on the message", async ({
    chat,
    api,
    context,
    baseURL,
  }) => {
    // The copy button writes to the clipboard before it reports was_copied.
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(baseURL as string).origin,
    });

    await chat.newChat();
    await chat.composer.send(QUESTION);
    const conversationId = await chat.waitForConversationId();
    await chat.composer.waitIdle();
    expect((await chat.messages.lastAnswerText()).length).toBeGreaterThan(0);
    // The footer actions are sent for the server id only.
    const messageId = await chat.messages.waitForPersistedId();
    const read = () => persistedMessage(api, conversationId, messageId);

    await test.step("a source title opens its link and logs the click", async () => {
      expect(await chat.messages.sourcesCount()).toBeGreaterThan(0);
      expect(await chat.messages.openSources()).toBeGreaterThan(0);
      const tab = await chat.messages.openFirstSourceTab();
      expect(tab.url()).toMatch(/^https?:\/\//);
      await tab.close();
      // The click is appended to metadata.source_logs on the message.
      await expect
        .poll(async () => (await read())?.metadata?.source_logs?.at(-1)?.source_url ?? "", {
          timeout: 30_000,
        })
        .toMatch(/^https?:\/\//);
    });

    await test.step("thumbs up persists a positive vote", async () => {
      await chat.messages.thumbUp();
      await expect
        .poll(async () => (await read())?.feedback ?? null, { timeout: 30_000 })
        .toBe("positive");
    });

    await test.step("copy persists was_copied", async () => {
      await chat.messages.copyAnswer();
      await expect
        .poll(async () => (await read())?.was_copied ?? false, { timeout: 30_000 })
        .toBe(true);
    });
  });
});
