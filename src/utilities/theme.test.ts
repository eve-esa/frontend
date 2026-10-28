import { beforeEach, describe, expect, it } from "vitest";
import {
  applyTheme,
  parseThemeChoice,
  readThemeChoice,
  resolveTheme,
  writeThemeChoice,
  type ThemeRoot,
} from "./theme";
import { LOCAL_STORAGE_THEME } from "./localStorage";
import {
  installMemoryLocalStorage,
  type MemoryLocalStorage,
} from "@/test-utils/memoryLocalStorage";

describe("parseThemeChoice", () => {
  it("keeps the three known choices", () => {
    expect(parseThemeChoice("system")).toBe("system");
    expect(parseThemeChoice("light")).toBe("light");
    expect(parseThemeChoice("dark")).toBe("dark");
  });

  it("reads nothing or an unknown value as System", () => {
    expect(parseThemeChoice(null)).toBe("system");
    expect(parseThemeChoice(undefined)).toBe("system");
    expect(parseThemeChoice("")).toBe("system");
    expect(parseThemeChoice("Light")).toBe("system");
    expect(parseThemeChoice("sepia")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("follows the operating system on System", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
  });

  it("ignores the operating system on an explicit choice", () => {
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", true)).toBe("dark");
  });
});

describe("stored choice", () => {
  let storage: MemoryLocalStorage;

  beforeEach(() => {
    storage = installMemoryLocalStorage();
  });

  it("round-trips under the theme key", () => {
    writeThemeChoice(storage, "dark");
    expect(storage.getItem(LOCAL_STORAGE_THEME)).toBe("dark");
    expect(readThemeChoice(storage)).toBe("dark");
  });

  it("reads System when nothing is stored", () => {
    expect(readThemeChoice(storage)).toBe("system");
  });

  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(readThemeChoice(broken)).toBe("system");
    expect(() => writeThemeChoice(broken, "light")).not.toThrow();
  });

  it("reads System without storage", () => {
    expect(readThemeChoice(undefined)).toBe("system");
  });
});

describe("applyTheme", () => {
  it("sets data-theme and color-scheme on the root", () => {
    const root: ThemeRoot = { dataset: {}, style: { colorScheme: "" } };
    applyTheme(root, "light");
    expect(root.dataset.theme).toBe("light");
    expect(root.style.colorScheme).toBe("light");
    applyTheme(root, "dark");
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });
});
