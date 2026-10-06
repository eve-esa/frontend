import { flagOn } from "../pages";
import { expect, test } from "../fixtures";
import { lastPersistedTurn } from "./conversation";

/**
 * A refused send is retried once after Retry-After (src/services/serviceBusy.ts).
 * The first request to the streaming route is answered 429 in the browser; the
 * retry goes to the real backend and must produce a persisted answer.
 */
const RETRY_AFTER_S = 3;
const BUSY_QUESTION =
  process.env.E2E_BUSY_QUESTION ?? "In one sentence, what does the Sentinel-2 mission observe?";

const CASES = [
  { code: "overloaded", copy: /EVE is busy right now\. Retrying in [1-3] s/ },
  { code: "rate_limited", copy: /You are sending requests too fast\. Retrying in [1-3] s/ },
] as const;

test.describe("busy notice @dev", () => {
  for (const { code, copy } of CASES) {
    test(`a 429 ${code} counts down, retries once and the answer persists`, async ({
      chat,
      api,
    }) => {
      const agentic = flagOn(await chat.servedConfig(), "FEATURE_AGENTIC_CHAT", true);
      const route = agentic ? "stream-generate-agentic" : "stream_messages";
      // Send URLs carry ?_nocache=: match the path only.
      const streamPath = new RegExp(`/api/conversations/[^/]+/${route}$`);
      const sentAt: number[] = [];

      await chat.page.route(
        (url) => streamPath.test(url.pathname),
        async (request) => {
          sentAt.push(Date.now());
          if (sentAt.length > 1) {
            await request.continue();
            return;
          }
          await request.fulfill({
            status: 429,
            contentType: "application/json",
            headers: { "Retry-After": String(RETRY_AFTER_S) },
            body: JSON.stringify({ detail: { code, message: "e2e refusal" } }),
          });
        },
      );

      await chat.newChat();
      await chat.composer.send(BUSY_QUESTION);
      const conversationId = await chat.waitForConversationId();

      await expect.poll(() => chat.composer.busyNoticeText(), { intervals: [200] }).toMatch(copy);
      await expect(chat.composer.busyNotice).toBeHidden({ timeout: (RETRY_AFTER_S + 5) * 1000 });
      await chat.composer.waitIdle();

      // One refusal, one retry, and the retry waited for Retry-After.
      expect(sentAt).toHaveLength(2);
      expect(sentAt[1] - sentAt[0]).toBeGreaterThanOrEqual((RETRY_AFTER_S - 0.5) * 1000);
      expect((await chat.messages.lastAnswerText()).length).toBeGreaterThan(0);

      // The refused attempt never reached the backend: exactly one turn, answered.
      await expect
        .poll(async () => (await lastPersistedTurn(api, conversationId)).outputChars, {
          timeout: 30_000,
        })
        .toBeGreaterThan(0);
      const turn = await lastPersistedTurn(api, conversationId);
      expect(turn.messages).toBe(1);
      expect(turn.stopped).not.toBe(true);
    });
  }
});
