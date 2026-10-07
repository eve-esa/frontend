import {
  UserManager,
  WebStorageStateStore,
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

// userStore is localStorage, not the library default (sessionStorage): the
// session must survive a new tab and a browser restart, and the only thing
// that outlives the 1 hour Cognito login cookie is the refresh token. No
// silent_redirect_uri is configured, so signinSilent renews only through the
// refresh token grant. Any XSS could read sessionStorage too; the mitigations
// are refresh token rotation, revocation on sign-out and the CSP.
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
  userStore:
    typeof window !== "undefined" && window.localStorage
      ? new WebStorageStateStore({ store: window.localStorage })
      : undefined,
});

// The key oidc-client-ts stores the User under: "oidc." prefix of
// WebStorageStateStore plus UserManager's user:<authority>:<client_id>.
const USER_STORAGE_KEY = `oidc.user:${AUTH_ISSUER}:${AUTH_CLIENT_ID}`;

export const RENEW_LOCK_NAME = "eve-oidc-renew";

/**
 * One renew across every tab of this origin. Inside the lock the stored user
 * is read again: when another tab renewed while this one waited, its fresh
 * tokens are taken as they are. With refresh token rotation on, a second
 * refresh with the token the first one rotated away would fail.
 */
const renewAcrossTabs = async (): Promise<User | null> => {
  const before = await userManager.getUser();
  const renew = async (): Promise<User | null> => {
    const current = await userManager.getUser();
    if (
      current &&
      !current.expired &&
      current.access_token !== before?.access_token
    ) {
      // Tell this tab's AuthProvider about the user another tab stored.
      await userManager.events.load(current);
      return current;
    }
    return userManager.signinSilent();
  };
  const locks =
    typeof navigator !== "undefined" ? navigator.locks : undefined;
  return locks ? locks.request(RENEW_LOCK_NAME, renew) : renew();
};

let renewInFlight: Promise<User | null> | null = null;

/**
 * Single-flight wrapper around `signinSilent`.
 *
 * `oidc-client-ts` has no internal dedupe (upstream #1618): two concurrent
 * 401s would otherwise start two token requests at the IdP. Every caller that
 * wants a renew goes through here so at most one is in flight at a time, and
 * the Web Lock in renewAcrossTabs extends that to other tabs.
 */
export const renewToken = (): Promise<User | null> => {
  if (!renewInFlight) {
    renewInFlight = renewAcrossTabs().finally(() => {
      renewInFlight = null;
    });
  }
  return renewInFlight;
};

/**
 * Tries the stored refresh token once before an interactive sign-in. A new
 * tab, a reload after the access token expired or a browser restart finds
 * an expired User that react-oidc-context reports as signed out; without
 * this the refresh token sitting in the store would never be used. Resolves
 * true when the session is back, false when only a redirect can help (no
 * refresh token, or the IdP refused it: expired, revoked or rotated away).
 */
export const resumeStoredSession = async (): Promise<boolean> => {
  const stored = await userManager.getUser();
  if (!stored?.refresh_token) {
    return false;
  }
  try {
    return Boolean(await renewToken());
  } catch (error) {
    console.error("Stored session renew failed:", error);
    return false;
  }
};

// Anchored on the parsed hostname with a leading dot: a bare
// endsWith("amazonaws.com") would also match evil-amazonaws.com, and testing
// the raw issuer string would match amazonaws.com.attacker.com paths
// (CodeQL js/incomplete-url-substring-sanitization).
const isCognitoIssuer = (issuer: string): boolean => {
  try {
    return new URL(issuer).hostname.endsWith(".amazonaws.com");
  } catch {
    // Not a URL at all: treat as a generic provider.
    return false;
  }
};

/**
 * The arguments `signoutRedirect` needs for a given issuer, exported for
 * tests. Cognito's `/logout` does not honour the standard
 * `post_logout_redirect_uri` / `id_token_hint` pair; it wants `client_id` +
 * `logout_uri` instead. Every other provider gets the plain RP-initiated
 * logout: the library already sends `client_id` alongside
 * `post_logout_redirect_uri`, which Keycloak accepts without an
 * id_token_hint.
 */
export const buildSignoutArgs = (
  issuer: string,
  clientId: string,
  origin: string
): SignoutRedirectArgs | undefined =>
  isCognitoIssuer(issuer)
    ? { extraQueryParams: { client_id: clientId, logout_uri: origin } }
    : undefined;

let signoutInProgress = false;

/**
 * True once a sign-out has started. PrivateRoute and the axios 401 handler
 * consult it so neither starts a competing signinRedirect. The redirect
 * navigator only resolves on pageshow, so in the success case this stays
 * true for the remaining life of the page.
 */
export const isSignoutInProgress = (): boolean => signoutInProgress;

/**
 * Only for a redirect that never left the page (metadata fetch failure and
 * the like): clears the latch so the app can recover.
 */
export const endSignout = (): void => {
  signoutInProgress = false;
};

/**
 * Marks sign-out as started synchronously, before anything else runs, and
 * returns the args for `useAuth().signoutRedirect()`.
 *
 * The refresh token is revoked first. Cognito's `/logout` ignores
 * `id_token_hint`, so the stored user is removed
 * first to keep the token out of the redirect URL and history. Other
 * providers are left alone: oidc-client-ts reads `id_token_hint` from the
 * stored user before removing it, and Keycloak needs the hint to skip its
 * logout confirmation page.
 */
export const beginSignout = async (): Promise<
  SignoutRedirectArgs | undefined
> => {
  signoutInProgress = true;
  // The refresh token outlives the IdP session by up to 30 days, so ending
  // that session alone would leave it usable from storage. The revocation
  // endpoint comes from the discovery document.
  try {
    await userManager.revokeTokens(["refresh_token"]);
  } catch (error) {
    // Never block a sign-out: the stored user is still removed below or by
    // signoutRedirect.
    console.error("Refresh token revocation failed:", error);
  }
  if (isCognitoIssuer(AUTH_ISSUER)) {
    await userManager.removeUser();
  }
  return buildSignoutArgs(AUTH_ISSUER, AUTH_CLIENT_ID, PAGE_ORIGIN);
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

// Sign-out in another tab removes the shared stored user; this tab drops to
// the signed-out state too instead of keeping tokens it holds in memory.
// removeUser raises the unloaded event AuthProvider listens to.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("storage", (event) => {
    if (
      event.storageArea === window.localStorage &&
      (event.key === USER_STORAGE_KEY || event.key === null) &&
      event.newValue === null
    ) {
      void userManager.removeUser();
    }
  });
}
