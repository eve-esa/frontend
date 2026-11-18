import { flagOrEnvOn, SettingsPage } from "../pages";
import { apiBaseURL, expect, test } from "../fixtures";

type ApiKeyRow = { id: string; name: string; status: string };

// Staging reads replicas: a read right after a write can still answer the old value.
const READ_BACK = { timeout: 10_000 };

// The key secret goes into a header: no trace and no screenshot may hold it.
test.use({ trace: "off", screenshot: "off" });

test.describe("settings api key on /v1 @dev", () => {
  test("the created key answers /v1/models with 200 and with 401 once deleted", async ({
    chat,
    authedPage: page,
    api,
    playwright,
    baseURL,
  }, testInfo) => {
    test.skip(
      !flagOrEnvOn(await chat.servedConfig(), "FEATURE_SETTINGS_PAGE", false),
      "FEATURE_SETTINGS_PAGE is off in the served config",
    );
    const settings = new SettingsPage(page, chat);
    await settings.openFromUserMenu();
    test.skip(!(await settings.offers("api-keys")), "the API keys section is not offered");
    await settings.openSection("api-keys");

    const name = `e2e-settings-v1-${Date.now()}`;
    const apiBase = apiBaseURL(baseURL as string, testInfo.project.name);
    const findKey = async (): Promise<ApiKeyRow | undefined> => {
      const list = await api.get<ApiKeyRow[]>("/users/api-keys");
      expect(list.status).toBe(200);
      return list.body.find((key) => key.name === name);
    };
    // A context of its own: no cookie of the signed-in page, only the key as bearer.
    let withKey: Awaited<ReturnType<typeof playwright.request.newContext>> | undefined;
    try {
      await page.getByTestId("settings-apikeys-create").click();
      await expect(page.getByTestId("settings-apikeys-create-dialog")).toBeVisible();
      await page.getByTestId("api-key-name-input").fill(name);
      const created = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          /\/users\/api-keys$/.test(new URL(response.url()).pathname),
      );
      await page.getByTestId("api-key-create-submit").click();
      expect((await created).status()).toBe(201);
      // The secret is checked as a boolean so a failure never prints it.
      const secret = await page.getByTestId("api-key-secret").inputValue();
      expect(/^eve_[0-9a-f]+$/.test(secret), "the secret has the eve_ shape").toBe(true);
      withKey = await playwright.request.newContext({
        extraHTTPHeaders: { Authorization: `Bearer ${secret}` },
      });
      const models = async () => (await withKey!.get(`${apiBase}/v1/models`)).status();

      expect(await models(), "GET /v1/models with the new key").toBe(200);
      await page.getByTestId("api-key-secret-done").click();
      await expect(settings.apiKeyRow(name)).toHaveCount(1);

      await settings.apiKeyRow(name).getByTestId("api-key-delete").click();
      await expect(page.getByTestId("api-key-delete-target")).toContainText(name);
      const deleted = page.waitForResponse(
        (response) =>
          response.request().method() === "DELETE" &&
          /\/users\/api-keys\/[^/]+$/.test(new URL(response.url()).pathname),
      );
      await page.getByTestId("api-key-delete-confirm-submit").click();
      expect((await deleted).status()).toBe(204);
      await expect(settings.apiKeyRow(name)).toHaveCount(0);

      await expect
        .poll(models, { ...READ_BACK, message: "GET /v1/models with the deleted key" })
        .toBe(401);
    } finally {
      await withKey?.dispose();
      // A failed run leaves no active key behind.
      const leftover = await findKey().catch(() => undefined);
      if (leftover?.status === "active") await api.delete(`/users/api-keys/${leftover.id}`);
    }
  });
});
