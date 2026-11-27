// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";

vi.mock("@/services/axios", () => ({ default: { get: vi.fn() } }));

const GIB = 1024 * 1024 * 1024;

const usage = (usedRatio: number) => ({
  unlimited: false,
  rate_limit_group: "free",
  used_bytes: usedRatio * 20 * GIB,
  max_bytes: 20 * GIB,
  remaining_bytes: (1 - usedRatio) * 20 * GIB,
  used_ratio: usedRatio,
  used_gb: usedRatio * 20,
  max_gb: 20,
});

const load = async () => {
  blankBuildTimeEnv();
  (window as unknown as { __EVE_CONFIG__: Record<string, string> }).__EVE_CONFIG__ =
    {
      FEATURE_STORAGE_QUOTA: "true",
      FEATURE_SETTINGS_PAGE: "true",
      FEATURE_SETTINGS_USAGE: "true",
    };
  const view = await import("./ComposerStorageNotice");
  const store = await import("@/services/storageNotice");
  store.clearStorageNotice();
  return { ...view, ...store };
};

const mount = (ui: ReactNode, client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  delete (window as unknown as { __EVE_CONFIG__?: unknown }).__EVE_CONFIG__;
  vi.unstubAllEnvs();
});

describe("ComposerStorageNotice", () => {
  it("renders the full-storage line, links to Settings, and dismisses", async () => {
    const { ComposerStorageNotice, setStorageNotice, getStorageNotice } =
      await load();
    setStorageNotice("c1", { usedBytes: 10, maxBytes: 10 });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["storageUsage"], usage(1));
    mount(<ComposerStorageNotice conversationId="c1" />, client);

    expect(screen.getByTestId("composer-storage-notice").textContent).toMatch(
      /Storage is full\. New files from this chat were not saved\./,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(
      screen.getByTestId("composer-storage-manage").getAttribute("href"),
    ).toBe("/settings/usage");

    fireEvent.click(screen.getByTestId("composer-storage-dismiss"));
    expect(getStorageNotice("c1")).toBeNull();
    expect(screen.queryByTestId("composer-storage-notice")).toBeNull();
  });

  it("keeps the banner while storage stays full, then clears once a refetch shows room", async () => {
    const { ComposerStorageNotice, setStorageNotice, getStorageNotice } =
      await load();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["storageUsage"], usage(1));
    setStorageNotice("c1", {
      usedBytes: 20 * GIB,
      maxBytes: 20 * GIB,
      setAt: Date.now() + 60_000,
    });
    mount(<ComposerStorageNotice conversationId="c1" />, client);
    expect(getStorageNotice("c1")).not.toBeNull();

    act(() => {
      setStorageNotice("c1", { setAt: 1, usedBytes: 20 * GIB, maxBytes: 20 * GIB });
    });
    expect(getStorageNotice("c1")).not.toBeNull();

    act(() => {
      client.setQueryData(["storageUsage"], usage(0.4));
    });
    await vi.waitFor(() => expect(getStorageNotice("c1")).toBeNull());
  });
});