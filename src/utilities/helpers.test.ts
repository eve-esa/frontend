import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import { adaptSettingsForRequest } from "./helpers";
import type { AdvancedSettingsValidation } from "./advancedSettingsSchema";

const base: AdvancedSettingsValidation = {
  score_threshold: 0.42,
  temperature: 0.11,
  k: 7,
  n_citations: 0,
  year: undefined,
  journal: undefined,
  thematic_perspective: undefined,
  scientific_and_technical: undefined,
  market_perspective: undefined,
};

const mustFilters = (result: ReturnType<typeof adaptSettingsForRequest>) =>
  result.filters?.must ?? [];

describe("adaptSettingsForRequest", () => {
  it("sends no filters key when nothing is set", () => {
    const result = adaptSettingsForRequest(base);
    expect(result.filters).toBeUndefined();
    expect("filters" in result && result.filters === undefined).toBe(true);
  });

  it("does not push an n_citations filter for 0 or undefined", () => {
    expect(
      mustFilters(adaptSettingsForRequest({ ...base, n_citations: 0 })),
    ).toEqual([]);
    expect(
      mustFilters(adaptSettingsForRequest({ ...base, n_citations: undefined })),
    ).toEqual([]);
  });

  it("pushes an n_citations range filter with gte when positive", () => {
    const must = mustFilters(
      adaptSettingsForRequest({ ...base, n_citations: 2 }),
    );
    expect(must).toHaveLength(1);
    expect(must[0]).toMatchObject({ key: "n_citations", range: { gte: 2 } });
  });

  it("pushes a year range filter when a start year is set", () => {
    const must = mustFilters(
      adaptSettingsForRequest({ ...base, year: { startYear: 2020 } }),
    );
    expect(must).toHaveLength(1);
    expect(must[0]).toMatchObject({
      key: "year",
      range: { gte: 2020, lte: null },
    });
  });

  it("pushes a journal match filter", () => {
    const must = mustFilters(
      adaptSettingsForRequest({ ...base, journal: "Nature" }),
    );
    expect(must).toHaveLength(1);
    expect(must[0]).toMatchObject({
      key: "journal",
      match: { value: "Nature" },
    });
  });

  it("passes k, score_threshold and temperature through untouched", () => {
    const result = adaptSettingsForRequest({ ...base, n_citations: 3 });
    expect(result.k).toBe(7);
    expect(result.score_threshold).toBe(0.42);
    expect(result.temperature).toBe(0.11);
    expect(result.year).toBeUndefined();
    expect(result.journal).toBeUndefined();
    expect(result.n_citations).toBeUndefined();
  });
});

describe("adaptSettingsForRequest and the classification filters flag", () => {
  const SET: AdvancedSettingsValidation = {
    ...base,
    journal: "Nature",
    thematic_perspective: { label: "Climate", value: "climate" },
    scientific_and_technical: { label: "Sensors", value: "sensors" },
    market_perspective: { label: "Agriculture", value: "agriculture" },
  };

  const mustKeys = async (classificationFilters: "true" | "false") => {
    stubRuntimeConfig({
      FEATURE_CLASSIFICATION_FILTERS: classificationFilters,
    });
    const module = await import("./helpers");
    return mustFilters(module.adaptSettingsForRequest(SET)).map(
      (entry) => entry.key,
    );
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("pushes the three perspective filters when the flag is on", async () => {
    expect(await mustKeys("true")).toEqual([
      "journal",
      "thematic_perspective",
      "scientific_and_technical",
      "market_perspective",
    ]);
  });

  it("pushes none of them when the flag is off, and keeps the others", async () => {
    expect(await mustKeys("false")).toEqual(["journal"]);
  });
});
