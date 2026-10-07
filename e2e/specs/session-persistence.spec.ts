import { ChatPage, LoginPage, LogoutDialog, OidcStorage, SignedOutPage } from "../pages";
import { canWrite, expect, signIn, skipOnboarding, test } from "../fixtures";

/**
 * The session outlives the tab: the OIDC user, refresh token included, is in local storage,
 * and an expired access token is renewed with the refresh token before any redirect to the
 * identity provider. Its own hosted login in a fresh context, so the sign-out at the end
 * never touches the worker's stored auth state the other specs reuse.
 */
test.describe("session persistence", () => {
  test("a new context with an expired access token resumes without the hosted login", async ({
    browser,
    baseURL,
  }, testInfo) => {
    const origin = new URL(baseURL as string).origin;
    const first = await browser.newContext({ baseURL });
    let state: Awaited<ReturnType<typeof first.storageState>>;
    try {
      await skipOnboarding(first, origin);
      const page = await first.newPage();
      await signIn(page, origin, canWrite(origin, testInfo.project.name));
      const storage = new OidcStorage(page);
      expect((await storage.user())?.refresh_token).toBeTruthy();
      await storage.expireAccessToken();
      state = await first.storageState();
    } finally {
      await first.close();
    }

    // App origin storage only, no cookies: the identity provider's login cookie stays
    // behind, so only the stored refresh token can bring the session back.
    const second = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: state.origins.filter((o) => o.origin === origin) },
    });
    try {
      await skipOnboarding(second, origin);
      const page = await second.newPage();
      const foreignNavigations: string[] = [];
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame() && new URL(frame.url()).origin !== origin) {
          foreignNavigations.push(frame.url());
        }
      });
      const refreshGrants: string[] = [];
      page.on("request", (request) => {
        if (request.method() === "POST" && /grant_type=refresh_token/.test(request.postData() ?? "")) {
          refreshGrants.push(request.url());
        }
      });

      await page.goto("/");
      const chat = new ChatPage(page);
      await chat.composer.waitReady();
      expect(foreignNavigations).toEqual([]);
      expect(refreshGrants).toHaveLength(1);
      const storage = new OidcStorage(page);
      expect((await storage.user())?.expires_at ?? 0).toBeGreaterThan(Date.now() / 1000);

      const logout = new LogoutDialog(page, chat);
      await logout.open();
      await logout.confirm();
      await new LoginPage(page).expectForm(origin);

      // Back on the app with the provider unreachable, the app cannot redirect again (it
      // needs the provider's metadata first), so its storage stays readable.
      await page.route((url) => url.origin !== origin, (route) => route.abort());
      await page.goto("/");
      expect(new URL(page.url()).origin).toBe(origin);
      expect(await storage.userKeys()).toEqual([]);
    } finally {
      await second.close();
    }
  });

  test("a sign-out in one tab signs the other tab out without a redirect", async ({
    browser,
    baseURL,
  }, testInfo) => {
    const origin = new URL(baseURL as string).origin;
    const context = await browser.newContext({ baseURL });
    try {
      await skipOnboarding(context, origin);
      const first = await context.newPage();
      await signIn(first, origin, canWrite(origin, testInfo.project.name));
      const second = await context.newPage();
      await second.goto("/");
      await new ChatPage(second).composer.waitReady();
      const foreignNavigations: string[] = [];
      second.on("framenavigated", (frame) => {
        if (frame === second.mainFrame() && new URL(frame.url()).origin !== origin) {
          foreignNavigations.push(frame.url());
        }
      });

      const chat = new ChatPage(first);
      const logout = new LogoutDialog(first, chat);
      await logout.open();
      await logout.confirm();
      await new LoginPage(first).expectForm(origin);

      // The other tab shows the signed-out view and never starts its own sign-in.
      await expect(new SignedOutPage(second).root).toBeVisible();
      expect(foreignNavigations).toEqual([]);
      expect(await new OidcStorage(second).userKeys()).toEqual([]);

      // A reload of the tab that signed out asks for the password again.
      await first.goto("/");
      await new LoginPage(first).expectForm(origin);
      expect(foreignNavigations).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
