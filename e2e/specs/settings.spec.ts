import { flagOrEnvOn, SettingsPage } from "../pages";
import { expect, test } from "../fixtures";

type Me = { first_name?: string | null; last_name?: string | null };

type ApiKeyRow = { id: string; name: string; status: string };

type TokenUsage = { unlimited: boolean; used_tokens: number };

// Staging reads replicas: a read right after a write can still answer the old value.
const READ_BACK = { timeout: 10_000 };

test.describe("settings page @dev", () => {
  test("every section, with a read back through the API", async ({
    chat,
    authedPage: page,
    api,
  }) => {
    test.skip(
      !flagOrEnvOn(await chat.servedConfig(), "FEATURE_SETTINGS_PAGE", false),
      "FEATURE_SETTINGS_PAGE is off in the served config",
    );
    const settings = new SettingsPage(page, chat);

    await test.step("the user menu leads to Profile", async () => {
      await settings.openFromUserMenu();
    });

    await test.step("profile: Save is off until a field changes, then the name round trips", async () => {
      await expect(settings.profileSave).toBeDisabled();
      await expect(settings.profileStatus).toHaveText("No changes to save.");

      const original = await settings.profileLastName.inputValue();
      const changed = `E2E${Date.now()}`;
      const lastName = async () => (await api.get<Me>("/users/me")).body.last_name ?? "";
      try {
        await settings.profileLastName.fill(changed);
        await expect(settings.profileStatus).toHaveText("You have unsaved changes.");
        await expect(settings.profileSave).toBeEnabled();
        await settings.profileSave.click();
        await expect(settings.profileStatus).toHaveText("Saved.");
        await expect.poll(lastName, READ_BACK).toBe(changed);
      } finally {
        // Leave the account as it was found.
        if ((await lastName().catch(() => original)) !== original) {
          await settings.profileLastName.fill(original);
          if (await settings.profileSave.isEnabled()) await settings.profileSave.click();
          await expect.poll(lastName, READ_BACK).toBe(original);
        }
      }
    });

    await test.step("appearance: a choice applies and survives a reload", async () => {
      if (!(await settings.offers("appearance"))) return;
      await settings.openSection("appearance");
      const before = await settings.checkedTheme();
      const current = await settings.theme();
      // Light, unless the page is light already: the attribute must change.
      const target = current === "light" ? "dark" : "light";
      try {
        await settings.themeOption(target).check();
        await expect.poll(() => settings.theme()).toBe(target);
        await page.reload();
        await expect(settings.section("appearance")).toBeVisible();
        await expect.poll(() => settings.theme()).toBe(target);
        await expect(settings.themeOption(target)).toBeChecked();
      } finally {
        if (before) {
          await settings.themeOption(before).check();
          await expect(settings.themeOption(before)).toBeChecked();
        }
      }
    });

    await test.step("models: the section renders with its add button", async () => {
      if (!(await settings.offers("models"))) return;
      await settings.openSection("models");
      // Nothing is created: the environment is shared.
      await expect(page.getByTestId("settings-models-add")).toBeVisible();
    });

    await test.step("usage: the figure matches the API, and CO2eq calculates", async () => {
      if (!(await settings.offers("usage"))) return;
      await settings.openSection("usage");
      const usage = await api.get<TokenUsage>("/users/me/token-usage");
      expect(usage.status).toBe(200);
      if (usage.body.unlimited) {
        await expect(page.getByTestId("settings-usage-unlimited")).toBeVisible();
      } else {
        const used = page.getByTestId("settings-usage-used");
        await expect(used).toBeVisible();
        // The figure may be grouped (12,345): compare the digits.
        const digits = ((await used.innerText()).match(/\d/g) ?? []).join("");
        expect(Number(digits)).toBeGreaterThanOrEqual(usage.body.used_tokens);
      }
      await page.getByTestId("settings-usage-calculate").click();
      await expect(page.getByTestId("settings-usage-co2eq")).toBeVisible({ timeout: 30_000 });
    });

    await test.step("api keys: create one, read it back, delete it", async () => {
      if (!(await settings.offers("api-keys"))) return;
      await settings.openSection("api-keys");
      const name = `e2e-settings-${Date.now()}`;
      const findKey = async (): Promise<ApiKeyRow | undefined> => {
        const list = await api.get<ApiKeyRow[]>("/users/api-keys");
        expect(list.status).toBe(200);
        return list.body.find((key) => key.name === name);
      };
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
        await page.getByTestId("api-key-secret-done").click();
        await expect(settings.apiKeyRow(name)).toHaveCount(1);
        await expect.poll(async () => (await findKey())?.status, READ_BACK).toBe("active");

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
          .poll(async () => (await findKey())?.status ?? "deleted", READ_BACK)
          .not.toBe("active");
      } finally {
        // A failed run leaves no active key behind.
        const leftover = await findKey().catch(() => undefined);
        if (leftover?.status === "active") await api.delete(`/users/api-keys/${leftover.id}`);
      }
    });

    await test.step("account: Log out is offered, and not clicked", async () => {
      await settings.openSection("account");
      await expect(settings.logout).toBeVisible();
    });

    await test.step("an unknown section falls back to Profile", async () => {
      await settings.goto("nope");
      await expect(page).toHaveURL(/\/settings\/profile$/);
      await expect(settings.section("profile")).toBeVisible();
    });
  });
});
