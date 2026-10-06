import { flagOn } from "../pages";
import { expect, test } from "../fixtures";

type ApiKeyRow = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  expires_at: string | null;
};

const DAY_MS = 86_400_000;

test.describe("api keys @dev", () => {
  test("create with a 30 day expiry, reveal once, delete", async ({ chat, apiKeys, api }) => {
    test.skip(
      !flagOn(await chat.servedConfig(), "FEATURE_API_KEYS", true),
      "FEATURE_API_KEYS is off in the served config",
    );
    const name = `e2e ${Date.now()}`;
    const findKey = async (): Promise<ApiKeyRow | undefined> => {
      const list = await api.get<ApiKeyRow[]>("/users/api-keys");
      expect(list.status).toBe(200);
      return list.body.find((key) => key.name === name);
    };

    try {
      await apiKeys.open();
      await apiKeys.openCreateForm();

      // Expiry tiles: 90 days by default, a click on a tile selects it.
      await expect(apiKeys.expiryInput("90")).toBeChecked();
      await apiKeys.expiryOption("30").click();
      await expect(apiKeys.expiryInput("30")).toBeChecked();
      await expect(apiKeys.expiryInput("90")).not.toBeChecked();

      await apiKeys.create({ name, expiry: "30" });

      // The reveal view shows the key and nothing else: no Quickstart.
      // The secret is checked as a boolean so a failure never prints it.
      const secret = await apiKeys.secret.inputValue();
      expect(/^eve_[0-9a-f]+$/.test(secret), "the secret has the eve_ shape").toBe(true);
      await expect(apiKeys.usageSnippet).toHaveCount(0);
      await expect(apiKeys.reveal).not.toContainText("Quickstart");

      // The POST answered 201; a replica may still lag behind the primary.
      let created: ApiKeyRow | undefined;
      await expect
        .poll(async () => (created = await findKey())?.status, { timeout: 5_000 })
        .toBe("active");
      const lifetime =
        new Date(created?.expires_at ?? 0).getTime() - new Date(created?.created_at ?? 0).getTime();
      expect(Math.abs(lifetime - 30 * DAY_MS)).toBeLessThan(3_600_000);

      // The list view keeps the Quickstart, with coloured commands.
      await apiKeys.secretDone.click();
      await expect(apiKeys.row(name)).toHaveCount(1);
      await apiKeys.quickstartToggle.click();
      const step1 = apiKeys.quickstartStep(1);
      await expect(step1).toContainText('export EVE_API_KEY="<your API key>"');
      await expect(step1.locator("span.text-json-key").first()).toBeVisible();

      // Delete: plain sentences, the key named in its own box.
      await apiKeys.openDeleteConfirm(name);
      await expect(apiKeys.deleteTarget).toContainText(name);
      await expect(apiKeys.deleteConfirm).not.toContainText(";");
      await apiKeys.confirmDelete(name);

      // The DELETE answered 204; a replica may still lag behind the primary.
      await expect
        .poll(async () => (await findKey())?.status ?? "deleted", { timeout: 5_000 })
        .not.toBe("active");
    } finally {
      // A failed run leaves no active key behind.
      const leftover = await findKey().catch(() => undefined);
      if (leftover?.status === "active") await api.delete(`/users/api-keys/${leftover.id}`);
    }
  });
});
