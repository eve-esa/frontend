import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import type { ConfigKey } from "@/utilities/runtimeConfig";

/**
 * The composer with FEATURE_MOBILE_COMPOSER on and off, below and above md, on the empty chat and
 * after the first answer. renderToStaticMarkup runs no effects, so this reads the markup of the
 * first render: which controls exist, their classes, and what the notice says.
 */
let phone = false;

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
  useSidebar: () => ({ openDynamicSidebar: vi.fn() }),
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

const SUGGESTIONS = ["First suggestion", "Second suggestion"];

type Props = { showDisclaimer?: boolean; suggestions?: string[] };

const render = async (
  config: Partial<Record<ConfigKey, string>>,
  props: Props = {},
) => {
  stubRuntimeConfig(config);
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  const { MessageInput } = await import("./MessageInput");
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <MessageInput variant="secondary" isLoading={false} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const openTag = (html: string, testId: string) =>
  html.match(new RegExp(`<[a-z]+ [^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? "";

const FLAG_ON = { FEATURE_MOBILE_COMPOSER: "true", FEATURE_MODEL_PICKER: "true" };
const FLAG_OFF = { FEATURE_MODEL_PICKER: "true", FEATURE_ATTACHMENTS: "true" };

afterEach(() => {
  phone = false;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("MessageInput, FEATURE_MOBILE_COMPOSER", () => {
  it("flag off: 32 px buttons, the full statement, the picker and suggestions in the composer", async () => {
    for (const isPhone of [false, true]) {
      phone = isPhone;
      const html = await render(FLAG_OFF, { suggestions: SUGGESTIONS });
      for (const id of ["composer-settings", "composer-send", "attach-image-button"]) {
        expect(openTag(html, id)).toContain("h-8 w-8 p-0");
        expect(openTag(html, id)).not.toContain("h-[44px]");
      }
      expect(html).not.toContain("Control Panel</span>");
      expect(html).toContain("EVE outputs represent an automated synthesis");
      expect(html).not.toContain("Learn more");
      expect(html).toContain('data-slot="select-trigger"');
      expect(html).not.toContain("max-md:");
    }
  });

  it("flag on, desktop: 44 px buttons, a labelled Control Panel, the picker stays", async () => {
    const html = await render(
      { ...FLAG_ON, FEATURE_ATTACHMENTS: "true" },
      { suggestions: SUGGESTIONS },
    );
    expect(openTag(html, "composer-settings")).toContain("h-[44px]");
    expect(openTag(html, "attach-image-button")).toContain("w-[44px]");
    expect(openTag(html, "composer-send")).toContain("h-[44px] w-[44px]");
    expect(html).toContain("<span>Control Panel</span>");
    // Attach comes first, then Control Panel.
    expect(html.indexOf("attach-image-button")).toBeLessThan(html.indexOf("composer-settings"));
    expect(html.includes('data-slot="select-trigger"')).toBe(true);
    expect(html.includes("md:h-[110px]")).toBe(true);
  });

  it("flag on, phone: the model Select and the logo leave the composer", async () => {
    phone = true;
    const html = await render(FLAG_ON, { suggestions: SUGGESTIONS });
    expect(html.includes('data-slot="select-trigger"')).toBe(false);
    expect(html.includes("md:h-[110px]")).toBe(false);
    expect(openTag(html, "composer-settings")).toContain("h-[44px]");
  });

  it("flag on: Send is muted while the input is empty", async () => {
    const html = await render(FLAG_ON);
    const send = openTag(html, "composer-send");
    expect(send).toContain("disabled");
    expect(send).toContain("disabled:opacity-35");
  });

  it("flag on: no notice on the empty chat, the short line and Learn more after the first answer", async () => {
    for (const isPhone of [false, true]) {
      phone = isPhone;
      const empty = await render(FLAG_ON, { showDisclaimer: false });
      expect(empty).not.toContain("composer-disclaimer");
      expect(empty).not.toContain("EVE outputs represent");
      expect(empty).not.toContain("Learn more");

      const answered = await render(FLAG_ON, { showDisclaimer: true });
      expect(answered).toContain("EVE is AI and can make mistakes.");
      expect(answered).toContain("Learn more");
      expect(answered).not.toContain("EVE outputs represent an automated synthesis and do not constitute statements by, or endorsements from, the original data providers or authors. EVE could make errors. Always check the content.</p>");
    }
  });
});
