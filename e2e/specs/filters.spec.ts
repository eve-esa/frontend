import { flagOn } from "../pages";
import { expect, test } from "../fixtures";

test.describe("control panel filters @prod", () => {
  test("classification filters follow the flag and there is no Journal filter", async ({
    chat,
    settings,
  }) => {
    const filtersOn = flagOn(await chat.servedConfig(), "FEATURE_CLASSIFICATION_FILTERS", true);
    await settings.open();

    await expect(settings.yearRange).toBeVisible();
    expect(await settings.minCitationsValue()).toBeGreaterThanOrEqual(0);
    expect(await settings.classificationFilterCount()).toBe(filtersOn ? 3 : 0);
    expect(await settings.text()).not.toMatch(/journal/i);
  });
});
