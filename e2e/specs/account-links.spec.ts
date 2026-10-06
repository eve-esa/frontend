import type { Page } from "@playwright/test";
import { ChatPage, LoginPage, LogoutDialog, type UserMenuLink } from "../pages";
import { canWrite, expect, signIn, skipOnboarding, test } from "../fixtures";

const LINKS: { label: string; testId: UserMenuLink; key: string }[] = [
  { label: "About Us", testId: "user-menu-about", key: "ABOUT_US_URL" },
  { label: "Contact Us", testId: "user-menu-contact", key: "CONTACT_URL" },
  { label: "Privacy Policy", testId: "user-menu-privacy", key: "PRIVACY_POLICY_URL" },
];

/**
 * Host, path and query of a link. The trailing slash is dropped: the external site answers
 * `/about` with a 301 to `/about/`, and the tab reports the URL after that redirect.
 */
const linkTarget = (url: string): string => {
  const parsed = new URL(url);
  return `${parsed.host}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`;
};

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
      expect(linkTarget(opened)).toBe(linkTarget(configured));
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

      const chat = new ChatPage(page);
      const logout = new LogoutDialog(page, chat);
      await logout.open();
      await logout.confirm();
      await new LoginPage(page).expectForm(origin);

      // Session storage belongs to the tab and the origin, so the app's entries outlive the
      // trip to the provider. Back on the app with the provider unreachable, the app cannot
      // redirect again (it needs the provider's metadata first), so its storage stays
      // readable.
      await page.route((url) => url.origin !== origin, (route) => route.abort());
      await page.goto("/");
      expect(new URL(page.url()).origin).toBe(origin);
      expect(await oidcUserKeys(page)).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
