// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiKey } from "@/types";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();

vi.mock("@/services/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const makeKey = (over: Partial<ApiKey>): ApiKey => ({
  id: "key-1",
  name: "Local script",
  token_suffix: "a1b2c3",
  status: "active",
  created_at: "2026-09-18T12:00:00Z",
  expires_at: "2026-12-17T12:00:00Z",
  revoked_at: null,
  last_used_at: null,
  created_via: "oidc",
  created_by_key_id: null,
  created_by: null,
  is_current: false,
  ...over,
});

let keys: ApiKey[] = [];

beforeEach(() => {
  keys = [
    makeKey({ id: "key-1", name: "Local script" }),
    makeKey({ id: "key-2", name: "CI job", token_suffix: "d4e5f6" }),
  ];
  get.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/users/api-keys"
        ? { data: keys, headers: { "x-api-key-limit": "10" } }
        : { data: { data: [] }, headers: {} },
    ),
  );
  post.mockResolvedValue({
    data: { ...makeKey({ id: "key-3", name: "New" }), token: "eve_secret_value_123" },
  });
  del.mockResolvedValue({ data: undefined });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderSection = async () => {
  const { ApiKeysSection } = await import("./ApiKeysSection");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ApiKeysSection />
    </QueryClientProvider>,
  );
};

describe("ApiKeysSection", () => {
  it("renders a row per key and the active count", async () => {
    await renderSection();
    expect(await screen.findByTestId("settings-apikeys-row-key-1")).toBeTruthy();
    expect(screen.getByTestId("settings-apikeys-row-key-2")).toBeTruthy();
    expect(screen.getByTestId("api-keys-count").textContent).toBe("2 of 10 active keys");
    expect(screen.getByTestId("api-keys-usage-snippet")).toBeTruthy();
  });

  it("shows the created key once and drops it when done", async () => {
    await renderSection();
    fireEvent.click(await screen.findByTestId("settings-apikeys-create"));
    fireEvent.click(await screen.findByTestId("api-key-create-submit"));

    const secret = (await screen.findByTestId("api-key-secret")) as HTMLInputElement;
    expect(secret.value).toBe("eve_secret_value_123");
    expect(screen.getByTestId("api-key-secret-copy")).toBeTruthy();

    fireEvent.click(screen.getByTestId("api-key-secret-done"));
    await waitFor(() => expect(screen.queryByTestId("api-key-secret")).toBeNull());
    expect(document.body.textContent).not.toContain("eve_secret_value_123");
  });

  it("asks for confirmation by name before deleting", async () => {
    await renderSection();
    const row = await screen.findByTestId("settings-apikeys-row-key-2");
    fireEvent.click(row.querySelector('[data-testid="api-key-delete"]') as HTMLElement);

    const target = await screen.findByTestId("api-key-delete-target");
    expect(target.textContent).toContain("CI job");
    expect(del).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("api-key-delete-cancel"));
    await waitFor(() => expect(screen.queryByTestId("api-key-delete-confirm")).toBeNull());
    expect(del).not.toHaveBeenCalled();

    fireEvent.click(row.querySelector('[data-testid="api-key-delete"]') as HTMLElement);
    fireEvent.click(await screen.findByTestId("api-key-delete-confirm-submit"));
    await waitFor(() => expect(del).toHaveBeenCalledWith("/users/api-keys/key-2"));
  });
});
