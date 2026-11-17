import { flagOn, flagOrEnvOn } from "../pages";
import { expect, test } from "../fixtures";
import { QUESTION, lastPersistedTurn } from "./conversation";

test.describe("answer with sources @dev", () => {
  test("an answer shows sources and persists its documents", async ({ chat, api }) => {
    const config = await chat.servedConfig();
    const agentic = flagOn(config, "FEATURE_AGENTIC_CHAT", true);
    const agentSteps = flagOrEnvOn(config, "FEATURE_AGENT_STEPS", false);
    const sidebar = flagOrEnvOn(config, "FEATURE_TRACE_SIDEBAR", false);

    await chat.newChat();
    await chat.composer.send(QUESTION);
    const conversationId = await chat.waitForConversationId();
    await chat.composer.waitIdle();

    expect((await chat.messages.lastAnswerText()).length).toBeGreaterThan(0);
    const uiSources = await chat.messages.sourcesCount();
    expect(uiSources).toBeGreaterThan(0);

    if (agentic) {
      // Agentic route: the trace replaces the rewritten query label; inline agent steps with
      // FEATURE_AGENT_STEPS on, the footer Trace button with it off or FEATURE_TRACE_SIDEBAR on.
      expect(await chat.messages.hasTrace(agentSteps, sidebar)).toBe(true);
    } else {
      // Classic route (prod at 1.0.0): rewritten query shown, no trace of either kind.
      expect(await chat.messages.hasSearchedForLabel()).toBe(true);
      expect(await chat.messages.hasTraceButton()).toBe(false);
      expect(await chat.messages.hasAgentSteps()).toBe(false);
    }

    await expect
      .poll(async () => (await lastPersistedTurn(api, conversationId)).documents, {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);
  });
});
