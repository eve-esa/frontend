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

/** Accessible names of the footer buttons, in document order. */
const buttonNames = (html: string) =>
  [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) =>
    m[1]
      .replace(/<svg[\s\S]*?<\/svg>/g, "")
      .replace(/<[^>]+>/g, "")
      .trim(),
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
