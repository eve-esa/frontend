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

export const IDP_REQUEST_TIMEOUT_S = 10;

// A stored access token with more than this left is adopted instead of
// refreshed: the expiring event fires 60 s before expiry and postStream asks
// for 120 s, so both still refresh, while a tab whose throttled timer fires
// late takes the token another tab already renewed.
export const RENEW_MARGIN_S = 120;

// userStore is localStorage, not the library default (sessionStorage): the
// session must survive a new tab and a browser restart, and the only thing
// that outlives the 1 hour Cognito login cookie is the refresh token. No
// silent_redirect_uri is configured, so signinSilent renews only through the
// refresh token grant. Any XSS could read sessionStorage too; the mitigations
// are revocation on sign-out (this module), refresh token rotation and a CSP
// in report-only mode (live on dev since infra #126 and #127, not yet on
// staging and prod).
// requestTimeoutInSeconds bounds every IdP call the library makes (metadata,
// token, revoke), so a hung request cannot hold the cross-tab renew lock.
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
  requestTimeoutInSeconds: IDP_REQUEST_TIMEOUT_S,
  userStore:
    typeof window !== "undefined" && window.localStorage
      ? new WebStorageStateStore({ store: window.localStorage })
      : undefined,
});

// The key oidc-client-ts stores the User under: "oidc." prefix of
// WebStorageStateStore plus UserManager's user:<authority>:<client_id>.
const USER_STORAGE_KEY = `oidc.user:${AUTH_ISSUER}:${AUTH_CLIENT_ID}`;

export const RENEW_LOCK_NAME = "eve-oidc-renew";

// Builds before this one kept the user, refresh token included, in
// sessionStorage. Dropped once on boot so an open tab does not keep a copy
// that no sign-out reaches.
if (typeof window !== "undefined") {
  try {
    window.sessionStorage?.removeItem(USER_STORAGE_KEY);
  } catch {
    // Storage blocked: nothing to clean up.
  }
}

/** Runs `task` holding the cross-tab renew lock, or directly without Web Locks. */
const withRenewLock = async <T>(task: () => Promise<T>): Promise<T> => {
  const locks =
    typeof navigator !== "undefined" ? navigator.locks : undefined;
  return locks ? await locks.request(RENEW_LOCK_NAME, task) : task();
};

let signoutInProgress = false;
let signedOutElsewhere = false;

/** Why the stored user went away: shown by the signed-out view of other tabs. */
export type SignedOutReason = "signed-out" | "expired";

// Written next to the user before it is removed, so the storage event in
// other tabs can tell a sign-out from a dead refresh token.
const SIGNED_OUT_REASON_KEY = "eve.oidc.signed_out_reason";
let signedOutReason: SignedOutReason = "signed-out";

const recordSignedOutReason = (reason: SignedOutReason): void => {
  try {
    window.localStorage?.setItem(SIGNED_OUT_REASON_KEY, reason);
  } catch {
    // Storage blocked: other tabs fall back to the sign-out wording.
  }
};

const readSignedOutReason = (): SignedOutReason => {
  try {
    return window.localStorage?.getItem(SIGNED_OUT_REASON_KEY) === "expired"
      ? "expired"
      : "signed-out";
  } catch {
    return "signed-out";
  }
};

/**
 * One renew across every tab of this origin. Inside the lock the stored user
 * is read again: when it still has more than RENEW_MARGIN_S left (another
 * tab renewed while this one waited, or its timer fired late) it is adopted
 * as it is. With refresh token rotation on, a second refresh with the token
 * the first one rotated away would fail. `rejectedToken` is the access token
 * the API just refused: never adopted, whatever its expiry says.
 */
const renewAcrossTabs = (rejectedToken?: string): Promise<User | null> =>
  withRenewLock(async () => {
    // A sign-out started while this renew waited: storing a fresh user now
    // would bring the session back after the revoke.
    if (signoutInProgress || signedOutElsewhere) {
      return null;
    }
    const current = await userManager.getUser();
    if (
      current &&
      !current.expired &&
      (current.expires_in ?? 0) > RENEW_MARGIN_S &&
      current.access_token !== rejectedToken
    ) {
      // Tell this tab's AuthProvider about the user another tab stored.
      await userManager.events.load(current);
      return current;
    }
    return userManager.signinSilent({
      silentRequestTimeoutInSeconds: IDP_REQUEST_TIMEOUT_S,
    });
  });

