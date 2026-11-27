import { flagOrEnvOn, SettingsPage, ToolkitCredentialsSection } from "../pages";
import { expect, test, type Api } from "../fixtures";

type CredentialField = { name: string; label: string; secret: boolean };
type Credentials = {
  fields: CredentialField[];
  configured: boolean;
  hints: Record<string, string>;
  verified_at: string | null;
};
type ToolkitRow = { id: string | null; name: string; user_credentials?: Credentials | null };
type ServerPage = { data: ToolkitRow[]; meta?: { next_page?: string | null } };

const TOOLKIT = process.env.E2E_TOOLKIT ?? "effis";
const CDSE_ID = process.env.E2E_CDSE_CLIENT_ID ?? "";
const CDSE_SECRET = process.env.E2E_CDSE_CLIENT_SECRET ?? "";

// The secret is typed into the form and sent in a request body: no trace, no screenshot, no video.
test.use({ trace: "off", screenshot: "off", video: "off" });

/** The toolkit with a credential form, found on any page of the list, or undefined. */
async function findToolkit(api: Api): Promise<ToolkitRow | undefined> {
  for (let page = 1; page <= 10; page += 1) {
    const res = await api.get<ServerPage>(`/mcp-servers?limit=20&page=${page}`);
    expect(res.status).toBe(200);
    const hit = res.body.data.find(
      (row) => row.name === TOOLKIT && row.user_credentials && row.id,
    );
    if (hit) return hit;
    if (res.body.data.length < 20) return undefined;
  }
  return undefined;
}

const credentialsOf = async (api: Api): Promise<Credentials> => {
  const row = await findToolkit(api);
  expect(row?.user_credentials, `${TOOLKIT} lists user_credentials`).toBeTruthy();
  return row!.user_credentials!;
};

test.describe("settings toolkit credentials @dev", () => {
  let serverId = "";

  test.beforeEach(async ({ chat, api }) => {
    const config = await chat.servedConfig();
    test.skip(
      !flagOrEnvOn(config, "FEATURE_SETTINGS_PAGE", false),
      "FEATURE_SETTINGS_PAGE is off in the served config",
    );
    test.skip(
      !flagOrEnvOn(config, "FEATURE_TOOLKIT_CREDENTIALS", false),
      "FEATURE_TOOLKIT_CREDENTIALS is off in the served config",
    );
    const toolkit = await findToolkit(api);
    test.skip(!toolkit, `no ${TOOLKIT} toolkit with user_credentials in GET /mcp-servers`);
    serverId = toolkit!.id as string;
    // Runs are independent: nothing stored from an earlier run.
    const cleared = await api.delete(`/mcp-servers/${serverId}/credentials`);
    expect([200, 204, 404]).toContain(cleared.status);
  });

  test.afterEach(async ({ api }) => {
    if (serverId) await api.delete(`/mcp-servers/${serverId}/credentials`).catch(() => undefined);
  });

  test("credentials the provider rejects are not saved", async ({ chat, authedPage: page, api }) => {
    const settings = new SettingsPage(page, chat);
    await settings.openFromUserMenu();
    test.skip(!(await settings.offers("toolkits")), "the Toolkits section is not offered");
    await settings.openSection("toolkits");

    const section = new ToolkitCredentialsSection(page, TOOLKIT);
    await section.openForm();
    const before = await credentialsOf(api);
    const suffix = Math.random().toString(36).slice(2, 10);
    for (const field of before.fields) {
      await section.fillField(field.name, `e2e-invalid-${suffix}`);
    }
    await section.submit();

    await expect(section.error).toBeVisible();
    await expect(section.error).toContainText("rejected");
    await expect(section.dialog).toBeVisible();

    const after = await credentialsOf(api);
    expect(after.configured).toBe(false);
  });

  test("valid credentials are saved, shown masked and removed", async ({
    chat,
    authedPage: page,
    api,
  }) => {
    test.skip(
      !CDSE_ID || !CDSE_SECRET,
      "E2E_CDSE_CLIENT_ID and E2E_CDSE_CLIENT_SECRET are not set",
    );
    const settings = new SettingsPage(page, chat);
    await settings.openFromUserMenu();
    test.skip(!(await settings.offers("toolkits")), "the Toolkits section is not offered");
    await settings.openSection("toolkits");

    const section = new ToolkitCredentialsSection(page, TOOLKIT);
    await section.openForm();
    await section.fillField("client_id", CDSE_ID);
    await section.fillField("client_secret", CDSE_SECRET);
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() !== "GET" &&
        /\/mcp-servers\/[^/]+\/credentials$/.test(new URL(response.url()).pathname),
    );
    await section.save.click();
    const response = await saved;
    expect(response.status()).toBeLessThan(300);
    // A boolean, so a failure never prints the body.
    expect((await response.text()).includes(CDSE_SECRET), "the save answer holds the secret").toBe(
      false,
    );

    await expect(section.dialog).toBeHidden();
    await expect(section.status()).toContainText("Using your credentials");
    await expect(section.status()).toContainText("Checked");

    // Staging reads replicas: a read right after a write can still answer the old value.
    await expect
      .poll(async () => (await credentialsOf(api)).configured, { timeout: 10_000 })
      .toBe(true);
    const list = await api.get("/mcp-servers?limit=20&page=1");
    expect(JSON.stringify(list.body).includes(CDSE_SECRET), "the list holds the secret").toBe(
      false,
    );
    const stored = await credentialsOf(api);
    expect(stored.verified_at).toBeTruthy();
    // The hint is an ellipsis and the last 4 characters of the client id, never more.
    expect(stored.hints.client_id).toBe(`…${CDSE_ID.slice(-4)}`);

    expect(await section.remove()).toBeLessThan(300);
    await expect(section.removeDialog).toBeHidden();
    await expect(section.status()).toContainText("Not set");
    await expect
      .poll(async () => (await credentialsOf(api)).configured, { timeout: 10_000 })
      .toBe(false);
  });
});
