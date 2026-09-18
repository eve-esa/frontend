import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import { adaptSettingsForRequest, handleApiError } from "./helpers";
import type { AdvancedSettingsValidation } from "./advancedSettingsSchema";
import type { ApiError } from "@/types";

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

const apiError = (status: number | undefined, detail: unknown): ApiError =>
  ({
    response: status === undefined ? undefined : { status, data: { detail } },
  }) as ApiError;

describe("handleApiError", () => {
  it("returns a string detail as is", () => {
    expect(handleApiError(apiError(400, "Name is too long"))).toBe(
      "Name is too long",
    );
  });

  it("returns the first message of an array detail", () => {
    expect(
      handleApiError(apiError(422, [{ msg: "field required" }])),
    ).toBe("field required");
  });

  it("returns an object detail's message on a 409, e.g. the active-key cap", () => {
    expect(
      handleApiError(
        apiError(409, {
          code: "api_key_limit_reached",
          message: "You have reached the limit of 10 active keys.",
          limit: 10,
        }),
      ),
    ).toBe("You have reached the limit of 10 active keys.");
  });

  it("prefers an object detail's message over the generic 429 text", () => {
    expect(
      handleApiError(
        apiError(429, {
          code: "api_key_create_rate_limited",
          message: "Too many keys created recently. Try again later.",
        }),
      ),
    ).toBe("Too many keys created recently. Try again later.");
  });

  it("falls back to the free-credits text on a plain 429", () => {
    expect(handleApiError(apiError(429, "ignored"))).toBe(
      "You've run out of free credits. Please recharge and try again.",
    );
  });

  it("falls back to the generic message for an object detail without a message", () => {
    expect(
      handleApiError(apiError(500, { code: "internal_error" })),
    ).toBe("Something went wrong!");
  });

  it("falls back to the generic message when there is no response at all", () => {
    expect(handleApiError(apiError(undefined, undefined))).toBe(
      "Something went wrong!",
    );
  });
});
