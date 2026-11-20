// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const patch = vi.fn();
vi.mock("@/services/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/utilities/features", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utilities/features")>()),
  PROFILE_FIELDS_ENABLED: true,
}));

import { ProfileSection } from "./ProfileSection";

const stored = (name: string) => ({
  email: "ada@example.com",
  first_name: name,
  last_name: name,
  country: "Italy",
  institution: "ESA ESRIN",
});

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  // The backend answers with what was sent: the stored name comes back as it was.
  patch.mockImplementation((_url: string, body: Record<string, string>) =>
    Promise.resolve({ data: { email: "ada@example.com", ...body } })
  );
});
afterEach(cleanup);

const status = () => screen.getByTestId("settings-profile-status").textContent;
const save = () => screen.getByTestId("settings-profile-save") as HTMLButtonElement;

describe.each([
  ["empty", ""],
  ["blank", "  "],
])("ProfileSection for a user whose stored names are %s", (_label, name) => {
  it("loads clean, then ends on Saved. after a country or institution change", async () => {
    get.mockResolvedValue({ data: stored(name) });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ProfileSection />
      </QueryClientProvider>
    );
    const institution = () =>
      screen.getByTestId("profile-institution") as HTMLInputElement;
    await waitFor(() => expect(institution().value).toBe("ESA ESRIN"));

    expect(status()).toBe("No changes to save.");
    expect(save().disabled).toBe(true);

    fireEvent.change(institution(), { target: { value: "ESA ESTEC" } });
    await waitFor(() => expect(save().disabled).toBe(false));
    expect(status()).toBe("You have unsaved changes.");
    fireEvent.click(save());

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    // An empty name is never wiped: the stored one goes back as it was.
    expect(patch.mock.calls[0][1]).toMatchObject({
      first_name: name,
      last_name: name,
      institution: "ESA ESTEC",
    });
    await waitFor(() => expect(status()).toBe("Saved."));
    expect(save().disabled).toBe(true);
  });
});
