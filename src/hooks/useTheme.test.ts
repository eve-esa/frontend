import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";

// useSyncExternalStore is exercised through the module's subscribe function,
// which React calls on mount and unmount; here a tiny stand-in does the same.
const mountHook = async () => {
  let subscribe: ((listener: () => void) => () => void) | undefined;
  vi.doMock("react", () => ({
    useSyncExternalStore: (sub: (l: () => void) => () => void) => {
      subscribe = sub;
      return { choice: "dark", resolved: "dark" };
    },
  }));
  const { useTheme } = await import("./useTheme");
  const hook = useTheme();
  return { hook, subscribe: subscribe! };
};

afterEach(() => {
  vi.doUnmock("react");
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("useTheme", () => {
  it("does nothing with the flag off", async () => {
    stubRuntimeConfig({});
    const { hook } = await mountHook();
    expect(hook.enabled).toBe(false);
    expect(hook.resolved).toBe("dark");
    hook.setChoice("light");
    expect(hook.resolved).toBe("dark");
  });

  it("listens to the OS only while mounted, once per object", async () => {
    const mql = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    stubRuntimeConfig({ FEATURE_THEME_SWITCH: "true" });
    vi.stubGlobal("window", {
      __EVE_CONFIG__: { FEATURE_THEME_SWITCH: "true" },
      matchMedia: () => mql,
      localStorage: { getItem: () => null, setItem: () => undefined },
    });
    vi.stubGlobal("document", {
      documentElement: { dataset: {}, style: {} },
    });
    const { subscribe } = await mountHook();

    const first = subscribe(() => undefined);
    const second = subscribe(() => undefined);
    expect(mql.addEventListener).toHaveBeenCalledTimes(1);

    first();
    expect(mql.removeEventListener).not.toHaveBeenCalled();
    second();
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1);
    expect(mql.removeEventListener.mock.calls[0][1]).toBe(
      mql.addEventListener.mock.calls[0][1]
    );

    subscribe(() => undefined)();
    expect(mql.addEventListener).toHaveBeenCalledTimes(2);
    expect(mql.removeEventListener).toHaveBeenCalledTimes(2);
  });
});
