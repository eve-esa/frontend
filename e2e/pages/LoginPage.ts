import { expect, type Page } from "@playwright/test";

/**
 * The identity provider page the app redirects to: the Cognito managed login
 * on AWS, Keycloak (realm eve) in the local compose stack. This page is not
 * ours, so it is the one place where selectors are roles and names instead of
 * test ids.
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  /** True when the browser is on the identity provider, not on the app. */
  isOnIdentityProvider(appOrigin: string): boolean {
    const url = new URL(this.page.url());
    return url.origin !== appOrigin;
  }

  /** Waits for the identity provider's sign-in form, the first field it asks for. */
  async expectForm(appOrigin: string): Promise<void> {
    await expect.poll(() => this.isOnIdentityProvider(appOrigin), { timeout: 45_000 }).toBe(true);
    await expect(
      this.page
        .locator('#username:visible, input[name="username"]:visible, input[type="email"]:visible')
        .first(),
    ).toBeVisible({ timeout: 45_000 });
  }

  async signIn(email: string, password: string): Promise<void> {
    // The managed login page is a Remix app: filling before hydration loses the values.
    await this.page.waitForLoadState("networkidle");
    const keycloak = this.page.locator("#kc-login");
    if (await keycloak.isVisible()) {
      await this.page.locator("#username").fill(email);
      await this.page.locator("#password").fill(password);
      await keycloak.click();
      return;
    }
    const username = this.page
      .locator('input[name="username"]:visible, input[type="email"]:visible')
      .first();
    const secret = this.page
      .locator('input[name="password"]:visible, input[type="password"]:visible')
      .first();
    const submit = this.page.getByRole("button", { name: /^(sign in|next|continue)$/i }).first();
    await username.fill(email);
    if (!(await secret.isVisible())) {
      await submit.click();
      await expect(secret).toBeVisible({ timeout: 15_000 });
    }
    await secret.fill(password);
    await this.page.getByRole("button", { name: /^sign in$/i }).first().click();
  }
}
