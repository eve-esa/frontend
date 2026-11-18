import { groupCitedSources, normalizeCitations, shareNumbersByDocument } from "@/utilities/citations";
import { getRenderableDocuments, groupSourcesByDocument } from "@/utilities/messageDocuments";
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

    await test.step("a source title opens its link and logs the click", async (step) => {
      expect(await chat.messages.sourcesCount()).toBeGreaterThan(0);
      const surface = await chat.messages.sourcesSurface();
      const listed = await chat.messages.openSources();
      let linked: number;
      if (surface === "panel") {
        // The panel lists one title per document group and opens the link of the
        // group's first source; the same helpers rebuild that list from the API.
        const groups = groupSourcesByDocument(getRenderableDocuments((await read())?.documents));
        expect(groups.length).toBe(listed);
        linked = groups.findIndex(({ sources: [first] }) =>
          Boolean(first?.metadata?.additionalMetadata?.link ?? first?.payload?.url),
        );
      } else {
        // Inline citations: the list under the answer shows one item per cited document; the
        // same helpers rebuild that count from the persisted citations.
        const cited = groupCitedSources(
          shareNumbersByDocument(normalizeCitations((await read())?.metadata?.citations)),
        ).reduce((sum, group) => sum + group.items.length, 0);
        if (cited > 0) expect(listed).toBe(cited);
        linked = (await chat.messages.inlineLinkedTitles()) > 0 ? 0 : -1;
      }
      step.skip(linked < 0, "no source of this answer has a link, so no title opens a tab");

      const tab = await chat.messages.openSourceTab(linked);
      expect(tab.url()).toMatch(/^https?:\/\//);
      await tab.close();
      // Only the sidebar panel logs the click (useLogSourceClick); the inline list links out.
      step.skip(surface !== "panel", "the inline sources list does not log source clicks");
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
