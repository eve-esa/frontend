import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import type { MessageType } from "@/types";

/**
 * The report a bug entry of a conversation lives in its header, above the
 * messages. The sidebar provider is stubbed: only the hamburger (mobile) reads
 * it, and the header renders here at desktop width.
 */
vi.mock("@/services/axios", () => ({ default: { post: vi.fn() } }));
vi.mock("./DynamicSidebarProvider", () => ({
  useSidebar: () => ({ toggleConversationsSidebar: () => undefined }),
}));

const TRACE = "0af7651916cd43dd8448eb211c80319c";
const CONVERSATION = "6ab522e6b3d679705f5b340a";

const message = (id: string, overrides: Partial<MessageType> = {}) =>
  ({
    id,
    conversation_id: CONVERSATION,
    input: "What is Sentinel-2?",
    output: "An Earth observation mission.",
    ...overrides,
  }) as MessageType;

const messages = [
  message("6ab522e6b3d679705f5b3401", { trace_id: "1".repeat(32) }),
  message("6ab522e6b3d679705f5b3402", { trace_id: TRACE }),
];

const render = async (
  flag: string | undefined,
  conversationId: string | null = CONVERSATION,
) => {
  const config = flag === undefined ? {} : { FEATURE_REPORT_BUG: flag };
  stubRuntimeConfig(config);
  vi.stubGlobal("window", { __EVE_CONFIG__: config, innerWidth: 1440 });
  const { ConversationHeader } = await import("./ConversationHeader");
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ConversationHeader
        conversationId={conversationId ?? undefined}
        messages={messages}
      />
    </QueryClientProvider>,
  );
};

const reportButton = (html: string) =>
  html.match(/<button[^>]*data-testid="conversation-report-bug"[^>]*>/)?.[0];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ConversationHeader report a bug entry", () => {
  it.each([undefined, "false"])(
    "is absent with FEATURE_REPORT_BUG %s",
    async (flag) => {
      const html = await render(flag);
      expect(html).not.toContain("Report a bug");
      expect(reportButton(html)).toBeUndefined();
    },
  );

  it("is an icon button named Report a bug with FEATURE_REPORT_BUG true", async () => {
    const html = await render("true");
    const button = reportButton(html);
    expect(button).toBeDefined();
    expect(button).toContain('aria-label="Report a bug"');
    expect(button).toContain('aria-haspopup="dialog"');
    expect(button).not.toContain('disabled=""');
    expect(html).toMatch(/<svg[^>]*data-icon="bug"/);
    // The header shows no id: they travel in the report only.
    expect(html).not.toContain(TRACE);
    expect(html).not.toContain(CONVERSATION);
  });

  it("is disabled outside a conversation", async () => {
    const button = reportButton(await render("true", null));
    expect(button).toContain('disabled=""');
  });
});

describe("lastAnswerTarget", () => {
  it("points at the conversation and its last persisted answer", async () => {
    const { lastAnswerTarget } = await import("./ConversationHeader");
    expect(
      lastAnswerTarget(CONVERSATION, [
        ...messages,
        message("temp-1727180000000", { output: "" }),
      ]),
    ).toEqual({
      conversationId: CONVERSATION,
      messageId: "6ab522e6b3d679705f5b3402",
      traceId: TRACE,
    });
    expect(lastAnswerTarget(undefined, [])).toEqual({
      conversationId: undefined,
      messageId: undefined,
      traceId: undefined,
    });
  });

  it("sends the full context, with this conversation and its last answer, in the multipart body", async () => {
    stubRuntimeConfig({ OBSERVABILITY_ENVIRONMENT: "local" });
    vi.stubGlobal("window", {
      __EVE_CONFIG__: { OBSERVABILITY_ENVIRONMENT: "local" },
      location: { pathname: `/chat/${CONVERSATION}` },
      innerWidth: 1440,
      innerHeight: 900,
    });
    vi.stubGlobal("navigator", { userAgent: "UA/1.0" });
    const { lastAnswerTarget } = await import("./ConversationHeader");
    const { collectBugReportContext, buildBugReportFormData } = await import(
      "@/services/useReportBug"
    );
    const queryClient = new QueryClient();
    const context = collectBugReportContext(
      queryClient,
      lastAnswerTarget(CONVERSATION, messages),
    );
    const formData = buildBugReportFormData({
      description: "The answer stopped halfway",
      context,
    });
    expect(formData.get("description")).toBe("The answer stopped halfway");
    const sent = JSON.parse(String(formData.get("context")));
    expect(sent).toEqual(context);
    expect(sent).toMatchObject({
      conversation_id: CONVERSATION,
      message_id: "6ab522e6b3d679705f5b3402",
      trace_id: TRACE,
      environment: "local",
      path: `/chat/${CONVERSATION}`,
      user_agent: "UA/1.0",
      viewport: { width: 1440, height: 900 },
    });
    expect(Object.keys(sent).sort()).toEqual(
      [
        "app_commit",
        "app_version",
        "console_errors",
        "conversation_id",
        "environment",
        "message_id",
        "path",
        "privacy_mode",
        "replay_url",
        "session_id",
        "trace_id",
        "user_agent",
        "viewport",
      ].sort(),
    );
    expect(formData.get("screenshot")).toBeNull();
  });
});
