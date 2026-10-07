import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

// The real UserManager touches web storage at construction, which the
// plain Node test environment does not have; the mock also lets each test
// inspect the settings the module builds and script signinSilent.
vi.mock("oidc-client-ts", () => {
  class UserManager {
    settings: Record<string, unknown>;
    signinSilent = vi.fn();
    signoutRedirect = vi.fn(() => Promise.resolve());
    removeUser = vi.fn(() => Promise.resolve());
    revokeTokens = vi.fn(() => Promise.resolve());
    getUser = vi.fn(() => Promise.resolve(null));
    events = {
      addAccessTokenExpiring: vi.fn(),
      load: vi.fn(() => Promise.resolve()),
    };

    constructor(settings: Record<string, unknown>) {
      this.settings = settings;
    }
  }
  class WebStorageStateStore {
    constructor(readonly args: { store: unknown }) {}
  }
  return { UserManager, WebStorageStateStore };
});

type MockedUserManager = {
  settings: Record<string, unknown>;
  signinSilent: Mock;
  signoutRedirect: Mock;
  removeUser: Mock;
  revokeTokens: Mock;
  getUser: Mock;
  events: { addAccessTokenExpiring: Mock; load: Mock };
};

const ORIGIN = "https://app.example.com";

// oidc.ts builds its UserManager at module scope from runtimeConfig, so each
// test re-imports it against a fresh window carrying the wanted config.
const loadOidc = async (
  config: Record<string, string>,
  extraWindow: Record<string, unknown> = {}
) => {
  vi.resetModules();
  vi.stubGlobal("window", {
    location: { origin: ORIGIN },
    __EVE_CONFIG__: config,
    ...extraWindow,
  });
  const oidc = await import("./oidc");
  return {
    ...oidc,
    manager: oidc.userManager as unknown as MockedUserManager,
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("userManager settings", () => {
  it("maps the runtime config into the UserManager", async () => {
    const { manager } = await loadOidc({
      AUTH_ISSUER: "https://idp.example.com/realms/eve",
      AUTH_CLIENT_ID: "eve-frontend",
      AUTH_SCOPE: "openid email",
    });

    expect(manager.settings).toMatchObject({
      authority: "https://idp.example.com/realms/eve",
      client_id: "eve-frontend",
      redirect_uri: `${ORIGIN}/callback`,
      post_logout_redirect_uri: ORIGIN,
      scope: "openid email",
      automaticSilentRenew: false,
      requestTimeoutInSeconds: 10,
    });
  });

  it("defaults the scope to openid profile email", async () => {
    const { manager } = await loadOidc({
      AUTH_ISSUER: "https://idp.example.com/realms/eve",
      AUTH_CLIENT_ID: "eve-frontend",
    });

    expect(manager.settings.scope).toBe("openid profile email");
  });

  it("keeps the user in localStorage so a new tab and a restart find it", async () => {
    const localStorage = { getItem: vi.fn() };
    const { manager } = await loadOidc({}, { localStorage });

    const store = manager.settings.userStore as { args: { store: unknown } };
    expect(store.args.store).toBe(localStorage);
  });
});

describe("renewToken", () => {
  it("dedupes concurrent calls into one signinSilent", async () => {
    const { renewToken, manager } = await loadOidc({});
    const user = { access_token: "token" };
    let resolve!: (value: unknown) => void;
    manager.signinSilent.mockReturnValue(
      new Promise((res) => {
        resolve = res;
      })
    );

    const first = renewToken();
    const second = renewToken();
    await vi.waitFor(() => {
      expect(manager.signinSilent).toHaveBeenCalledTimes(1);
    });

    resolve(user);
    await expect(first).resolves.toBe(user);
    await expect(second).resolves.toBe(user);
  });

  it("starts a new renew once the previous one settled", async () => {
    const { renewToken, manager } = await loadOidc({});
    manager.signinSilent.mockResolvedValue({ access_token: "token" });

    await renewToken();
    await renewToken();
    expect(manager.signinSilent).toHaveBeenCalledTimes(2);
  });

  it("clears the in-flight slot on failure so the next call retries", async () => {
    const { renewToken, manager } = await loadOidc({});
    manager.signinSilent.mockRejectedValueOnce(new Error("renew failed"));
    manager.signinSilent.mockResolvedValueOnce({ access_token: "token" });

    await expect(renewToken()).rejects.toThrow("renew failed");
    await expect(renewToken()).resolves.toEqual({ access_token: "token" });
    expect(manager.signinSilent).toHaveBeenCalledTimes(2);
  });

  it("funnels the expiring event through the same single-flight path", async () => {
    const { manager } = await loadOidc({});
    expect(manager.events.addAccessTokenExpiring).toHaveBeenCalledTimes(1);
    const onExpiring = manager.events.addAccessTokenExpiring.mock
      .calls[0][0] as () => void;

    let resolve!: (value: unknown) => void;
    manager.signinSilent.mockReturnValue(
      new Promise((res) => {
        resolve = res;
      })
    );

    onExpiring();
    onExpiring();
    await vi.waitFor(() => {
      expect(manager.signinSilent).toHaveBeenCalledTimes(1);
    });
    resolve({ access_token: "token" });
  });

  it("swallows a failed background renew from the expiring event", async () => {
    const { manager } = await loadOidc({});
    const onExpiring = manager.events.addAccessTokenExpiring.mock
      .calls[0][0] as () => void;
    manager.signinSilent.mockRejectedValue(new Error("renew failed"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    onExpiring();
    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Proactive token renew failed:",
        expect.any(Error)
      );
    });
    consoleError.mockRestore();
  });
});

describe("renew across tabs", () => {
  const stubLocks = () => {
    const request = vi.fn(
      (_name: string, callback: () => Promise<unknown>) => callback()
    );
    vi.stubGlobal("navigator", { locks: { request } });
    return request;
  };

  it("renews inside the eve-oidc-renew Web Lock", async () => {
    const request = stubLocks();
    const { renewToken, manager } = await loadOidc({});
    manager.signinSilent.mockResolvedValue({ access_token: "new" });

    await expect(renewToken()).resolves.toEqual({ access_token: "new" });
    expect(request).toHaveBeenCalledWith("eve-oidc-renew", expect.any(Function));
    expect(manager.signinSilent).toHaveBeenCalledTimes(1);
  });

  it("re-reads the stored user in the lock and adopts one another tab renewed", async () => {
    stubLocks();
    const { renewToken, manager } = await loadOidc({});
    const renewedElsewhere = {
      access_token: "from-tab-b",
      expired: false,
      expires_in: 3500,
    };
    manager.getUser.mockResolvedValue(renewedElsewhere);

    await expect(renewToken()).resolves.toBe(renewedElsewhere);
    expect(manager.signinSilent).not.toHaveBeenCalled();
    expect(manager.events.load).toHaveBeenCalledWith(renewedElsewhere);
  });

  it("refreshes a stored token inside the expiring margin, with the request timeout", async () => {
    stubLocks();
    const { renewToken, manager } = await loadOidc({});
    manager.getUser.mockResolvedValue({
      access_token: "old",
      expired: false,
      expires_in: 60,
    });
    manager.signinSilent.mockResolvedValue({ access_token: "new" });

    await renewToken();
    expect(manager.signinSilent).toHaveBeenCalledWith({
      silentRequestTimeoutInSeconds: 10,
    });
  });

  it("never adopts the access token the API just refused", async () => {
    stubLocks();
    const { renewToken, manager } = await loadOidc({});
    manager.getUser.mockResolvedValue({
      access_token: "refused",
      expired: false,
      expires_in: 3500,
    });
    manager.signinSilent.mockResolvedValue({ access_token: "new" });

    await expect(renewToken("refused")).resolves.toEqual({
      access_token: "new",
    });
    expect(manager.signinSilent).toHaveBeenCalledTimes(1);
  });

  it("drops a renew that got the lock after a sign-out started", async () => {
    stubLocks();
    const { renewToken, beginSignout, manager } = await loadOidc({});
    void beginSignout();

    await expect(renewToken()).resolves.toBeNull();
    expect(manager.signinSilent).not.toHaveBeenCalled();
  });
});

describe("resumeStoredSession", () => {
  it("renews an expired stored user with its refresh token", async () => {
    const { resumeStoredSession, manager } = await loadOidc({});
    manager.getUser.mockResolvedValue({
      access_token: "old",
      refresh_token: "refresh",
      expired: true,
    });
    manager.signinSilent.mockResolvedValue({ access_token: "new" });

    await expect(resumeStoredSession()).resolves.toBe(true);
    expect(manager.signinSilent).toHaveBeenCalledTimes(1);
  });

  it("gives up without a token request when no refresh token is stored", async () => {
    const { resumeStoredSession, manager } = await loadOidc({});
    manager.getUser.mockResolvedValue({ access_token: "old", expired: true });

    await expect(resumeStoredSession()).resolves.toBe(false);
    expect(manager.signinSilent).not.toHaveBeenCalled();
  });

  it("reports false and drops the dead user when the IdP answers invalid_grant", async () => {
    const { resumeStoredSession, manager } = await loadOidc({});
    manager.getUser.mockResolvedValue({
      refresh_token: "revoked",
      expired: true,
    });
    manager.signinSilent.mockRejectedValue(
      Object.assign(new Error("invalid_grant"), { error: "invalid_grant" })
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(resumeStoredSession()).resolves.toBe(false);
    expect(manager.removeUser).toHaveBeenCalledTimes(1);
  });

  it("keeps the stored user on a transient failure such as a timeout", async () => {
    const { resumeStoredSession, manager } = await loadOidc({});
    manager.getUser.mockResolvedValue({
      refresh_token: "refresh",
      expired: true,
    });
    manager.signinSilent.mockRejectedValue(new Error("timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(resumeStoredSession()).resolves.toBe(false);
    expect(manager.removeUser).not.toHaveBeenCalled();
  });

  it("removes the old sessionStorage user once on boot", async () => {
    const sessionStorage = { removeItem: vi.fn() };
    await loadOidc(
      { AUTH_ISSUER: "https://idp.example.com/realms/eve", AUTH_CLIENT_ID: "c" },
      { sessionStorage }
    );

    expect(sessionStorage.removeItem).toHaveBeenCalledWith(
      "oidc.user:https://idp.example.com/realms/eve:c"
    );
  });
});

describe("cross-tab sign-out", () => {
  it("drops this tab's user when another tab removes the stored one", async () => {
    const listeners: Record<string, (event: unknown) => void> = {};
    const localStorage = { getItem: vi.fn() };
    const { manager, isSignedOutElsewhere, isSignoutInProgress } = await loadOidc(
      {
        AUTH_ISSUER: "https://idp.example.com/realms/eve",
        AUTH_CLIENT_ID: "eve-frontend",
      },
      {
        localStorage,
        addEventListener: (type: string, fn: (event: unknown) => void) => {
          listeners[type] = fn;
        },
      }
    );

    listeners.storage({
      storageArea: localStorage,
      key: "oidc.user:https://idp.example.com/realms/eve:eve-frontend",
      newValue: "{}",
    });
    expect(manager.removeUser).not.toHaveBeenCalled();

    listeners.storage({
      storageArea: localStorage,
      key: "oidc.user:https://idp.example.com/realms/eve:eve-frontend",
      newValue: null,
    });
    expect(manager.removeUser).toHaveBeenCalledTimes(1);
    // No redirect from this tab: PrivateRoute and axios read the latch.
    expect(isSignedOutElsewhere()).toBe(true);
    expect(isSignoutInProgress()).toBe(true);
  });

  it("reloads when a user is stored again after a sign-out elsewhere", async () => {
    const listeners: Record<string, (event: unknown) => void> = {};
    const localStorage = { getItem: vi.fn() };
    const reload = vi.fn();
    const { manager } = await loadOidc(
      { AUTH_ISSUER: "https://idp.example.com/realms/eve", AUTH_CLIENT_ID: "c" },
      {
        localStorage,
        location: { origin: ORIGIN, reload },
        addEventListener: (type: string, fn: (event: unknown) => void) => {
          listeners[type] = fn;
        },
      }
    );
    const key = "oidc.user:https://idp.example.com/realms/eve:c";
    listeners.storage({ storageArea: localStorage, key, newValue: null });
    const user = { access_token: "again", expired: false };
    manager.getUser.mockResolvedValue(user);

    listeners.storage({ storageArea: localStorage, key, newValue: "{}" });
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalledTimes(1);
    });
    // Never resumed in place under the previous user's query cache.
    expect(manager.events.load).not.toHaveBeenCalled();
  });

  it("does not reload on a renew in another tab while signed in", async () => {
    const listeners: Record<string, (event: unknown) => void> = {};
    const localStorage = { getItem: vi.fn() };
    const reload = vi.fn();
    const { manager } = await loadOidc(
      { AUTH_ISSUER: "https://idp.example.com/realms/eve", AUTH_CLIENT_ID: "c" },
      {
        localStorage,
        location: { origin: ORIGIN, reload },
        addEventListener: (type: string, fn: (event: unknown) => void) => {
          listeners[type] = fn;
        },
      }
    );
    manager.getUser.mockResolvedValue({ access_token: "a", expired: false });

    listeners.storage({
      storageArea: localStorage,
      key: "oidc.user:https://idp.example.com/realms/eve:c",
      newValue: "{}",
    });
    await Promise.resolve();
    expect(manager.getUser).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("beginSignout", () => {
  it("revokes and removes inside the renew lock, after the renew in flight", async () => {
    const order: string[] = [];
    let release!: (value: unknown) => void;
    const request = vi.fn(
      (_name: string, callback: () => Promise<unknown>) => {
        order.push("lock");
        return callback();
      }
    );
    vi.stubGlobal("navigator", { locks: { request } });
    const { beginSignout, renewToken, manager } = await loadOidc({
      AUTH_ISSUER:
        "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_AbCdEf123",
      AUTH_CLIENT_ID: "cognito-client",
    });
    manager.signinSilent.mockReturnValue(
      new Promise((res) => {
        release = res;
      })
    );
    manager.revokeTokens.mockImplementation(() => {
      order.push("revoke");
      return Promise.resolve();
    });
    manager.removeUser.mockImplementation(() => {
      order.push("remove");
      return Promise.resolve();
    });

    const renew = renewToken();
    await vi.waitFor(() => {
      expect(manager.signinSilent).toHaveBeenCalledTimes(1);
    });
    const signout = beginSignout();
    await Promise.resolve();
    expect(manager.revokeTokens).not.toHaveBeenCalled();

    release({ access_token: "new" });
    await renew;
    await signout;
    expect(order).toEqual(["lock", "lock", "revoke", "remove"]);
  });

  it("revokes the refresh token before removing the stored user", async () => {
    const { beginSignout, manager } = await loadOidc({
      AUTH_ISSUER:
        "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_AbCdEf123",
      AUTH_CLIENT_ID: "cognito-client",
    });

    await beginSignout();
    expect(manager.revokeTokens).toHaveBeenCalledWith(["refresh_token"]);
    expect(manager.removeUser).toHaveBeenCalledTimes(1);
    expect(manager.revokeTokens.mock.invocationCallOrder[0]).toBeLessThan(
      manager.removeUser.mock.invocationCallOrder[0]
    );
  });

  it("still signs out when the revocation fails", async () => {
    const { beginSignout, manager } = await loadOidc({
      AUTH_ISSUER:
        "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_AbCdEf123",
      AUTH_CLIENT_ID: "cognito-client",
    });
    // What the library throws when the revocation endpoint answers non-200.
    manager.revokeTokens.mockRejectedValue(
      Object.assign(new Error("unsupported_token_type"), { status: 400 })
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(beginSignout()).resolves.toBeDefined();
    expect(warn).toHaveBeenCalledWith(
      "Refresh token revocation failed:",
      expect.any(Error)
    );
    expect(manager.removeUser).toHaveBeenCalledTimes(1);
  });

  it("returns Cognito's non-standard logout parameters for a Cognito issuer", async () => {
    const { beginSignout } = await loadOidc({
      AUTH_ISSUER:
        "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_AbCdEf123",
      AUTH_CLIENT_ID: "cognito-client",
    });

    await expect(beginSignout()).resolves.toEqual({
      extraQueryParams: {
        client_id: "cognito-client",
        logout_uri: ORIGIN,
      },
    });
  });

  it("returns undefined for a generic issuer", async () => {
    const { beginSignout } = await loadOidc({
      AUTH_ISSUER: "https://idp.example.com/realms/eve",
      AUTH_CLIENT_ID: "eve-frontend",
    });

    await expect(beginSignout()).resolves.toBeUndefined();
  });

  it("removes the stored user for a Cognito issuer, keeping the id_token out of the URL", async () => {
    const { beginSignout, manager } = await loadOidc({
      AUTH_ISSUER:
        "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_AbCdEf123",
      AUTH_CLIENT_ID: "cognito-client",
    });

    await beginSignout();
    expect(manager.removeUser).toHaveBeenCalledTimes(1);
  });

  it("does not remove the stored user for a generic issuer", async () => {
    const { beginSignout, manager } = await loadOidc({
      AUTH_ISSUER: "https://idp.example.com/realms/eve",
      AUTH_CLIENT_ID: "eve-frontend",
    });

    await beginSignout();
    expect(manager.removeUser).not.toHaveBeenCalled();
  });

  it("marks signout as in progress synchronously, before any await settles", async () => {
    const { beginSignout, isSignoutInProgress } = await loadOidc({
      AUTH_ISSUER: "https://idp.example.com/realms/eve",
      AUTH_CLIENT_ID: "eve-frontend",
    });

    expect(isSignoutInProgress()).toBe(false);
    const pending = beginSignout();
    expect(isSignoutInProgress()).toBe(true);
    await pending;
    expect(isSignoutInProgress()).toBe(true);
  });

  it("endSignout resets the latch", async () => {
    const { beginSignout, endSignout, isSignoutInProgress } = await loadOidc({
      AUTH_ISSUER: "https://idp.example.com/realms/eve",
      AUTH_CLIENT_ID: "eve-frontend",
    });

    await beginSignout();
    expect(isSignoutInProgress()).toBe(true);
    endSignout();
    expect(isSignoutInProgress()).toBe(false);
  });

  it("treats an unparseable issuer as a generic provider", async () => {
    const { buildSignoutArgs } = await loadOidc({});
    expect(buildSignoutArgs("", "client", ORIGIN)).toBeUndefined();
    expect(buildSignoutArgs("not a url", "client", ORIGIN)).toBeUndefined();
  });

  it("is not fooled by hosts that merely contain amazonaws.com", async () => {
    const { buildSignoutArgs } = await loadOidc({});
    expect(
      buildSignoutArgs("https://evil-amazonaws.com/pool", "client", ORIGIN)
    ).toBeUndefined();
    expect(
      buildSignoutArgs(
        "https://amazonaws.com.attacker.com/pool",
        "client",
        ORIGIN
      )
    ).toBeUndefined();
    expect(
      buildSignoutArgs(
        "https://attacker.com/cognito-idp.eu-west-1.amazonaws.com",
        "client",
        ORIGIN
      )
    ).toBeUndefined();
  });
});
