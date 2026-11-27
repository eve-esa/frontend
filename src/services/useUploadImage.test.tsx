// @vitest-environment jsdom
import { act, renderHook, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";

const post = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("./axios", () => ({ default: { post } }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("./errorLogging", () => ({ logError }));

const quotaError = {
  message: "Request failed with status code 403",
  response: {
    status: 403,
    data: {
      detail: {
        code: "storage_quota_exceeded",
        message:
          "Storage is full. Delete files or conversations to free space.",
      },
    },
  },
};

const Probe = () => {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
};

const withFlags = (config: Record<string, string>) => {
  blankBuildTimeEnv();
  (window as unknown as { __EVE_CONFIG__: Record<string, string> }).__EVE_CONFIG__ =
    config;
};

const mount = async (flag: "true" | "false") => {
  withFlags({
    FEATURE_STORAGE_QUOTA: flag,
    FEATURE_SETTINGS_PAGE: "true",
    FEATURE_SETTINGS_USAGE: "true",
  });
  const { useUploadImage } = await import("./useUploadImage");
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return renderHook(() => useUploadImage(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/chat"]}>
          <Probe />
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    ),
  });
};

afterEach(() => {
  post.mockReset();
  toastError.mockReset();
  logError.mockReset();
  delete (window as unknown as { __EVE_CONFIG__?: unknown }).__EVE_CONFIG__;
  vi.unstubAllEnvs();
});

describe("useUploadImage storage quota", () => {
  it("toasts the backend message, skips logging, and links to Settings", async () => {
    post.mockRejectedValue(quotaError);
    const { result } = await mount("true");
    await act(async () => {
      await result.current
        .mutateAsync({ file: new File(["x"], "a.png", { type: "image/png" }) })
        .catch(() => undefined);
    });
    expect(logError).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "Storage is full. Delete files or conversations to free space.",
      expect.objectContaining({
        id: "storage-quota-exceeded",
        action: expect.objectContaining({ label: "Manage storage" }),
      }),
    );
    const action = toastError.mock.calls[0][1].action as { onClick: () => void };
    act(() => action.onClick());
    await vi.waitFor(() =>
      expect(screen.getByTestId("path").textContent).toBe("/settings/usage"),
    );
  });

  it("still toasts the message without the action when the flag is off", async () => {
    post.mockRejectedValue(quotaError);
    const { result } = await mount("false");
    await act(async () => {
      await result.current
        .mutateAsync({ file: new File(["x"], "a.png", { type: "image/png" }) })
        .catch(() => undefined);
    });
    expect(logError).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "Storage is full. Delete files or conversations to free space.",
      { id: "storage-quota-exceeded" },
    );
  });

  it("logs a failure that is not the quota", async () => {
    post.mockRejectedValue({ message: "Network Error" });
    const { result } = await mount("true");
    await act(async () => {
      await result.current
        .mutateAsync({ file: new File(["x"], "a.png", { type: "image/png" }) })
        .catch(() => undefined);
    });
    expect(toastError).toHaveBeenCalledWith("Something went wrong!");
    expect(logError).toHaveBeenCalledTimes(1);
  });
});