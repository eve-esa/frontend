import type { Page } from "@playwright/test";
import { flagOn, type ChatPage } from "../pages";
import { expect, test, type Api } from "../fixtures";
import {
  answerStepIndex,
  lastPersistedTrace,
  lastPersistedTurn,
  toolStepIndex,
} from "./conversation";

type McpServerRow = { name: string; enabled: boolean };

const SERVER = "eve_retrieval";
const TOOL = "eve_retrieval_retrieve";
const SEARCH_QUESTION =
  process.env.E2E_TOOL_QUESTION ??
  "Search the knowledge base for the Doppler effect and answer in one sentence.";
const OPT_OUT_QUESTION = SEARCH_QUESTION.replace(/\.$/, "") + ", no RAG";

/** Whether eve_retrieval is an enabled row for this user (global or own). */
async function retrievalEnabled(api: Api): Promise<boolean> {
  const { status, body } = await api.get<{ data?: McpServerRow[] }>("/mcp-servers?limit=100&page=1");
  expect(status).toBe(200);
  return (body.data ?? []).some((row) => row.name === SERVER && row.enabled);
}

/**
 * Whether the browser sends eve_retrieval with the turn: the Toolkits switch, on by default;
 * with FEATURE_TOOLKITS off the default always applies (src/utilities/mcpServers.ts).
 */
function retrievalSelected(page: Page, toolkitsOn: boolean): Promise<boolean> {
  if (!toolkitsOn) return Promise.resolve(true);
  return page.evaluate((server) => {
    const stored = localStorage.getItem("mcp_servers");
    if (!stored) return true;
    try {
      const parsed: unknown = JSON.parse(stored);
      return !Array.isArray(parsed) || parsed.includes(server);
    } catch {
      return true;
    }
  }, SERVER);
}

/**
 * Sends `question` in a new chat and samples the tool chips while the turn streams (they
 * vanish once it is persisted). Returns the conversation id and the longest chip list seen.
 */
async function sendAndWatchChips(
  chat: ChatPage,
  question: string,
): Promise<{ conversationId: string; chips: string[] }> {
  await chat.newChat();
  await chat.composer.send(question);
  let chips: string[] = [];
  const deadline = Date.now() + 240_000;
  await expect(chat.composer.stopButton.or(chat.composer.lastTurnEnded).first()).toBeVisible({
    timeout: 60_000,
  });
  while (Date.now() < deadline) {
    const seen = (await chat.messages.lastToolChips.allInnerTexts()).map((t) => t.trim());
    if (seen.length > chips.length) chips = seen;
    if (!(await chat.composer.isGenerating()) && (await chat.composer.lastTurnEnded.isVisible())) {
      break;
    }
    await chat.page.waitForTimeout(200);
  }
  await chat.composer.waitIdle();
  return { conversationId: await chat.waitForConversationId(), chips };
}

test.describe("agentic tools @dev", () => {
  test.beforeEach(async ({ chat, api, authedPage }) => {
    const config = await chat.servedConfig();
    test.skip(
      !flagOn(config, "FEATURE_AGENTIC_CHAT", true),
      "FEATURE_AGENTIC_CHAT is off in the served config: turns take the classic route",
    );
    test.skip(!(await retrievalEnabled(api)), `${SERVER} is not an enabled row of GET /mcp-servers`);
    test.skip(
      !(await retrievalSelected(authedPage, flagOn(config, "FEATURE_TOOLKITS", false))),
      `${SERVER} is switched off in the Toolkits panel of the test account`,
    );
  });

  test("an explicit search shows one eve_retrieval chip and the trace runs the tool before the answer", async ({
    chat,
    api,
  }, testInfo) => {
    test.setTimeout(300_000);
    const { conversationId, chips } = await sendAndWatchChips(chat, SEARCH_QUESTION);
    try {
      expect(chips).toHaveLength(1);
      expect(chips[0]).toMatch(new RegExp(`^Calling MCP server: ${SERVER}: \\S`));

      const trace = await lastPersistedTrace(api, conversationId);
      const tool = toolStepIndex(trace, TOOL);
      expect(tool, `no ${TOOL} step in the persisted trace`).toBeGreaterThanOrEqual(0);
      expect(answerStepIndex(trace)).toBeGreaterThan(tool);

      const turn = await lastPersistedTurn(api, conversationId);
      expect(turn.outputChars).toBeGreaterThan(0);
      if (testInfo.project.name === "local") {
        // The compose Qdrant holds no shared collection and Wiley has no token locally.
        testInfo.annotations.push({
          type: "local-gap",
          description: "persisted documents are checked on dev and staging only",
        });
      } else {
        expect(turn.documents, "the retrieval tool ran but no document was persisted").toBeGreaterThan(0);
      }
    } finally {
      await api.delete(`/conversations/${conversationId}`);
    }
  });

  test("the same question with no RAG runs no tool", async ({ chat, api }) => {
    test.setTimeout(300_000);
    const { conversationId, chips } = await sendAndWatchChips(chat, OPT_OUT_QUESTION);
    try {
      expect(chips).toEqual([]);
      const trace = await lastPersistedTrace(api, conversationId);
      expect(trace.length, "the agentic turn persisted no trace").toBeGreaterThan(0);
      expect(trace.filter((step) => step.role === "tool").map((step) => step.name)).toEqual([]);
      expect((await lastPersistedTurn(api, conversationId)).documents).toBe(0);
    } finally {
      await api.delete(`/conversations/${conversationId}`);
    }
  });
});