let renewInFlight: Promise<User | null> | null = null;

/**
 * Single-flight wrapper around `signinSilent`.
 *
 * `oidc-client-ts` has no internal dedupe (upstream #1618): two concurrent
 * 401s would otherwise start two token requests at the IdP. Every caller that
 * wants a renew goes through here so at most one is in flight at a time, and
 * the Web Lock in renewAcrossTabs extends that to other tabs.
 */
export const renewToken = (rejectedToken?: string): Promise<User | null> => {
  if (!renewInFlight) {
    renewInFlight = renewAcrossTabs(rejectedToken).finally(() => {
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
    // The refresh token is dead (expired, revoked or rotated away): drop
    // the user, id token and e-mail included, instead of keeping it on disk
    // and spending a failing token request on every boot. Inside the lock
    // and only while the refused token is still the stored one: another tab
    // may have stored a live user meanwhile.
    if ((error as { error?: string } | null)?.error === "invalid_grant") {
      await withRenewLock(async () => {
        const current = await userManager.getUser();
        if (current?.refresh_token === stored.refresh_token) {
          recordSignedOutReason("expired");
          await userManager.removeUser();
        }
      });
    }
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

/**
 * True once a sign-out has started here or in another tab. PrivateRoute and
 * the axios 401 handler consult it so neither starts a competing
 * signinRedirect. The redirect navigator only resolves on pageshow, so in
 * the success case this stays true for the remaining life of the page.
 */
export const isSignoutInProgress = (): boolean =>
  signoutInProgress || signedOutElsewhere;

/**
 * True once another tab signed out. This tab then shows a signed-out view
 * with a sign-in button instead of redirecting by itself: an automatic
 * authorize here would race the other tab's IdP logout, still find the IdP
 * cookie and store a fresh, unrevoked refresh token.
 */
export const isSignedOutElsewhere = (): boolean => signedOutElsewhere;

/** What the signed-out view says: a sign-out elsewhere or an expired session. */
export const getSignedOutReason = (): SignedOutReason => signedOutReason;

/** The user chose to sign in again from the signed-out view. */
export const clearSignedOutElsewhere = (): void => {
  signedOutElsewhere = false;
};

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
  recordSignedOutReason("signed-out");
  // A renew already running in this tab or another one finishes first, so
  // the token revoked below is the one in storage and no renew stores a new
  // user after it.
  await renewInFlight?.catch(() => null);
  await withRenewLock(async () => {
    // The refresh token outlives the IdP session by up to 30 days, so ending
    // that session alone would leave it usable from storage. The revocation
    // endpoint comes from the discovery document.
    try {
      await userManager.revokeTokens(["refresh_token"]);
    } catch (error) {
      // A non-200 or a timeout from the revocation endpoint never blocks a
      // sign-out: the stored user is still removed below or by
      // signoutRedirect.
      console.warn("Refresh token revocation failed:", error);
    }
    if (isCognitoIssuer(AUTH_ISSUER)) {
      await userManager.removeUser();
    }
  });
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
// the signed-out view too instead of keeping tokens it holds in memory. The
// latch is set before removeUser raises the unloaded event AuthProvider
// listens to, so PrivateRoute renders the signed-out view, not a redirect.
// A user stored again later (a sign-in in any tab) brings this tab back
// through a full reload, so nothing cached for the previous user (the query
// cache above all) is ever shown under the new user's token.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("storage", (event) => {
    if (
      event.storageArea !== window.localStorage ||
      (event.key !== USER_STORAGE_KEY && event.key !== null)
    ) {
      return;
    }
    if (event.newValue === null) {
      signedOutReason = readSignedOutReason();
      signedOutElsewhere = true;
      void userManager.removeUser();
      return;
    }
    if (signedOutElsewhere && !signoutInProgress) {
      void userManager.getUser().then((user) => {
        if (user && !user.expired) {
          window.location.reload();
        }
      });
    }
  });
}
