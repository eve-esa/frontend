import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import type { MessageType } from "@/types";

/**
 * "Report a bug" sits under each assistant answer, right after Trace. The
 * sidebar provider is stubbed: the footer only reads it to toggle panels.
 */
vi.mock("@/services/axios", () => ({
  default: { post: vi.fn(), get: vi.fn(() => new Promise(() => undefined)) },
}));
vi.mock("@/services/streaming", () => ({ postStream: vi.fn() }));
vi.mock("./DynamicSidebarProvider", () => ({
  useSidebar: () => ({
    openDynamicSidebar: () => undefined,
    closeDynamicSidebar: () => undefined,
    isOpenDynamicSidebar: false,
    content: undefined,
  }),
}));

const TRACE = "0af7651916cd43dd8448eb211c80319c";
const CONVERSATION = "6ab522e6b3d679705f5b340a";
const MESSAGE = "6ab522e6b3d679705f5b3402";

const answer = (overrides: Partial<MessageType> = {}) =>
  ({
    id: MESSAGE,
    conversation_id: CONVERSATION,
    input: "What is Sentinel-2?",
    output: "An Earth observation mission.",
    trace_id: TRACE,
    trace: [{ step: "retrieve" }, { step: "generate" }],
    ...overrides,
  }) as unknown as MessageType;

