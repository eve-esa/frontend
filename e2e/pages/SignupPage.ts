import type { Page } from "@playwright/test";

export type NewAccount = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

/**
 * Self-registration on the identity provider: Keycloak, realm eve, in the local compose
 * stack (e-mail as user name, e-mail verification on). Like LoginPage, this page is not
 * ours, so its selectors are Keycloak ids instead of test ids.
 */
export class SignupPage {
  constructor(private readonly page: Page) {}

  /**
   * From the sign-in form, opens the registration form and submits it. The realm's form may
   * not ask for a password: Keycloak then asks for one after the e-mail is verified. Leaves
   * the browser on the "verify your e-mail" page.
   */
  async register(account: NewAccount): Promise<void> {
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

  /**
   * Opens the verification link from the mail in the same browser. Keycloak then continues
   * to the app, after the "update password" step when registration asked for none; on a new
   * browser session it shows a "proceed" link first.
   */
  async followVerificationLink(link: string, password: string): Promise<void> {
    await this.page.goto(link);
    await this.page.waitForLoadState("networkidle");
    const fresh = this.page.locator("#password-new");
    if (await fresh.isVisible()) {
      await fresh.fill(password);
      await this.page.locator("#password-confirm").fill(password);
      await this.page.locator('#kc-passwd-update-form [type="submit"]').click();
    }
    const proceed = this.page.getByRole("link", { name: /proceed/i });
    if (await proceed.isVisible()) await proceed.click();
  }
}
