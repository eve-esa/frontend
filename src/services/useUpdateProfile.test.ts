import { beforeEach, describe, expect, it, vi } from "vitest";

const patch = vi.fn();
vi.mock("./axios", () => ({ default: { patch: (...args: unknown[]) => patch(...args) } }));

import {
  httpUpdateProfile,
  toProfileFormValues,
  toProfileUpdate,
} from "./useUpdateProfile";
import { ProfileSchema } from "./useMe";

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
