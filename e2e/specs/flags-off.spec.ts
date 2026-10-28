import { flagOn, ThemeMenu, themeSwitchOn } from "../pages";
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
});
