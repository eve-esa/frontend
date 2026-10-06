import { expect, test } from "@playwright/test";
import { canWrite } from "../fixtures";
import { cognitoRegion, openSession, servedConfig } from "./session";

// A trace would hold the bearer and the Cognito password.
test.use({ trace: "off" });

const CALLS = 40;

/**
 * The request rate limiter in shadow mode counts refusals and never answers them. 40 calls
 * at once on the errlog class (POST /api/log-error, 30 per minute, burst 30) leave about 10
 * past the bucket: in shadow each one still answers 200.
 *
 * The served backend does not expose its limiter mode. Under REQUEST_RATE_LIMIT_MODE=enforce
 * this spec fails with 429 rate_limited, which is the enforce contract, not a bug. A pass
 * cannot tell shadow from the limiter being off either: the proof that shadow counted is in
 * the telemetry of the run window (log line "rate_limit.limited subject_kind=user
 * class=errlog mode=shadow" at INFO, metric eve.rate_limit.decisions with decision limited).
 * Side effect: 40 error_log rows with error_type RateLimitShadowTest, which no API deletes.
 */
test.describe("request rate limiter in shadow mode @dev", () => {
  test("calls past the errlog burst all go through", async ({ playwright, baseURL }, testInfo) => {
    const origin = new URL(baseURL as string).origin;
    test.skip(!canWrite(origin, testInfo.project.name), "writes error logs: not on a production target");
    const config = await servedConfig(playwright.request, origin);
    test.skip(!cognitoRegion(config.AUTH_ISSUER ?? ""), "the target does not sign in through Cognito");

    const session = await openSession(playwright.request, origin);
    try {
      const responses = await Promise.all(
        Array.from({ length: CALLS }, (_, index) =>
          session.request.post("/api/log-error", {
            data: {
              error_type: "RateLimitShadowTest",
              error_message: "rate limiter shadow test, ignore",
              component: "E2E",
              metadata: { suite: "rate-limit-shadow", call: index },
            },
          }),
        ),
      );
      const outcomes = await Promise.all(
        responses.map(async (response) => ({ status: response.status(), body: await response.text() })),
      );
      const refused = outcomes.filter(
        (outcome) => outcome.status !== 200 || outcome.body.includes("rate_limited"),
      );
      expect(
        refused,
        "a 429 rate_limited means the backend runs REQUEST_RATE_LIMIT_MODE=enforce",
      ).toEqual([]);
    } finally {
      await session.dispose();
    }
  });
});
