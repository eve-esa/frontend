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
  type ApiSession,
} from "./session";

type TokenUsage = {
  unlimited: boolean;
  used_tokens: number;
  max_tokens: number | null;
  remaining_tokens: number | null;
  used_ratio: number | null;
};

// A trace would hold the bearer, the plaintext key and the Cognito password.
test.use({ trace: "off" });

async function usage(session: ApiSession): Promise<TokenUsage> {
  const response = await session.request.get("/api/users/me/token-usage");
  expect(response.status()).toBe(200);
  return (await response.json()) as TokenUsage;
}

test.describe("token budget on the /v1 gateway @dev", () => {
  test.beforeEach(async ({ playwright, baseURL }, testInfo) => {
    const origin = new URL(baseURL as string).origin;
    test.skip(!canWrite(origin, testInfo.project.name), "spends budget: not on a production target");
    const config = await servedConfig(playwright.request, origin);
    test.skip(!cognitoRegion(config.AUTH_ISSUER ?? ""), "the target does not sign in through Cognito");
  });

  test("one completion raises used_tokens by exactly its usage.total_tokens", async ({
    playwright,
    baseURL,
  }) => {
    const session = await openSession(playwright.request, baseURL as string);
    let keyId: string | undefined;
    try {
      const before = await usage(session);
      // An unlimited group reserves and charges nothing: there is no delta to see.
      test.skip(before.unlimited, "the test account is in an unlimited group");
      expect(before.remaining_tokens ?? 0, "budget left for one call").toBeGreaterThan(100);

      const key = await createKey(session, "budget");
      keyId = key.id;
      const withKey = await session.as(key.token);
      const jsc = await modelOf(withKey, "jsc");
      expect(jsc, "a jsc/ model is listed").toBeTruthy();
      const response = await complete(withKey, jsc as string);
      expect(response.status(), await response.text()).toBe(200);
      const total = (await bodyOf<{ usage: { total_tokens: number } }>(response)).usage.total_tokens;
      expect(total).toBeGreaterThan(0);

      // What the gateway does (backend src/routers/openai_proxy.py, token_rate_limiter.py):
      // before the upstream call it reserves an estimate of the request text with one $inc,
      // and once the response is in it settles with a second $inc of (billed - reserved),
      // where billed is the upstream usage.total_tokens when it is a positive integer.
      // Net effect of one call: used_after = used_before + usage.total_tokens.
      // Polled: a staging or prod secondary may lag, and a read between the two writes
      // shows the estimate, not the bill. The workers run one test at a time, so nothing
      // else in the suite spends this budget meanwhile; a person using the same account does.
      await expect
        .poll(
          async () => {
            const after = await usage(session);
            return { used: after.used_tokens, remaining: after.remaining_tokens };
          },
          { timeout: 15_000 },
        )
        .toEqual({
          used: before.used_tokens + total,
          remaining: (before.remaining_tokens ?? 0) - total,
        });
    } finally {
      if (keyId) await revokeKey(session, keyId);
      await session.dispose();
    }
  });

  test("an exhausted budget answers 429 token_budget_exceeded", async ({ playwright, baseURL }) => {
    // Precondition, prepared by the operator: an account with a few hundred tokens left at
    // most. The back office only moves a user between groups and every deployed group has a
    // large cap (FREE_TOKENS 500000), so the low cap is an env setting (compose with
    // FREE_TOKENS=100) or a test account whose rate_limit_tokens_used was set near its cap.
    // The test spends the rest; the account stays exhausted until its period resets.
    const email = process.env.E2E_BUDGET_EXHAUSTED_EMAIL ?? "";
    const password = process.env.E2E_BUDGET_EXHAUSTED_PASSWORD ?? "";
    test.skip(
      !email || !password,
      "needs E2E_BUDGET_EXHAUSTED_EMAIL and E2E_BUDGET_EXHAUSTED_PASSWORD, an account with a few hundred tokens left",
    );
    const session = await openSession(playwright.request, baseURL as string, { email, password });
    let keyId: string | undefined;
    try {
      const before = await usage(session);
      expect(before.unlimited, "the exhausted account must be in a capped group").toBe(false);
      expect(before.remaining_tokens ?? 0, "a few hundred tokens left at most").toBeLessThan(1_000);

      const key = await createKey(session, "budget-exhausted");
      keyId = key.id;
      const withKey = await session.as(key.token);
      const jsc = (await modelOf(withKey, "jsc")) as string;

      // The gateway admits a call while used < cap (one call may cross it), then refuses
      // before any upstream call. 20 calls cover about 600 tokens.
      let refused = await complete(withKey, jsc);
      for (let call = 1; call < 20 && refused.status() === 200; call += 1) {
        refused = await complete(withKey, jsc);
      }
      expect(refused.status(), await refused.text()).toBe(429);
      const body = await bodyOf<{ detail: unknown; error: { code: string; type: string } }>(refused);
      // OpenAI envelope; detail is a plain string here, there is no detail.code.
      expect(body.error.code).toBe("token_budget_exceeded");
      expect(body.error.type).toBe("insufficient_quota");
      expect(String(body.detail)).toContain("Token budget exceeded for group");
      expect(refused.headers()["x-should-retry"]).toBe("false");
      expect(Number(refused.headers()["retry-after"])).toBeGreaterThanOrEqual(1);

      await expect.poll(async () => (await usage(session)).remaining_tokens).toBe(0);
    } finally {
      if (keyId) await revokeKey(session, keyId);
      await session.dispose();
    }
  });
});
