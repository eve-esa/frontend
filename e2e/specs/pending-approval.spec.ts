import { PendingApprovalPage } from "../pages";
import { expect, test } from "../fixtures";
import { contrastRatio, MIN_CONTRAST } from "../fixtures/contrast";

test.describe("on hold page @prod", () => {
  test("a pending account sees the on hold text with readable contrast", async ({
    authedPage: page,
    api,
  }) => {
    // The real account is approved: its profile answers 200 through the API.
    expect((await api.get("/users/me")).status).toBe(200);

    // What the backend answers a signed-in account past the approval limit.
    await page.route(
      (url) => url.pathname.endsWith("/users/me"),
      (route) =>
        route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ detail: { code: "pending_approval" } }),
        }),
    );
    await page.goto("/");
    const pending = new PendingApprovalPage(page);
    await expect(pending.root).toBeVisible({ timeout: 30_000 });
    await expect(pending.message).toContainText("on hold");

    const ratio = await contrastRatio(pending.message);
    expect(ratio, `contrast ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});
