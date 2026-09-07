import { afterEach, describe, expect, it, vi } from "vitest";

// axios.ts reads window.location and import.meta.env at module scope, so
// each test re-imports it against a fresh window, mirroring the pattern in
// oidc.test.ts.
vi.mock("./oidc", () => ({
  CALLBACK_PATH: "/callback",
  isSignoutInProgress: vi.fn(),
  renewToken: vi.fn(),
  userManager: {
    getUser: vi.fn(() => Promise.resolve(null)),
    signinRedirect: vi.fn(),
  },
}));

const ORIGIN = "https://app.example.com";

const loadAxios = async (pathname: string) => {
  vi.resetModules();
  vi.stubGlobal("window", {
    location: { origin: ORIGIN, pathname, search: "" },
  });
  const axiosModule = await import("./axios");
  const oidc = await import("./oidc");
  return {
    handleResponseError: axiosModule.handleResponseError,
    isSignoutInProgress: oidc.isSignoutInProgress as ReturnType<typeof vi.fn>,
    renewToken: oidc.renewToken as ReturnType<typeof vi.fn>,
    userManager: oidc.userManager as unknown as {
      signinRedirect: ReturnType<typeof vi.fn>;
    },
  };
};

const make401 = () => ({
  response: { status: 401 },
  config: {
    url: "/api/foo",
    baseURL: undefined,
    headers: {},
    _retry: false,
  },
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("handleResponseError", () => {
  it("does not start a sign-in redirect while a sign-out is in progress", async () => {
    const { handleResponseError, isSignoutInProgress, renewToken, userManager } =
      await loadAxios("/some-page");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renewToken.mockRejectedValue(new Error("renew failed"));
    isSignoutInProgress.mockReturnValue(true);

    await expect(handleResponseError(make401())).rejects.toThrow();
    expect(userManager.signinRedirect).not.toHaveBeenCalled();
  });

  it("starts a sign-in redirect when renew fails and no sign-out is in progress", async () => {
    const { handleResponseError, isSignoutInProgress, renewToken, userManager } =
      await loadAxios("/some-page");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renewToken.mockRejectedValue(new Error("renew failed"));
    isSignoutInProgress.mockReturnValue(false);

    await expect(handleResponseError(make401())).rejects.toThrow();
    expect(userManager.signinRedirect).toHaveBeenCalledTimes(1);
  });

  it("never starts a sign-in redirect from the callback route, sign-out latch or not", async () => {
    const { handleResponseError, isSignoutInProgress, renewToken, userManager } =
      await loadAxios("/callback");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renewToken.mockRejectedValue(new Error("renew failed"));
    isSignoutInProgress.mockReturnValue(false);

    await expect(handleResponseError(make401())).rejects.toThrow();
    expect(userManager.signinRedirect).not.toHaveBeenCalled();
  });
});
