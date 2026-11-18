// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateProfile = vi.fn();
// One object for every render, as a query result is: a new one each time would reset the form.
const profile = {
  email: "ada@example.com",
  first_name: "Ada",
  last_name: "Lovelace",
};

vi.mock("@/utilities/features", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utilities/features")>()),
  PROFILE_FIELDS_ENABLED: false,
}));
vi.mock("@/services/useMe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/useMe")>()),
  useGetProfile: () => ({ data: profile, isLoading: false }),
}));
vi.mock("@/services/useUpdateProfile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/useUpdateProfile")>()),
  useUpdateProfile: () => ({ mutate: updateProfile, isPending: false }),
}));

import { ProfileSection } from "./ProfileSection";

beforeEach(() => updateProfile.mockClear());
afterEach(cleanup);

const saveButton = () =>
  screen.getByTestId("settings-profile-save") as HTMLButtonElement;

describe("ProfileSection", () => {
  it("keeps Save disabled with a hint until a field changes", async () => {
    render(<ProfileSection />);
    await waitFor(() =>
      expect(
        (screen.getByTestId("profile-first-name") as HTMLInputElement).value
      ).toBe("Ada")
    );
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByTestId("settings-profile-status").textContent).toBe(
      "No changes to save."
    );

    fireEvent.change(screen.getByTestId("profile-first-name"), {
      target: { value: "Augusta" },
    });
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    expect(screen.getByTestId("settings-profile-status").textContent).toBe(
      "You have unsaved changes."
    );
  });

  it("sends both names on Save", async () => {
    render(<ProfileSection />);
    await waitFor(() =>
      expect(
        (screen.getByTestId("profile-first-name") as HTMLInputElement).value
      ).toBe("Ada")
    );
    fireEvent.change(screen.getByTestId("profile-first-name"), {
      target: { value: "Augusta" },
    });
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    fireEvent.click(saveButton());

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    expect(updateProfile).toHaveBeenCalledWith({
      first_name: "Augusta",
      last_name: "Lovelace",
    });
  });
});