const render = async (
  flag: string | undefined,
  message: MessageType = answer(),
) => {
  const config = flag === undefined ? {} : { FEATURE_REPORT_BUG: flag };
  stubRuntimeConfig(config);
  vi.stubGlobal("window", {
    __EVE_CONFIG__: config,
    innerWidth: 1440,
    location: { origin: "http://localhost:5173" },
  });
  const { MessageFooter } = await import("./MessageFooter");
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/chat/${CONVERSATION}`]}>
        <Routes>
          <Route
            path="/chat/:conversationId"
            element={<MessageFooter message={message} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/** Text nodes of a markup fragment: characters outside every tag. Icons are
 * empty svg elements, so a button's text is its accessible name. This is a
 * scanner, not a sanitizer: the markup comes from renderToStaticMarkup. */
const textOutsideTags = (markup: string) => {
  let text = "";
  let depth = 0;
  for (const ch of markup) {
    if (ch === "<") depth += 1;
    else if (ch === ">") depth -= 1;
    else if (depth === 0) text += ch;
  }
  return text;
};

/** Accessible names of the footer buttons, in document order. */
const buttonNames = (html: string) =>
  [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) =>
    textOutsideTags(m[1]).trim(),
  );

const reportButton = (html: string) =>
  [...html.matchAll(/<button[^>]*>[\s\S]*?<\/button>/g)]
    .map((m) => m[0])
    .find((b) => b.includes("Report a bug"));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("MessageFooter report a bug entry", () => {
  it.each([undefined, "false"])(
    "is absent with FEATURE_REPORT_BUG %s",
    async (flag) => {
      const html = await render(flag);
      expect(html).not.toContain("Report a bug");
      expect(buttonNames(html)).toContain("Trace(2)");
    },
  );

  it("is a button named Report a bug right after Trace with FEATURE_REPORT_BUG true", async () => {
    const html = await render("true");
    const names = buttonNames(html);
    const trace = names.indexOf("Trace(2)");
    expect(trace).toBeGreaterThanOrEqual(0);
    expect(names[trace + 1]).toBe("Report a bug");
    const button = reportButton(html);
    expect(button).toContain('aria-haspopup="dialog"');
    expect(button).not.toContain('disabled=""');
    expect(button).toMatch(/<svg[^>]*data-icon="bug"/);
    expect(button).toContain("font-[&#x27;NotesESA&#x27;]");
    // The footer shows no id: they travel in the report only.
    expect(html).not.toContain(TRACE);
    expect(html).not.toContain(MESSAGE);
  });

  it("is disabled while the answer has an optimistic id", async () => {
    const html = await render("true", answer({ id: "temp-1727180000000" }));
    expect(reportButton(html)).toContain('disabled=""');
  });

  it("sends this conversation and this answer in the multipart context", async () => {
    stubRuntimeConfig({ OBSERVABILITY_ENVIRONMENT: "local" });
    vi.stubGlobal("window", {
      __EVE_CONFIG__: { OBSERVABILITY_ENVIRONMENT: "local" },
      location: { pathname: `/chat/${CONVERSATION}` },
      innerWidth: 1440,
      innerHeight: 900,
    });
    vi.stubGlobal("navigator", { userAgent: "UA/1.0" });
    const { collectBugReportContext, buildBugReportFormData } = await import(
      "@/services/useReportBug"
    );
    const context = collectBugReportContext(new QueryClient(), {
      conversationId: CONVERSATION,
      messageId: MESSAGE,
      traceId: TRACE,
    });
    const formData = buildBugReportFormData({
      description: "The answer stopped halfway",
      context,
    });
    expect(JSON.parse(String(formData.get("context")))).toMatchObject({
      conversation_id: CONVERSATION,
      message_id: MESSAGE,
      trace_id: TRACE,
    });
  });
});

/**
 * The click itself. There is no DOM here, so the footer is rendered on the
 * server with the Button wrapped to keep its props, and the onClick of the
 * "Report a bug" button is called by hand. The dialog state setter does
 * nothing after a server render, so the "open" step is observed through
 * openBugReport, wrapped to log when it opens the dialog.
 */
describe("MessageFooter report a bug click", () => {
  const events: string[] = [];
  const startReplayOnDemand = vi.fn(() => {
    events.push("replay");
    return Promise.resolve(true);
  });

  const clickReport = async (privacyMode: string) => {
    events.length = 0;
    startReplayOnDemand.mockClear();
    const config = {
      FEATURE_REPORT_BUG: "true",
      OBSERVABILITY_ENDPOINT: "http://localhost:4318",
      OBSERVABILITY_UI_URL: "http://localhost:8081",
      OBSERVABILITY_PRIVACY_MODE: privacyMode,
    };
    stubRuntimeConfig(config);
    vi.stubGlobal("window", {
      __EVE_CONFIG__: config,
      innerWidth: 1440,
      location: { origin: "http://localhost:5173" },
    });
    const buttons: Array<ComponentProps<"button">> = [];
    vi.doMock("@/components/ui/Button", async (importOriginal) => {
      const real = await importOriginal<typeof import("@/components/ui/Button")>();
      return {
        Button: (props: ComponentProps<typeof real.Button>) => {
          buttons.push(props);
          return real.Button(props);
        },
      };
    });
    vi.doMock("@/observability/telemetry", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/observability/telemetry")>()),
      startReplayOnDemand,
    }));
    vi.doMock("@/observability/reportReplay", async (importOriginal) => {
      const real =
        await importOriginal<typeof import("@/observability/reportReplay")>();
      return {
        ...real,
        openBugReport: (open: () => void, timeoutMs?: number) =>
          real.openBugReport(() => {
            events.push("open");
            open();
          }, timeoutMs),
      };
    });
    const { MessageFooter } = await import("./MessageFooter");
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[`/chat/${CONVERSATION}`]}>
          <Routes>
            <Route
              path="/chat/:conversationId"
              element={<MessageFooter message={answer()} />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const report = buttons.find((b) =>
      renderToStaticMarkup(<>{b.children as ReactNode}</>).includes("Report a bug"),
    );
    expect(report?.onClick).toBeTypeOf("function");
    report!.onClick!({} as never);
    // Let openBugReport settle: the replay start and then the open.
    await vi.waitFor(() => expect(events).toContain("open"));
  };

  afterEach(() => {
    vi.doUnmock("@/components/ui/Button");
    vi.doUnmock("@/observability/telemetry");
    vi.doUnmock("@/observability/reportReplay");
  });

  it("starts the replay before it opens the dialog in on_demand mode", async () => {
    await clickReport("on_demand");
    expect(startReplayOnDemand).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["replay", "open"]);
  });

  it.each(["mask", "clear", "off"])(
    "opens the dialog without touching the replay in %s mode",
    async (mode) => {
      await clickReport(mode);
      expect(startReplayOnDemand).not.toHaveBeenCalled();
      expect(events).toEqual(["open"]);
    },
  );
});
