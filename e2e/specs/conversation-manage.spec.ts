import { expect, test, type Api } from "../fixtures";
import { QUESTION, lastPersistedTurn } from "./conversation";

type ConversationRow = { id: string; name: string };

/** The signed-in user's conversations as `GET /api/conversations` lists them, newest first. */
async function listedConversations(api: Api): Promise<ConversationRow[]> {
  const { status, body } = await api.get<{ data?: ConversationRow[] }>(
    "/conversations?limit=50&page=1",
  );
  expect(status).toBe(200);
  return body.data ?? [];
}

test.describe("conversation rename and delete @dev", () => {
  test("rename and delete from the sidebar menu reach the API", async ({ chat, api }) => {
    const title = `e2e rename ${Date.now()}`;
    let conversationId: string | null = null;
    const listed = async (): Promise<ConversationRow | undefined> =>
      (await listedConversations(api)).find((row) => row.id === conversationId);

    try {
      await chat.newChat();
      await chat.composer.send(QUESTION);
      conversationId = await chat.waitForConversationId();
      await chat.composer.waitIdle();
      expect((await lastPersistedTurn(api, conversationId)).messages).toBeGreaterThan(0);

      const created = await listed();
      expect(created, "the new conversation is listed by the API").toBeDefined();

      await chat.renameConversation(created?.name ?? "", title);
      await expect.poll(() => chat.conversationTitles()).toContain(title);
      await expect.poll(async () => (await listed())?.name).toBe(title);

      await chat.deleteConversation(title);
      await expect.poll(() => chat.conversationTitles()).not.toContain(title);
      await expect.poll(async () => (await listed()) === undefined).toBe(true);
    } finally {
      // A failed run leaves no conversation behind.
      const leftover = conversationId ? await listed().catch(() => undefined) : undefined;
      if (leftover) await api.delete(`/conversations/${leftover.id}`);
    }
  });
});
