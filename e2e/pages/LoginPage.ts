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

  /**
   * Keycloak self-registration (local compose stack, realm eve: e-mail as user name, e-mail
   * verification on). The realm's form may not ask for a password: then Keycloak asks for one
   * after the e-mail is verified (`setPasswordIfAsked`). Leaves the browser on the "verify
   * your e-mail" page.
   */
  async register(account: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    await this.page.locator("#kc-registration a").click();
    await this.page.locator("#email").fill(account.email);
    await this.page.locator("#firstName").fill(account.firstName);
    await this.page.locator("#lastName").fill(account.lastName);
    if (await this.page.locator("#password").isVisible()) {
      await this.page.locator("#password").fill(account.password);
      await this.page.locator("#password-confirm").fill(account.password);
    }
    await this.page.locator('#kc-register-form [type="submit"]').click();
  }

  /** Keycloak "update password" required action, shown when registration asked for none. */
  async setPasswordIfAsked(password: string): Promise<boolean> {
    const fresh = this.page.locator("#password-new");
    if (!(await fresh.isVisible())) return false;
    await fresh.fill(password);
    await this.page.locator("#password-confirm").fill(password);
    await this.page.locator('#kc-passwd-update-form [type="submit"]').click();
    return true;
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
