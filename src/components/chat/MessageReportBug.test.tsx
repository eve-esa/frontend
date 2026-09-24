import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import type { MessageType } from "@/types";

/**
 * The report a bug entry of an assistant message, rendered through Message
 * itself, since Message decides when a turn can be reported. The footer and
 * the markdown renderer are stubbed: they are not under test and pull in the
 * sidebar and model providers.
 */
vi.mock("@/services/axios", () => ({ default: { post: vi.fn() } }));
vi.mock("./MessageFooter", () => ({ MessageFooter: () => <div>footer</div> }));
vi.mock("@/components/ui/SmartText", () => ({
  default: ({ text }: { text: string }) => <div>{text}</div>,
}));

const TRACE = "0af7651916cd43dd8448eb211c80319c";

const answered = (overrides: Partial<MessageType> = {}): MessageType =>
  ({
    id: "6ab522e6b3d679705f5b340b",
    conversation_id: "6ab522e6b3d679705f5b340a",
    input: "What is Sentinel-2?",
    output: "An Earth observation mission.",
    trace_id: TRACE,
    ...overrides,
  }) as MessageType;

const render = async (
  flag: string | undefined,
  message: MessageType = answered(),
  props: { isSending?: boolean; hideReportBug?: boolean } = {},
) => {
  const config = flag === undefined ? {} : { FEATURE_REPORT_BUG: flag };
  stubRuntimeConfig(config);
  // AuthenticatedImage reads the page origin at module scope.
  vi.stubGlobal("window", {
    __EVE_CONFIG__: config,
    location: { origin: "http://localhost:5173", pathname: "/chat/c" },
  });
  const { Message } = await import("./Message");
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <Message
        message={message}
        isSending={props.isSending ?? false}
        isLastMessage={true}
        hideReportBug={props.hideReportBug}
      />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Message report a bug entry", () => {
  it("is absent when FEATURE_REPORT_BUG is unset", async () => {
    const html = await render(undefined);
    expect(html).toContain("footer");
    expect(html).not.toContain("Report a bug");
  });

  it("is absent when FEATURE_REPORT_BUG is false", async () => {
    expect(await render("false")).not.toContain("Report a bug");
  });

  it("is under a settled answer when FEATURE_REPORT_BUG is true", async () => {
    const html = await render("true");
    expect(html).toContain('data-testid="message-report-bug"');
    expect(html).toContain("Report a bug");
    // The entry itself shows no id: they travel in the report only.
    expect(html).not.toContain(TRACE);
    expect(html.indexOf("footer")).toBeLessThan(html.indexOf("Report a bug"));
  });

  it("is under a failed turn too", async () => {
    const html = await render(
      "true",
      answered({
        output: "",
        metadata: { error: { code: "timeout" } },
      } as Partial<MessageType>),
    );
    expect(html).toContain("did not answer in time");
    expect(html).toContain('data-testid="message-report-bug"');
  });

  it("waits for the real id and for the stream to end", async () => {
    expect(
      await render("true", answered({ id: "srv-1727180000000" })),
    ).not.toContain("Report a bug");
    expect(
      await render("true", answered({ id: "temp-1727180000000" })),
    ).not.toContain("Report a bug");
    expect(await render("true", answered(), { isSending: true })).not.toContain(
      "Report a bug",
    );
  });

  it("leaves the failed last turn to the error box under the list", async () => {
    expect(
      await render("true", answered(), { hideReportBug: true }),
    ).not.toContain("Report a bug");
  });
});
