import { ToolkitsPanel, flagOn } from "../pages";
import { expect, test } from "../fixtures";

type McpServerRow = { name: string; enabled: boolean };
type Paged<T> = { data?: T[]; meta?: { has_next?: boolean } };

/** Comma separated toolkit names this environment must list, e.g. "eve_retrieval". Unset: no check. */
const EXPECTED = (process.env.E2E_EXPECT_TOOLKITS ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean)
  .sort();

test.describe("toolkits panel @prod", () => {
  test("lists exactly the enabled rows of GET /mcp-servers", async ({ chat, api, authedPage }) => {
    const config = await chat.servedConfig();
    const panel = new ToolkitsPanel(authedPage);
    // Same reading as TOOLKITS_ENABLED in src/utilities/features.ts. The Vite dev server
    // (`local`) serves no __EVE_CONFIG__ and bakes the flags at build: there the entry decides.
    const served = Object.keys(config).length > 0;
    const toolkitsOn = served
      ? flagOn(config, "FEATURE_AGENTIC_CHAT", true) && flagOn(config, "FEATURE_TOOLKITS", false)
      : await panel.entry.waitFor({ timeout: 10_000 }).then(
          () => true,
          () => false,
        );

    // Without a served config an absent entry proves nothing: skip rather than pass.
    test.skip(!served && !toolkitsOn, "no __EVE_CONFIG__ and no Toolkits entry on this target");
    if (!toolkitsOn) {
      await expect(panel.entry).toHaveCount(0);
      test.info().annotations.push({ type: "flag-off", description: "FEATURE_TOOLKITS is off" });
      return;
    }

    const enabled: string[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const { status, body } = await api.get<Paged<McpServerRow>>(`/mcp-servers?limit=100&page=${page}`);
      expect(status).toBe(200);
      enabled.push(...(body.data ?? []).filter((row) => row.enabled).map((row) => row.name));
      if (!body.meta?.has_next) break;
    }
    enabled.sort();
    if (EXPECTED.length) expect(enabled, "E2E_EXPECT_TOOLKITS against the API").toEqual(EXPECTED);

    if (enabled.length === 0) {
      // No enabled row: the entry is hidden (src/utilities/toolkits.ts).
      await expect(panel.entry).toHaveCount(0);
      return;
    }
    await panel.open();
    expect((await panel.listedNames()).sort()).toEqual(enabled);
  });
});
