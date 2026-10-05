import { beforeEach, describe, expect, it, vi } from "vitest";

const patch = vi.fn();
vi.mock("./axios", () => ({ default: { patch: (...args: unknown[]) => patch(...args) } }));

import {
  httpUpdateProfile,
  toProfileFormValues,
  toProfileUpdate,
  toRequiredProfileUpdate,
} from "./useUpdateProfile";
import {
  PROFILE_COUNTRY_MAX,
  PROFILE_INSTITUTION_MAX,
  ProfileSchema,
  RequiredProfileFieldsSchema,
  RequiredProfileSchema,
} from "./useMe";

beforeEach(() => {
  patch.mockReset();
  patch.mockResolvedValue({ data: {} });
});

describe("toProfileFormValues, what the dialog is prefilled with", () => {
  it("takes country and institution from GET /users/me", () => {
    expect(
      toProfileFormValues({
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.org",
        country: "Italy",
        institution: "ESA ESRIN",
      }),
    ).toEqual({
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.org",
      country: "Italy",
      institution: "ESA ESRIN",
    });
  });

  it("starts both inputs empty when the backend returns null or nothing", () => {
    const values = toProfileFormValues({ email: "ada@example.org", country: null });
    expect(values.country).toBe("");
    expect(values.institution).toBe("");
  });

  it.each(["", "   "])("treats a stored name of %j as no name", (name) => {
    const values = toProfileFormValues({ first_name: name, last_name: name });
    expect(values.first_name).toBeUndefined();
    expect(values.last_name).toBeUndefined();
  });

  it("lets a profile with empty names save once country and institution are set", () => {
    const stored = { first_name: "", last_name: "", country: "Italy", institution: null };
    // Before the fix the prefilled "" failed the name rule and Save stayed disabled.
    expect(RequiredProfileSchema.safeParse(stored).success).toBe(false);
    const edited = { ...toProfileFormValues(stored), institution: "ESA ESRIN" };
    expect(RequiredProfileSchema.safeParse(edited).success).toBe(true);
    expect(toProfileUpdate(edited, true)).toEqual({
      first_name: "",
      last_name: "",
      country: "Italy",
      institution: "ESA ESRIN",
    });
  });

  it("still refuses a name the user empties", () => {
    const edited = { ...toProfileFormValues({ first_name: "Ada", last_name: "Lovelace" }), first_name: "" };
    expect(ProfileSchema.safeParse(edited).success).toBe(false);
  });
});

describe("toProfileUpdate, the PATCH /users body", () => {
  it("sends only the names with FEATURE_PROFILE_FIELDS off", () => {
    expect(
      toProfileUpdate(
        { first_name: "Ada", last_name: "Lovelace", country: "Italy", institution: "ESA" },
        false,
      ),
    ).toEqual({ first_name: "Ada", last_name: "Lovelace" });
  });

  it("sends both fields with the flag on", () => {
    expect(
      toProfileUpdate(
        { first_name: "Ada", last_name: "Lovelace", country: " Italy ", institution: "ESA ESRIN" },
        true,
      ),
    ).toEqual({
      first_name: "Ada",
      last_name: "Lovelace",
      country: "Italy",
      institution: "ESA ESRIN",
    });
  });

  it("sends an empty string for a cleared field, which clears it server side", () => {
    expect(
      toProfileUpdate(
        { first_name: "Ada", last_name: "Lovelace", country: "", institution: "   " },
        true,
      ),
    ).toMatchObject({ country: "", institution: "" });
    expect(
      toProfileUpdate({ first_name: "Ada", last_name: "Lovelace", country: null }, true),
    ).toMatchObject({ country: "", institution: "" });
  });
});

describe("httpUpdateProfile", () => {
  it("patches /users with the body as given", async () => {
    const body = toProfileUpdate(
      { first_name: "Ada", last_name: "Lovelace", country: "", institution: "ESA" },
      true,
    );
    await httpUpdateProfile(body);
    expect(patch).toHaveBeenCalledWith("/users", {
      first_name: "Ada",
      last_name: "Lovelace",
      country: "",
      institution: "ESA",
    });
  });
});

describe("ProfileSchema limits", () => {
  it("accepts null and empty values and the backend maximum lengths", () => {
    expect(ProfileSchema.safeParse({ country: null, institution: null }).success).toBe(true);
    expect(ProfileSchema.safeParse({ country: "", institution: "" }).success).toBe(true);
    expect(
      ProfileSchema.safeParse({ country: "a".repeat(100), institution: "b".repeat(200) }).success,
    ).toBe(true);
  });

  it("rejects a country over 100 and an institution over 200 characters", () => {
    expect(ProfileSchema.safeParse({ country: "a".repeat(101) }).success).toBe(false);
    expect(ProfileSchema.safeParse({ institution: "b".repeat(201) }).success).toBe(false);
  });
});

describe("toRequiredProfileUpdate, the body of the required profile dialog", () => {
  it("keeps the names the profile has and sends both fields trimmed", () => {
    expect(
      toRequiredProfileUpdate(
        { first_name: "Ada", last_name: "Lovelace" },
        { country: " Italy ", institution: "ESA ESRIN" },
      ),
    ).toEqual({
      first_name: "Ada",
      last_name: "Lovelace",
      country: "Italy",
      institution: "ESA ESRIN",
    });
  });

  it("sends empty names when the profile has none, as the profile dialog does", () => {
    expect(
      toRequiredProfileUpdate({ first_name: null }, { country: "Italy", institution: "ESA" }),
    ).toMatchObject({ first_name: "", last_name: "" });
  });
});

describe("RequiredProfileFieldsSchema, the required profile dialog", () => {
  it("accepts both fields set", () => {
    expect(
      RequiredProfileFieldsSchema.safeParse({ country: "Italy", institution: "ESA" }).success,
    ).toBe(true);
  });

  it.each([
    [{ country: "", institution: "ESA" }, ["country"]],
    [{ country: "Italy", institution: "   " }, ["institution"]],
    [{ country: null }, ["country", "institution"]],
  ])("flags the missing field of %j", (value, paths) => {
    const result = RequiredProfileFieldsSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(paths);
  });

  it("keeps the length limits of the profile dialog", () => {
    const result = RequiredProfileFieldsSchema.safeParse({
      country: "x".repeat(PROFILE_COUNTRY_MAX + 1),
      institution: "x".repeat(PROFILE_INSTITUTION_MAX + 1),
    });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      `Country must be at most ${PROFILE_COUNTRY_MAX} characters`,
      `Institution must be at most ${PROFILE_INSTITUTION_MAX} characters`,
    ]);
  });

  it("is required only in RequiredProfileSchema: ProfileSchema still accepts empty fields", () => {
    const profile = { first_name: "Ada", last_name: "Lovelace", country: "", institution: "" };
    expect(ProfileSchema.safeParse(profile).success).toBe(true);
    expect(RequiredProfileSchema.safeParse(profile).success).toBe(false);
  });
});
