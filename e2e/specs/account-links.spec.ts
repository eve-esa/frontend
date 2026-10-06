import type { Page } from "@playwright/test";
import { ChatPage, LoginPage, LogoutDialog, type UserMenuLink } from "../pages";
import { canWrite, expect, signIn, skipOnboarding, test } from "../fixtures";

const LINKS: { label: string; testId: UserMenuLink; key: string }[] = [
  { label: "About Us", testId: "user-menu-about", key: "ABOUT_US_URL" },
  { label: "Contact Us", testId: "user-menu-contact", key: "CONTACT_URL" },
  { label: "Privacy Policy", testId: "user-menu-privacy", key: "PRIVACY_POLICY_URL" },
];

/** Session storage keys holding the signed-in OIDC user, on the page's current origin. */
const oidcUserKeys = (page: Page): Promise<string[]> =>
  page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("oidc.user:")));

test.describe("account links @prod", () => {
  for (const link of LINKS) {
    test(`${link.label} opens the configured URL in a new tab`, async ({ chat }) => {
      const configured = ((await chat.servedConfig())[link.key] ?? "").trim();
      test.skip(!configured, `${link.key} is empty in window.__EVE_CONFIG__`);

      const opened = await chat.openedLinkUrl(link.testId);
      expect(new URL(opened).protocol).toMatch(/^https?:$/);
      expect(new URL(opened).href).toBe(new URL(configured).href);
    });
  }

  // Its own hosted login in a fresh context: the sign-out ends that session only, never the
  // one in the worker's stored auth state the other specs reuse.
  test("sign-out lands on the hosted login and drops the OIDC user", async ({
    browser,
    baseURL,
  }, testInfo) => {
    const origin = new URL(baseURL as string).origin;
    const context = await browser.newContext({ baseURL });
    try {
      await skipOnboarding(context, origin);
      const page = await context.newPage();
      await signIn(page, origin, canWrite(origin, testInfo.project.name));
      expect(await oidcUserKeys(page)).not.toHaveLength(0);

      // The app tab's session storage is unreadable once the provider's page has replaced
      // it, so the first navigation away from the app is held until it has been read.
      let keysAtLeave: string[] | undefined;
      let readError: unknown;
      await page.route(
        (url) => url.origin !== origin,
        async (route) => {
          const request = route.request();
          if (
            keysAtLeave === undefined &&
            readError === undefined &&
            request.isNavigationRequest() &&
            request.frame() === page.mainFrame()
          ) {
            try {
              keysAtLeave = await oidcUserKeys(page);
            } catch (error) {
              readError = error;
            }
          }
          await route.continue();
        },
      );

      const chat = new ChatPage(page);
      const logout = new LogoutDialog(page, chat);
      await logout.open();
      await logout.confirm();

      await new LoginPage(page).expectForm(origin);
      expect(readError).toBeUndefined();
      expect(keysAtLeave).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
