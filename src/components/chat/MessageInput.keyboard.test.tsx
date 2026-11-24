// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";
import type { ConfigKey } from "@/utilities/runtimeConfig";

/**
 * Keyboard access to the composer buttons that act on mousedown: Enter or Space on a focused
 * button fires a click with detail 0 and no mousedown, so the click handler must do the action.
 */
const phone = false;
const openDynamicSidebar = vi.fn();

// The composer pulls in most of the chat services: the first import is slow.
vi.setConfig({ testTimeout: 60_000 });

vi.mock("@/services/axios", () => ({ default: {}, handleResponseError: vi.fn() }));
vi.mock("@/services/streaming", () => ({ abortCurrentStream: vi.fn() }));
vi.mock("@/services/stopConversation", () => ({ stopConversation: vi.fn() }));
vi.mock("./CustomModelsDialog", () => ({ CustomModelsDialog: () => null }));
vi.mock("@/hooks/useIsPhone", () => ({ useIsPhone: () => phone }));
vi.mock("@/components/onboarding/TourContext", () => ({
  useTour: () => ({ isRunning: false, currentStep: 0, totalSteps: 0 }),
}));
vi.mock("./DynamicSidebarProvider", () => ({
  useSidebar: () => ({ openDynamicSidebar }),
}));
vi.mock("@/services/useUploadImage", () => ({
  useUploadImage: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/services/useListModels", () => ({
  useListModels: () => ({ data: undefined }),
}));
vi.mock("@/services/useTokenUsage", () => ({
  useTokenUsage: () => ({ data: undefined }),
}));
vi.mock("@/components/ui/Dialog", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Pass,
    DialogTrigger: Pass,
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogFooter: Pass,
    DialogClose: Pass,
    DialogTitle: Pass,
    DialogDescription: Pass,
  };
});


afterEach(() => {
  cleanup();
  delete (window as unknown as { __EVE_CONFIG__?: unknown }).__EVE_CONFIG__;
  openDynamicSidebar.mockClear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

const mount = async () => {
  // The real jsdom window stays (Radix needs its timers): only the injected config is set on it.
  blankBuildTimeEnv();
  const config: Partial<Record<ConfigKey, string>> = { FEATURE_ATTACHMENTS: "true" };
  (window as unknown as { __EVE_CONFIG__: unknown }).__EVE_CONFIG__ = config;
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  const { MessageInput } = await import("./MessageInput");
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <MessageInput variant="secondary" isLoading={false} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("MessageInput keyboard activation", () => {
  it("opens the Control Panel on a click with detail 0, not on a pointer click", async () => {
    await mount();
    const button = screen.getByTestId("composer-settings");
    fireEvent.click(button, { detail: 1 });
    expect(openDynamicSidebar).not.toHaveBeenCalled();
    fireEvent.click(button, { detail: 0 });
    expect(openDynamicSidebar).toHaveBeenCalledExactlyOnceWith({ type: "settings" });
  });

  it("still opens the Control Panel on mousedown", async () => {
    await mount();
    fireEvent.mouseDown(screen.getByTestId("composer-settings"));
    expect(openDynamicSidebar).toHaveBeenCalledExactlyOnceWith({ type: "settings" });
  });

  it("opens the file picker on a click with detail 0, not on a pointer click", async () => {
    const { container } = await mount();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const pick = vi.spyOn(input, "click").mockImplementation(vi.fn());
    const button = screen.getByTestId("attach-image-button");
    fireEvent.click(button, { detail: 1 });
    expect(pick).not.toHaveBeenCalled();
    fireEvent.click(button, { detail: 0 });
    expect(pick).toHaveBeenCalledTimes(1);
  });
});
