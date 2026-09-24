import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBugReportFormData,
  type BugReportContext,
} from "@/services/useReportBug";

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
  submitError?: string | null;
};

const Harness = ({
  context = stubContext,
  screenshot = null,
  screenshotError = null,
  canCapture = true,
  submitError = null,
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
      submitError={submitError}
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

beforeEach(() => {
  mocks.post.mockReset();
});

/** Every context value a user must never read in the dialog. */
const hiddenValues = [
  stubContext.session_id,
  stubContext.replay_url,
  stubContext.trace_id,
  stubContext.conversation_id,
  stubContext.message_id,
  stubContext.app_commit,
  stubContext.path,
  stubContext.user_agent,
  stubContext.console_errors[0],
] as string[];

describe("ReportBugForm", () => {
  it("renders none of the context it will send", () => {
    const html = render();
    for (const value of hiddenValues) {
      expect(html).not.toContain(value);
    }
    for (const label of ["Session", "Trace", "Conversation", "Message", "Replay"]) {
      expect(html).not.toContain(`>${label}<`);
    }
    expect(html).not.toContain("Attached to the report");
    expect(html).not.toContain("data-field=");
  });

  it("says in one sentence that technical details are attached", () => {
    const html = render();
    expect(html).toContain(
      "Technical details about this conversation are attached automatically to help us investigate.",
    );
    const outside = render({ context: { ...stubContext, conversation_id: null } });
    expect(outside).toContain(
      "Technical details about this page are attached automatically to help us investigate.",
    );
  });

  it("still sends the whole context in the form data", () => {
    const formData = buildBugReportFormData({
      description: "The answer stopped halfway",
      context: stubContext,
    });
    const sent = String(formData.get("context"));
    expect(JSON.parse(sent)).toEqual(stubContext);
    for (const value of hiddenValues) {
      expect(sent).toContain(JSON.stringify(value).slice(1, -1));
    }
  });

  it("shows why the last send failed, inline", () => {
    const html = render({
      submitError: "You have sent 5 bug reports in the last hour. Please try again later.",
    });
    expect(html).toMatch(/role="alert"[^>]*>You have sent 5 bug reports/);
  });

  it("caps the description at 4000 characters and starts with Send disabled", () => {
    const html = render();
    expect(html).toContain('maxLength="4000"');
    expect(html).toContain("0/4000");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*type="submit"|<button[^>]*type="submit"[^>]*disabled=""/);
  });

  it("keeps the description out of session replay", () => {
    const html = render();
    const textarea = html.match(/<textarea[^>]*>/)?.[0] ?? "";
    expect(textarea).toContain('id="report-bug-description"');
    // Any value matches the replay blockSelector "[data-private]".
    expect(textarea).toMatch(/ data-private(="[^"]*")?[ >]/);
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
