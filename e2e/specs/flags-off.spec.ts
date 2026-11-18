import { flagOn, flagOrEnvOn, ThemeMenu, themeSwitchOn } from "../pages";
import { expect, test } from "../fixtures";

test.describe("flags as served @prod", () => {
  test("model management and API keys follow the served config", async ({ chat, apiKeys }) => {
    const config = await chat.servedConfig();
    const agentic = flagOn(config, "FEATURE_AGENTIC_CHAT", true);
    // Same reading as src/utilities/features.ts: custom models ride on agentic chat.
    const customModels = agentic && flagOn(config, "FEATURE_CUSTOM_MODELS", true);
    const apiKeysOn = flagOn(config, "FEATURE_API_KEYS", true);

    await expect(chat.composer.manageModelsButton).toHaveCount(customModels ? 1 : 0);
    expect(await apiKeys.isEntryVisible()).toBe(apiKeysOn);
  });

  test("the answer renderer follows the served config", async ({ chat }) => {
    // Read only: opens the newest existing conversation, never sends a turn.
    await chat.goto();
    const on = flagOrEnvOn(await chat.servedConfig(), "FEATURE_STREAMDOWN", false);
    const newest = chat.conversations.first();
    test.skip(!(await newest.isVisible()), "the test user has no conversation to read");
    await newest.click();
    const answer = chat.messages.last.getByTestId("message-answer");
    await expect(answer).toBeVisible({ timeout: 30_000 });

    await expect(answer.getByTestId(on ? "streamdown-text" : "smart-text").first()).toBeVisible();
    await expect(answer.getByTestId(on ? "smart-text" : "streamdown-text")).toHaveCount(0);
  });

  test("the theme switch follows the served config", async ({ chat, authedPage: page }) => {
    // A light OS: with the flag off the app must stay dark, with no menu group and no data-theme.
    await page.emulateMedia({ colorScheme: "light" });
    await chat.goto();
    const theme = new ThemeMenu(page, chat);
    const on = themeSwitchOn(await chat.servedConfig());

    expect(await theme.isOffered()).toBe(on);
    if (on) {
      expect(["light", "dark"]).toContain(await theme.current());
    } else {
      expect(await theme.current()).toBeNull();
    }
  });

  test("agent steps follow the served config", async ({ chat, api }) => {
    const config = await chat.servedConfig();
    const steps = flagOrEnvOn(config, "FEATURE_AGENT_STEPS", false);
    const sidebar = flagOrEnvOn(config, "FEATURE_TRACE_SIDEBAR", false);
    // Read only: an existing conversation whose last turn has a trace, none is created.
    const listed = await api.get<{ data?: { id: string }[] }>("/conversations?limit=20&page=1");
    expect(listed.status).toBe(200);
    let traced: string | null = null;
    for (const row of listed.body.data ?? []) {
      const { body } = await api.get<{ messages?: { trace?: unknown[] }[] }>(`/conversations/${row.id}`);
      const last = body.messages?.[body.messages.length - 1];
      if (Array.isArray(last?.trace) && last.trace.length > 0) {
        traced = row.id;
        break;
      }
    }
    test.skip(traced === null, "the test account has no conversation with a traced turn");

    await chat.gotoConversation(traced as string);
    await expect(chat.messages.last).toBeVisible();
    await expect(chat.messages.lastAgentSteps).toHaveCount(steps ? 1 : 0);
    await expect(chat.messages.last.getByTestId("message-trace-button")).toHaveCount(!steps || sidebar ? 1 : 0);
  });
});
