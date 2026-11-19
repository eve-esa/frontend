import { describe, expect, it, vi } from "vitest";
import {
  RELOAD_GUARD_MS,
  installPreloadErrorHandler,
  isChunkLoadError,
  reloadOnce,
} from "./staleChunk";

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};

describe("reloadOnce", () => {
  it("reloads the first time", () => {
    const reload = vi.fn();
    expect(reloadOnce(reload, memoryStorage(), 1_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload a second time inside the guard window", () => {
    const reload = vi.fn();
    const storage = memoryStorage();
    reloadOnce(reload, storage, 1_000);
    expect(reloadOnce(reload, storage, 1_000 + RELOAD_GUARD_MS - 1)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads again once the window has passed", () => {
    const reload = vi.fn();
    const storage = memoryStorage();
    reloadOnce(reload, storage, 1_000);
    expect(reloadOnce(reload, storage, 1_000 + RELOAD_GUARD_MS)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("still reloads when storage throws", () => {
    const reload = vi.fn();
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(reloadOnce(reload, broken, 1_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("installPreloadErrorHandler", () => {
  it("reloads on vite:preloadError once, then lets the error through", () => {
    const target = new EventTarget();
    const reload = vi.fn();
    installPreloadErrorHandler(target, reload, memoryStorage());

    const first = new Event("vite:preloadError", { cancelable: true });
    target.dispatchEvent(first);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(first.defaultPrevented).toBe(true);

    const second = new Event("vite:preloadError", { cancelable: true });
    target.dispatchEvent(second);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(false);
  });
});

describe("isChunkLoadError", () => {
  it.each([
    "Failed to fetch dynamically imported module: https://x/assets/a.js",
    "error loading dynamically imported module: https://x/assets/a.js",
    "Importing a module script failed.",
    "Unable to preload CSS for /assets/a.css",
  ])("recognises %s", (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isChunkLoadError(new Error("boom"))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});
