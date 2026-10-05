import { flagOn } from "../pages";
import { expect, test } from "../fixtures";

type Me = {
  first_name?: string | null;
  last_name?: string | null;
  country?: string | null;
  institution?: string | null;
};

test.describe("profile required @dev", () => {
  test("country and institution are asked before the chat and saved", async ({
    chat,
    profileRequired,
    api,
  }) => {
    test.skip(
      !flagOn(await chat.servedConfig(), "FEATURE_PROFILE_FIELDS", false),
      "FEATURE_PROFILE_FIELDS is off in the served config",
    );

    // The sign-in fixture has already filled the dialog if the account needed it.
    const before = await api.get<Me>("/users/me");
    expect(before.status).toBe(200);
    const names = {
      first_name: before.body.first_name ?? "",
      last_name: before.body.last_name ?? "",
    };

    // The backend clears a field sent as an empty string: the dialog must have something to ask.
    const cleared = await api.patch<Me>("/users", { ...names, country: "", institution: "" });
    expect(cleared.status).toBe(200);
    expect(cleared.body.country ?? null).toBeNull();
    expect(cleared.body.institution ?? null).toBeNull();

    try {
      await chat.goto();
      await expect(profileRequired.root).toBeVisible();

      // No way out other than saving or signing out.
      await chat.page.keyboard.press("Escape");
      await chat.page.mouse.click(5, 5);
      await expect(profileRequired.root).toBeVisible();
      await expect(profileRequired.saveButton).toBeDisabled();

      const stamp = `e2e ${Date.now()}`;
      await profileRequired.fill({ country: "Italy", institution: `Pi School ${stamp}` });
      await profileRequired.save();

      const me = await api.get<Me>("/users/me");
      expect(me.status).toBe(200);
      expect(me.body.country).toBe("Italy");
      expect(me.body.institution).toBe(`Pi School ${stamp}`);
      expect(me.body.first_name ?? "").toBe(names.first_name);
      expect(me.body.last_name ?? "").toBe(names.last_name);

      await chat.goto();
      await expect(profileRequired.root).toBeHidden();
    } finally {
      // Leave the account as it was found.
      await api.patch("/users", {
        ...names,
        country: before.body.country ?? "",
        institution: before.body.institution ?? "",
      });
    }
  });
});
