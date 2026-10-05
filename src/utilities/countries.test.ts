import { describe, expect, it } from "vitest";
import { COUNTRY_CODES, countryNames, countryOptions } from "./countries";

describe("countryNames", () => {
  it("is sorted by name and has no duplicates", () => {
    const list = countryNames();
    expect(list).toEqual([...list].sort((a, b) => a.localeCompare(b, "en")));
    expect(new Set(list).size).toBe(list.length);
  });

  it("names every code in English", () => {
    const list = countryNames();
    expect(list).toContain("Italy");
    expect(list).toContain("Germany");
    expect(list.length).toBe(COUNTRY_CODES.length);
    expect(list.some((name) => /^[A-Z]{2}$/.test(name))).toBe(false);
  });
});

describe("countryOptions", () => {
  it("is the plain list for a country in it or no country", () => {
    expect(countryOptions("Italy")).toEqual(countryNames());
    expect(countryOptions(null)).toEqual(countryNames());
    expect(countryOptions("  ")).toEqual(countryNames());
  });

  it("keeps a free-text country saved before the picker, first", () => {
    const options = countryOptions("Italy e2e 123");
    expect(options[0]).toBe("Italy e2e 123");
    expect(options.slice(1)).toEqual(countryNames());
  });
});
