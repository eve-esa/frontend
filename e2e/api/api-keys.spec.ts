import { expect, test } from "@playwright/test";
import { canWrite } from "../fixtures";
import {
  bodyOf,
  cognitoRegion,
  complete,
  createKey,
  modelOf,
  openSession,
  revokeKey,
  servedConfig,
} from "./session";

type ApiKeyRow = { id: string; status: string; token_suffix: string | null; token?: string };
type Usage = { prompt_tokens: number; completion_tokens: number; total_tokens: number };

// A trace would hold the bearer, the plaintext key and the Cognito password.
test.use({ trace: "off" });

test.describe("api keys over the /v1 gateway @dev", () => {
  test.beforeEach(async ({ playwright, baseURL }, testInfo) => {
    const origin = new URL(baseURL as string).origin;
    test.skip(!canWrite(origin, testInfo.project.name), "creates API keys: not on a production target");
    const config = await servedConfig(playwright.request, origin);
    test.skip(!cognitoRegion(config.AUTH_ISSUER ?? ""), "the target does not sign in through Cognito");
  });

  test("a new key works on /v1, is listed once, and is refused after the delete", async ({
    playwright,
    baseURL,
  }) => {
    const session = await openSession(playwright.request, baseURL as string);
    let keyId: string | undefined;
    try {
      const key = await createKey(session, "lifecycle");
      keyId = key.id;
      // Checked as booleans so a failure never prints the key.
      expect(/^eve_[0-9a-f]{64}$/.test(key.token), "the key has the eve_ shape").toBe(true);
      const withKey = await session.as(key.token);

      // /v1/models is built from the providers that resolve on the target; JSC is everywhere.
      const jsc = await modelOf(withKey, "jsc");
      expect(jsc, "a jsc/ model is listed").toBeTruthy();

      const sync = await complete(withKey, jsc as string);
      expect(sync.status(), await sync.text()).toBe(200);
      const answer = await bodyOf<{ object: string; usage: Usage }>(sync);
      expect(answer.object).toBe("chat.completion");
      expect(Number.isInteger(answer.usage.prompt_tokens)).toBe(true);
      expect(Number.isInteger(answer.usage.completion_tokens)).toBe(true);
      expect(answer.usage.total_tokens).toBeGreaterThan(0);

      // Streamed: SSE chunks, then the [DONE] sentinel.
      const stream = await complete(withKey, jsc as string, { stream: true });
      expect(stream.status()).toBe(200);
      expect(stream.headers()["content-type"]).toContain("text/event-stream");
      const events = await stream.text();
      expect(events).toContain("chat.completion.chunk");
      expect(events).toContain("data: [DONE]");

      // Listed active with its suffix and without the plaintext. Polled: on staging and prod
      // the list may read a secondary that lags the create.
      await expect
        .poll(async () => {
          const list = await session.request.get("/api/users/api-keys");
          const rows = (await list.json()) as ApiKeyRow[];
          const row = rows.find((candidate) => candidate.id === key.id);
          return row?.status;
        })
        .toBe("active");
      const list = await session.request.get("/api/users/api-keys");
      const listed = ((await list.json()) as ApiKeyRow[]).find((row) => row.id === key.id);
      expect(listed?.token_suffix).toBe(key.token_suffix);
      expect(listed && "token" in listed, "the list carries no token field").toBe(false);
      expect((await list.text()).includes(key.token), "the list never shows the plaintext").toBe(false);

      expect(await revokeKey(session, key.id)).toBe(204);
      keyId = undefined;

      // The key lookup is a write (it stamps last_used_at), so it reads the primary: refused at once.
      const refused = await withKey.get("/api/v1/models");
      expect(refused.status()).toBe(401);
      expect(await refused.json()).toEqual({ detail: "Invalid or revoked API key" });
    } finally {
      if (keyId) await revokeKey(session, keyId);
      await session.dispose();
    }
  });

  test("garbage keys get 401 with a plain detail", async ({ playwright, baseURL }) => {
    const session = await openSession(playwright.request, baseURL as string);
    try {
      // Not eve_ plus 64 hex: refused on its shape, before any lookup.
      const malformed = await (await session.as("eve_garbage")).get("/api/v1/models");
      expect(malformed.status()).toBe(401);
      expect(await malformed.json()).toEqual({ detail: "Invalid API key format" });

      // Well formed but unknown: the same answer as a revoked key. The /v1 401 is a plain
      // detail, not the OpenAI error envelope (that one is used by the 429s only).
      const unknown = await session.as(`eve_${"0".repeat(64)}`);
      const response = await complete(unknown, "jsc/alias-eve", { max_tokens: 1 });
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({ detail: "Invalid or revoked API key" });
    } finally {
      await session.dispose();
    }
  });

  test("the eve/ model answers through a key @slow", async ({ playwright, baseURL }) => {
    test.skip(process.env.E2E_SLOW !== "1", "RunPod cold start: set E2E_SLOW=1 to run it");
    test.setTimeout(330_000);
    const session = await openSession(playwright.request, baseURL as string);
    let keyId: string | undefined;
    try {
      const key = await createKey(session, "eve");
      keyId = key.id;
      const withKey = await session.as(key.token);
      const eve = await modelOf(withKey, "eve");
      test.skip(!eve, "no eve/ provider on the target (OPENAI_PROXY_UPSTREAM_URL unset)");

      // The serverless worker can take minutes to start: retry for up to 4 minutes.
      let status = 0;
      for (let attempt = 0; attempt < 8 && status !== 200; attempt += 1) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 30_000));
        const response = await complete(withKey, eve as string);
        status = response.status();
        if (status === 200) {
          const answer = await bodyOf<{ usage: Usage }>(response);
          expect(Number.isInteger(answer.usage.completion_tokens)).toBe(true);
        }
      }
      expect(status, "eve/ completion after the cold start").toBe(200);
    } finally {
      if (keyId) await revokeKey(session, keyId);
      await session.dispose();
    }
  });
});
