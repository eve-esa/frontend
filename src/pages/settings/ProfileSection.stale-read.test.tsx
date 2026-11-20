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
  PROFILE_FIELDS_ENABLED: false,
}));

import { ProfileSection } from "./ProfileSection";

const OLD = { email: "ada@example.com", first_name: "Ada", last_name: "Lovelace" };
const NEW = { ...OLD, first_name: "Augusta" };

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  // A secondary replica that has not seen the write: GET /users/me keeps answering the old row.
  get.mockResolvedValue({ data: { ...OLD } });
  patch.mockResolvedValue({ data: { ...NEW } });
});
afterEach(cleanup);

describe("ProfileSection after a save whose refetch reads a stale copy", () => {
  it("ends clean with Saved. and the new values", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <ProfileSection />
      </QueryClientProvider>
    );
    const first = () =>
      screen.getByTestId("profile-first-name") as HTMLInputElement;
    await waitFor(() => expect(first().value).toBe("Ada"));

    fireEvent.change(first(), { target: { value: "Augusta" } });
    const save = screen.getByTestId("settings-profile-save") as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId("settings-profile-status").textContent).toBe(
        "Saved."
      )
    );
    expect(first().value).toBe("Augusta");
    expect(save.disabled).toBe(true);
  });
});
