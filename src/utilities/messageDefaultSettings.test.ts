import { beforeEach, describe, expect, it } from "vitest";
import { installMemoryLocalStorage } from "@/test-utils/memoryLocalStorage";
import { LOCAL_STORAGE_SETTINGS } from "./localStorage";
import {
  DEFAULT_SCORE_THRESHOLD,
  MAX_K,
  messageDefaultSettings,
  readStoredSettings,
} from "./messageDefaultSettings";

describe("messageDefaultSettings", () => {
  it("is the source of truth for k and score_threshold", () => {
    expect(messageDefaultSettings.k).toBe(MAX_K);
    expect(messageDefaultSettings.score_threshold).toBe(DEFAULT_SCORE_THRESHOLD);
    expect(MAX_K).toBe(10);
    expect(DEFAULT_SCORE_THRESHOLD).toBe(0.6);
  });
});

describe("readStoredSettings", () => {
  let storage: ReturnType<typeof installMemoryLocalStorage>;

  beforeEach(() => {
    storage = installMemoryLocalStorage();
  });

  it("returns defaults when nothing is stored", () => {
    expect(readStoredSettings()).toEqual({
      ...messageDefaultSettings,
      year: undefined,
    });
  });

  it("fills missing keys with defaults and keeps stored values", () => {
    storage.setItem(
      LOCAL_STORAGE_SETTINGS,
      JSON.stringify({ k: 4, journal: "Nature" }),
    );
    const settings = readStoredSettings();
    expect(settings.k).toBe(4);
    expect(settings.journal).toBe("Nature");
    expect(settings.score_threshold).toBe(messageDefaultSettings.score_threshold);
    expect(settings.temperature).toBe(messageDefaultSettings.temperature);
    expect(settings.n_citations).toBe(messageDefaultSettings.n_citations);
  });

  it("clamps k into 0..10 as an integer", () => {
    storage.setItem(LOCAL_STORAGE_SETTINGS, JSON.stringify({ k: 99 }));
    expect(readStoredSettings().k).toBe(10);
    storage.setItem(LOCAL_STORAGE_SETTINGS, JSON.stringify({ k: -1 }));
    expect(readStoredSettings().k).toBe(0);
    storage.setItem(LOCAL_STORAGE_SETTINGS, JSON.stringify({ k: 3.6 }));
    expect(readStoredSettings().k).toBe(4);
  });

  it("clamps score_threshold and temperature into 0..1", () => {
    storage.setItem(
      LOCAL_STORAGE_SETTINGS,
      JSON.stringify({ score_threshold: 1.7, temperature: -0.5 }),
    );
    const settings = readStoredSettings();
    expect(settings.score_threshold).toBe(1);
    expect(settings.temperature).toBe(0);
  });

  it("falls back to defaults on invalid JSON", () => {
    storage.setItem(LOCAL_STORAGE_SETTINGS, "{not json");
    expect(readStoredSettings()).toEqual({
      ...messageDefaultSettings,
      year: undefined,
    });
  });

  it("normalises year to undefined when both bounds are empty", () => {
    storage.setItem(
      LOCAL_STORAGE_SETTINGS,
      JSON.stringify({ year: { startYear: null, endYear: undefined } }),
    );
    expect(readStoredSettings().year).toBeUndefined();
    storage.setItem(
      LOCAL_STORAGE_SETTINGS,
      JSON.stringify({ year: { startYear: 2019 } }),
    );
    expect(readStoredSettings().year).toEqual({
      startYear: 2019,
      endYear: undefined,
    });
  });
});
