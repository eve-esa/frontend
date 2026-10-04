import { expect, hasKey, test } from "../fixtures";

test.describe("sign in @prod", () => {
  test("hosted login lands on the chat and /users/me hides the password hash", async ({
    chat,
    api,
  }) => {
    const email = process.env.E2E_EMAIL ?? "";
    expect((await chat.signedInEmail()).toLowerCase()).toBe(email.toLowerCase());

    const me = await api.get<Record<string, unknown>>("/users/me");
    expect(me.status).toBe(200);
    expect(String(me.body.email ?? "").toLowerCase()).toBe(email.toLowerCase());
    expect(hasKey(me.body, "password_hash")).toBe(false);
  });
});
