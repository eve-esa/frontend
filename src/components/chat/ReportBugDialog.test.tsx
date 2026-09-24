import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BugReportContext } from "@/services/useReportBug";

/**
 * Rendered with renderToStaticMarkup, like the other component tests here:
 * vitest runs in "node" with no DOM. The Radix dialog content lives in a
 * portal, which does not render on the server, so the form inside it is
 * rendered on its own with the same form hook the dialog uses.
 */
const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/services/axios", () => ({ default: { post: mocks.post } }));

import {
  ReportBugDialog,
  ReportBugForm,
  useReportBugForm,
} from "./ReportBugDialog";

const TRACE = "0af7651916cd43dd8448eb211c80319c";

const stubContext: BugReportContext = {
  session_id: "sess-42",
  replay_url: "http://localhost:8081/sessions?sid=sess-42",
  trace_id: TRACE,
  conversation_id: "conv-7",
  message_id: "msg-9",
  app_version: "v0.1.2",
  app_commit: "abc1234def5678",
  environment: "local",
  user_agent: "UA/1.0",
  viewport: { width: 1280, height: 800 },
  path: "/chat/conv-7",
  console_errors: ["2026-09-24T10:00:00.000Z error: boom"],
  privacy_mode: "clear",
};

type HarnessProps = {
  context?: BugReportContext;
  screenshot?: Blob | null;
  screenshotError?: string | null;
  canCapture?: boolean;
};

const Harness = ({
  context = stubContext,
  screenshot = null,
  screenshotError = null,
  canCapture = true,
}: HarnessProps) => {
  const form = useReportBugForm();
  return (
    <ReportBugForm
      form={form}
      context={context}
      screenshot={screenshot}
      screenshotError={screenshotError}
      isCapturing={false}
      isSubmitting={false}
      canCapture={canCapture}
      onCaptureScreenshot={() => undefined}
      onRemoveScreenshot={() => undefined}
      onSubmit={() => undefined}
      onCancel={() => undefined}
    />
  );
};

const render = (props: HarnessProps = {}) =>
  renderToStaticMarkup(<Harness {...props} />);

const field = (html: string, name: string) =>
  html.match(new RegExp(`data-field="${name}"[^>]*>([^<]*)<`))?.[1];

beforeEach(() => {
  mocks.post.mockReset();
});

describe("ReportBugForm", () => {
  it("shows the context it will send", () => {
    const html = render();
    expect(field(html, "session")).toBe("sess-42");
    expect(field(html, "replay")).toBe("Available, linked to this report");
    expect(field(html, "trace")).toBe(TRACE);
    expect(field(html, "conversation")).toBe("conv-7");
    expect(field(html, "message")).toBe("msg-9");
    expect(field(html, "version")).toBe("v0.1.2 abc1234");
    expect(field(html, "environment")).toBe("local");
    expect(field(html, "page")).toBe("/chat/conv-7");
    expect(field(html, "browser")).toContain("1 recent console errors");
  });

  it("says what is missing instead of leaving blanks", () => {
    const html = render({
      context: {
        ...stubContext,
        session_id: null,
        replay_url: null,
        trace_id: null,
        message_id: null,
        privacy_mode: "off",
      },
    });
    expect(field(html, "session")).toBe("Not available");
    expect(field(html, "replay")).toBe("Not recorded (telemetry is off)");
    expect(field(html, "trace")).toBe("Not available");
  });

  it("caps the description at 4000 characters and starts with Send disabled", () => {
    const html = render();
    expect(html).toContain('maxLength="4000"');
    expect(html).toContain("0/4000");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*type="submit"|<button[^>]*type="submit"[^>]*disabled=""/);
  });

  it("offers a screenshot but does not need one", () => {
    const html = render();
    expect(html).toContain("Add screenshot");
    expect(html).not.toContain("Screenshot attached");
  });

  it("shows an attached screenshot and a size error", () => {
    const html = render({
      screenshot: new Blob([new Uint8Array(2048)], { type: "image/jpeg" }),
      screenshotError: "The screenshot is larger than 1 MB and cannot be attached.",
    });
    expect(html).toContain("Screenshot attached (2 KB)");
    expect(html).toContain("Retake screenshot");
    expect(html).toContain("larger than 1 MB");
  });

  it("explains when the browser cannot take a screenshot", () => {
    const html = render({ canCapture: false });
    expect(html).not.toContain("Add screenshot");
    expect(html).toContain("Screenshots are not available in this browser.");
  });

  it("sends nothing while it is only shown", () => {
    render();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});

describe("ReportBugDialog", () => {
  it("renders nothing and sends nothing while closed", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <ReportBugDialog
          isOpen={false}
          onOpenChange={() => undefined}
          context={stubContext}
        />
      </QueryClientProvider>,
    );
    expect(html).toBe("");
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
