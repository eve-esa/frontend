import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMemoryLocalStorage } from "@/test-utils/memoryLocalStorage";
import { LOCAL_STORAGE_MCP_SERVERS, LOCAL_STORAGE_SKILLS } from "./localStorage";
import { getSelectedSkillNames, toggleSkillSelection } from "./skills";

const seed = (value: unknown) =>
  localStorage.setItem(LOCAL_STORAGE_SKILLS, JSON.stringify(value));

beforeEach(() => {
  installMemoryLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getSelectedSkillNames", () => {
  it("stays empty when the key is missing", () => {
    expect(getSelectedSkillNames()).toEqual([]);
  });

  it("keeps a stored [] empty", () => {
    seed([]);

    expect(getSelectedSkillNames()).toEqual([]);
  });

  it("returns the stored names", () => {
    seed(["roll-dice"]);

    expect(getSelectedSkillNames()).toEqual(["roll-dice"]);
  });

  it("returns [] for a non-array and for invalid JSON", () => {
    seed({ "roll-dice": true });
    expect(getSelectedSkillNames()).toEqual([]);

    localStorage.setItem(LOCAL_STORAGE_SKILLS, "{not json");
    expect(getSelectedSkillNames()).toEqual([]);
  });

  it("drops entries that are not strings", () => {
    seed(["roll-dice", 1, null]);

    expect(getSelectedSkillNames()).toEqual(["roll-dice"]);
  });
});

describe("toggleSkillSelection", () => {
  it("stores roll-dice when it is switched on from empty", () => {
    toggleSkillSelection(getSelectedSkillNames(), "roll-dice");

    expect(getSelectedSkillNames()).toEqual(["roll-dice"]);
  });

  it("stores [] when roll-dice is switched off", () => {
    seed(["roll-dice"]);

    toggleSkillSelection(getSelectedSkillNames(), "roll-dice");

    expect(getSelectedSkillNames()).toEqual([]);
    expect(localStorage.getItem(LOCAL_STORAGE_SKILLS)).toBe(
      JSON.stringify([]),
    );
  });

  it("does not write the MCP server key", () => {
    localStorage.setItem(
      LOCAL_STORAGE_MCP_SERVERS,
      JSON.stringify(["weather"]),
    );

    toggleSkillSelection([], "roll-dice");

    expect(localStorage.getItem(LOCAL_STORAGE_MCP_SERVERS)).toBe(
      JSON.stringify(["weather"]),
    );
    expect(localStorage.getItem(LOCAL_STORAGE_SKILLS)).toBe(
      JSON.stringify(["roll-dice"]),
    );
  });
});
