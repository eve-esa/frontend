import { renderToStaticMarkup } from "react-dom/server";
import type { UseFormRegister } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { countryNames } from "@/utilities/countries";
import { ProfileExtraFields } from "./ProfileExtraFields";

type Values = { country?: string | null; institution?: string | null };

// Only the markup is under test: the handlers react-hook-form attaches never run on the server.
const register = ((name: string) => ({
  name,
  onChange: () => Promise.resolve(),
  onBlur: () => Promise.resolve(),
  ref: () => undefined,
})) as unknown as UseFormRegister<Values>;

const render = (storedCountry?: string | null) =>
  renderToStaticMarkup(
    <ProfileExtraFields
      idPrefix="profile-required"
      register={register}
      errors={{}}
      storedCountry={storedCountry}
    />,
  );

const optionValues = (html: string) =>
  [...html.matchAll(/<option value="([^"]*)" data-testid="profile-required-country-option"/g)].map(
    // Markup escapes "&" in names such as "Bosnia & Herzegovina".
    (match) => match[1].replace(/&amp;/g, "&"),
  );

describe("ProfileExtraFields country picker", () => {
  it("is a select with an empty choice and one option per country", () => {
    const html = render();
    expect(html).toMatch(/<select id="profile-required-country"[^>]*data-testid="profile-required-country"/);
    expect(html).toContain('<option value="">Select a country</option>');
    expect(optionValues(html)).toEqual(countryNames());
  });

  it("keeps a stored country that is not in the list as the first option", () => {
    const values = optionValues(render("Italy e2e 123"));
    expect(values[0]).toBe("Italy e2e 123");
    expect(values.slice(1)).toEqual(countryNames());
  });

  it("does not repeat a stored country that is in the list", () => {
    expect(optionValues(render("Germany"))).toEqual(countryNames());
  });
});
