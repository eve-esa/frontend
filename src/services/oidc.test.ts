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

  it("re-reads the stored user in the lock and takes another tab's renew", async () => {
    stubLocks();
    const { renewToken, manager } = await loadOidc({});
    const renewedElsewhere = { access_token: "from-tab-b", expired: false };
    manager.getUser
      .mockResolvedValueOnce({ access_token: "old", expired: true })
      .mockResolvedValueOnce(renewedElsewhere);

    await expect(renewToken()).resolves.toBe(renewedElsewhere);
    expect(manager.signinSilent).not.toHaveBeenCalled();
    expect(manager.events.load).toHaveBeenCalledWith(renewedElsewhere);
  });

  it("refreshes when the stored user is still the one it started from", async () => {
    stubLocks();
    const { renewToken, manager } = await loadOidc({});
    const expiring = { access_token: "old", expired: false };
    manager.getUser.mockResolvedValue(expiring);
    manager.signinSilent.mockResolvedValue({ access_token: "new" });

    await renewToken();
    expect(manager.signinSilent).toHaveBeenCalledTimes(1);
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

  it("reports false when the IdP refuses the refresh token", async () => {
    const { resumeStoredSession, manager } = await loadOidc({});
    manager.getUser.mockResolvedValue({
      refresh_token: "revoked",
      expired: true,
    });
    manager.signinSilent.mockRejectedValue(new Error("invalid_grant"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(resumeStoredSession()).resolves.toBe(false);
  });
});

describe("cross-tab sign-out", () => {
  it("drops this tab's user when another tab removes the stored one", async () => {
    const listeners: Record<string, (event: unknown) => void> = {};
    const localStorage = { getItem: vi.fn() };
    const { manager } = await loadOidc(
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
  });
});

describe("beginSignout", () => {
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
    manager.revokeTokens.mockRejectedValue(new Error("network"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(beginSignout()).resolves.toBeDefined();
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
