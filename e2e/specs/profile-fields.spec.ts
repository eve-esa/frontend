import { flagOn } from "../pages";
import { expect, test } from "../fixtures";

test.describe("profile fields @dev", () => {
  test("country and institution round trip through the API", async ({ chat, profile, api }) => {
    test.skip(
      !flagOn(await chat.servedConfig(), "FEATURE_PROFILE_FIELDS", false),
      "FEATURE_PROFILE_FIELDS is off in the served config",
    );
    const stamp = `e2e ${Date.now()}`;

    await profile.open();
    const before = await profile.read();
    await profile.fill({ country: "Italy", institution: `Pi School ${stamp}` });
    await profile.save();

    const me = await api.get<Record<string, unknown>>("/users/me");
    expect(me.status).toBe(200);
    expect(me.body.country).toBe("Italy");
    expect(me.body.institution).toBe(`Pi School ${stamp}`);

    await profile.open();
    expect((await profile.read()).country).toBe("Italy");
    // Leave the account as it was found.
    await profile.fill({ country: before.country ?? "", institution: before.institution ?? "" });
    if (await profile.saveButton.isEnabled()) await profile.save();
    else await profile.close();
  });
});
