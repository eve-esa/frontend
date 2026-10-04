import { flagOn } from "../pages";
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
});
