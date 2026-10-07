import type { Page } from "@playwright/test";

type StoredUser = { access_token?: string; refresh_token?: string; expires_at?: number };

/**
 * The OIDC user the app keeps in local storage (`oidc.user:<issuer>:<client_id>`), read and
 * changed on the page's current origin. Not a view: the app renders nothing for it, so there
 * is no test id to select.
 */
export class OidcStorage {
  constructor(private readonly page: Page) {}

  /** Local storage keys holding the signed-in OIDC user. */
  userKeys(): Promise<string[]> {
    return this.page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith("oidc.user:")),
    );
  }

  /** The stored user, or null when none is stored. */
  user(): Promise<StoredUser | null> {
    return this.page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith("oidc.user:"));
      const raw = key ? localStorage.getItem(key) : null;
      return raw ? (JSON.parse(raw) as StoredUser) : null;
    });
  }

  /** Moves the stored access token expiry into the past, as after an hour away. */
  expireAccessToken(): Promise<void> {
    return this.page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith("oidc.user:"));
      const raw = key ? localStorage.getItem(key) : null;
      if (!key || !raw) throw new Error("no oidc.user: entry in local storage");
      const user = JSON.parse(raw) as { expires_at?: number };
      user.expires_at = Math.floor(Date.now() / 1000) - 60;
      localStorage.setItem(key, JSON.stringify(user));
    });
  }
}
