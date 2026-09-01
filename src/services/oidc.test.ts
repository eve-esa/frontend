import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

// The real UserManager touches sessionStorage at construction, which the
// plain Node test environment does not have; the mock also lets each test
// inspect the settings the module builds and script signinSilent.
vi.mock("oidc-client-ts", () => {
  class UserManager {
    settings: Record<string, unknown>;
    signinSilent = vi.fn();
    signoutRedirect = vi.fn(() => Promise.resolve());

    constructor(settings: Record<string, unknown>) {
      this.settings = settings;
    }
  }
  return { UserManager };
});

type MockedUserManager = {
  settings: Record<string, unknown>;
  signinSilent: Mock;
  signoutRedirect: Mock;
};

const ORIGIN = "https://app.example.com";

// oidc.ts builds its UserManager at module scope from runtimeConfig, so each
// test re-imports it against a fresh window carrying the wanted config.
const loadOidc = async (config: Record<string, string>) => {
  vi.resetModules();
  vi.stubGlobal("window", {
    location: { origin: ORIGIN },
    __EVE_CONFIG__: config,
  });
  const oidc = await import("./oidc");
  return {
    ...oidc,
    manager: oidc.userManager as unknown as MockedUserManager,
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
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
      automaticSilentRenew: true,
    });
  });

  it("defaults the scope to openid profile email", async () => {
    const { manager } = await loadOidc({
      AUTH_ISSUER: "https://idp.example.com/realms/eve",
      AUTH_CLIENT_ID: "eve-frontend",
    });

    expect(manager.settings.scope).toBe("openid profile email");
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
    expect(manager.signinSilent).toHaveBeenCalledTimes(1);

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
});

describe("signoutRedirect", () => {
  it("sends Cognito its non-standard logout parameters", async () => {
    const { signoutRedirect, manager } = await loadOidc({
      AUTH_ISSUER:
        "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_AbCdEf123",
      AUTH_CLIENT_ID: "cognito-client",
    });

    await signoutRedirect();
    expect(manager.signoutRedirect).toHaveBeenCalledWith({
      extraQueryParams: {
        client_id: "cognito-client",
        logout_uri: ORIGIN,
      },
    });
  });

  it("uses the plain RP-initiated logout for any other issuer", async () => {
    const { signoutRedirect, manager } = await loadOidc({
      AUTH_ISSUER: "https://idp.example.com/realms/eve",
      AUTH_CLIENT_ID: "eve-frontend",
    });

    await signoutRedirect();
    expect(manager.signoutRedirect).toHaveBeenCalledWith(undefined);
  });

  it("treats an unparseable issuer as a generic provider", async () => {
    const { buildSignoutArgs } = await loadOidc({});
    expect(buildSignoutArgs("", "client", ORIGIN)).toBeUndefined();
    expect(buildSignoutArgs("not a url", "client", ORIGIN)).toBeUndefined();
  });
});
