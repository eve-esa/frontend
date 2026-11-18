import { describe, expect, it } from "vitest";
import {
  resolveSection,
  settingsPath,
  visibleSections,
  type SettingsFlags,
} from "./sections";

const allOn: SettingsFlags = {
  themeSwitch: true,
  customModels: true,
  usage: true,
  apiKeys: true,
};
const allOff: SettingsFlags = {
  themeSwitch: false,
  customModels: false,
  usage: false,
  apiKeys: false,
};

const ids = (flags: SettingsFlags) => visibleSections(flags).map((s) => s.id);

describe("visibleSections", () => {
  it("lists the six sections in order with every feature on", () => {
    expect(ids(allOn)).toEqual([
      "profile",
      "appearance",
      "models",
      "usage",
      "api-keys",
      "account",
    ]);
  });

  it("keeps only Profile and Account with every feature off", () => {
    expect(ids(allOff)).toEqual(["profile", "account"]);
  });

  it.each([
    ["themeSwitch", "appearance"],
    ["customModels", "models"],
    ["usage", "usage"],
    ["apiKeys", "api-keys"],
  ] as const)("hides a section when only %s is off", (flag, hidden) => {
    const listed = ids({ ...allOn, [flag]: false });
    expect(listed).not.toContain(hidden);
    expect(listed).toHaveLength(5);
  });
});

describe("resolveSection", () => {
  it("returns the section the URL names", () => {
    expect(resolveSection("usage", allOn)).toBe("usage");
    expect(resolveSection("api-keys", allOn)).toBe("api-keys");
    expect(resolveSection("account", allOff)).toBe("account");
  });

  it.each([undefined, "", "nope", "Profile", "apikeys"])(
    "falls back to Profile for %s",
    (param) => {
      expect(resolveSection(param, allOn)).toBe("profile");
    }
  );

  it("falls back to Profile for a section its feature hides", () => {
    expect(resolveSection("appearance", { ...allOn, themeSwitch: false })).toBe(
      "profile"
    );
    expect(resolveSection("models", { ...allOn, customModels: false })).toBe(
      "profile"
    );
    expect(resolveSection("usage", allOff)).toBe("profile");
    expect(resolveSection("api-keys", allOff)).toBe("profile");
  });
});

describe("settingsPath", () => {
  it("builds the route of a section", () => {
    expect(settingsPath("profile")).toBe("/settings/profile");
    expect(settingsPath("api-keys")).toBe("/settings/api-keys");
  });
});
