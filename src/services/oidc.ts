import {
  UserManager,
  type SignoutRedirectArgs,
  type User,
} from "oidc-client-ts";
import { configValue } from "@/utilities/runtimeConfig";

/**
 * The single OIDC client for the whole app.
 *
 * One `UserManager` is created here and shared everywhere: `AuthProvider`
 * receives it through its `userManager` prop, and `axios.ts` / `streaming.ts`
 * import the same instance to read and renew the token. Creating a second one
 * would give the interceptors a session the provider does not know about.
 *
 * Provider-conditional behaviour (today: Cognito's non-standard logout) lives
 * in this module and nowhere else.
 */

export const CALLBACK_PATH = "/callback";

const PAGE_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "";

const AUTH_ISSUER = configValue("AUTH_ISSUER") ?? "";
const AUTH_CLIENT_ID = configValue("AUTH_CLIENT_ID") ?? "";

// userStore is left at the library default (sessionStorage): a narrower XSS
// blast radius than localStorage, and persistence across tabs comes from the
// IdP session cookie via silent sign-in (see the identity ADR).
// automaticSilentRenew stays off: the library's internal timer calls
// signinSilent directly and would bypass the single-flight wrapper below;
// the expiring event subscription at the bottom replaces it.
export const userManager = new UserManager({
  authority: AUTH_ISSUER,
  client_id: AUTH_CLIENT_ID,
  redirect_uri: `${PAGE_ORIGIN}${CALLBACK_PATH}`,
  post_logout_redirect_uri: PAGE_ORIGIN,
  scope: configValue("AUTH_SCOPE") ?? "openid profile email",
  automaticSilentRenew: false,
});

let renewInFlight: Promise<User | null> | null = null;

/**
 * Single-flight wrapper around `signinSilent`.
 *
 * `oidc-client-ts` has no internal dedupe (upstream #1618): two concurrent
 * 401s would otherwise start two token requests at the IdP. Every caller that
 * wants a renew goes through here so at most one is in flight at a time.
 */
export const renewToken = (): Promise<User | null> => {
  if (!renewInFlight) {
    renewInFlight = userManager.signinSilent().finally(() => {
      renewInFlight = null;
    });
  }
  return renewInFlight;
};

const isCognitoIssuer = (issuer: string): boolean => {
  try {
    return new URL(issuer).hostname.endsWith("amazonaws.com");
  } catch {
    return false;
  }
};

/**
 * The arguments `signoutRedirect` needs for a given issuer, exported for
 * tests. Cognito's `/logout` does not honour the standard
 * `post_logout_redirect_uri` / `id_token_hint` pair; it wants `client_id` +
 * `logout_uri` instead. Every other provider gets `client_id` too: the user
 * is removed from the store before the redirect (see below), and without an
 * id_token_hint Keycloak only accepts `post_logout_redirect_uri` when the
 * client identifies itself.
 */
export const buildSignoutArgs = (
  issuer: string,
  clientId: string,
  origin: string
): SignoutRedirectArgs =>
  isCognitoIssuer(issuer)
    ? { extraQueryParams: { client_id: clientId, logout_uri: origin } }
    : { extraQueryParams: { client_id: clientId } };

/**
 * End the IdP session and redirect back to the app origin.
 *
 * The stored user is removed BEFORE the redirect: with a user still in the
 * store the library appends its id_token as `id_token_hint`, leaking a token
 * into the logout URL and browser history. The price is that Keycloak may
 * show a logout confirmation screen; acceptable.
 */
export const signoutRedirect = async (): Promise<void> => {
  await userManager.removeUser();
  return userManager.signoutRedirect(
    buildSignoutArgs(AUTH_ISSUER, AUTH_CLIENT_ID, PAGE_ORIGIN)
  );
};

// Proactive renewal, replacing automaticSilentRenew: the library raises
// AccessTokenExpiring shortly before expiry and the renew itself goes
// through the same single-flight path the interceptors use.
userManager.events.addAccessTokenExpiring(() => {
  renewToken().catch((error) => {
    // A failed background renew is not fatal here: the next 401 drives
    // interactive recovery through the axios interceptor.
    console.error("Proactive token renew failed:", error);
  });
});
