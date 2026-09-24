import type { ReactNode } from "react";
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
// The Radix dialog renders into a portal, which the server renderer skips.
// Inline stand-ins keep the real dialog tree (title, helper, form) visible.
vi.mock("@/components/ui/Dialog", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? <div role="dialog">{children}</div> : null,
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children?: ReactNode }) => (
      <p>{children}</p>
    ),
  };
});

import {
  ReportBugDialog,
  ReportBugForm,
  useReportBugForm,
} from "./ReportBugDialog";

const TRACE = "0af7651916cd43dd8448eb211c80319c";
const CONVERSATION = "6ab522e6b3d679705f5b340a";
const MESSAGE = "6ab522e6b3d679705f5b340b";

const stubContext: BugReportContext = {
  session_id: "b3c1f2e4a5d6b7c8d9e0f1a2b3c4d5e6",
  replay_url:
    "http://localhost:8081/sessions?sid=b3c1f2e4a5d6b7c8d9e0f1a2b3c4d5e6",
  trace_id: TRACE,
  conversation_id: CONVERSATION,
  message_id: MESSAGE,
  app_version: "v0.1.2",
  app_commit: "abc1234def5678",
  environment: "local",
  user_agent: "UA/1.0",
  viewport: { width: 1280, height: 800 },
  path: `/chat/${CONVERSATION}`,
  console_errors: ["2026-09-24T10:00:00.000Z error: boom"],
  privacy_mode: "clear",
};

type HarnessProps = {
  context?: BugReportContext;
  screenshot?: Blob | null;
  screenshotUrl?: string | null;
  screenshotError?: string | null;
  canCapture?: boolean;
  submitError?: string | null;
};

const Harness = ({
  context = stubContext,
  screenshot = null,
  screenshotUrl = null,
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
      screenshotUrl={screenshotUrl}
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

  it("says in one plain sentence that technical details are attached", () => {
    const html = render();
    expect(html).toContain(
      "We attach the technical details of this conversation to help us fix it.",
    );
    const outside = render({ context: { ...stubContext, conversation_id: null } });
    expect(outside).toContain(
      "We attach the technical details of this page to help us fix it.",
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
    // No counter while the limit is far away.
    expect(html).not.toContain("/4000");
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

  it("shows a captured screenshot as a thumbnail the user can remove", () => {
    const html = render({
      screenshot: new Blob([new Uint8Array(2048)], { type: "image/jpeg" }),
      screenshotUrl: "blob:http://localhost:5173/shot",
    });
    expect(html).toContain('data-testid="report-bug-screenshot"');
    expect(html).toMatch(/<img[^>]*src="blob:http:\/\/localhost:5173\/shot"/);
    expect(html).toContain('alt="Your screenshot"');
    expect(html).toContain('aria-label="Remove screenshot"');
    expect(html).toContain("Retake");
    expect(html).not.toContain("Add screenshot");
  });

  it("shows why a screenshot could not be attached", () => {
    const html = render({
      screenshotError: "The screenshot is larger than 1 MB and cannot be attached.",
    });
    expect(html).toMatch(/role="alert"[^>]*>The screenshot is larger than 1 MB/);
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

/** The text a user reads, tags and attributes stripped. */
const visibleText = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const renderDialog = (context: BugReportContext = stubContext) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ReportBugDialog
        isOpen={true}
        onOpenChange={() => undefined}
        context={context}
      />
    </QueryClientProvider>,
  );

describe("ReportBugDialog", () => {
  it("shows only the title, one helper, the field, the screenshot, the note and the buttons", () => {
    const text = visibleText(renderDialog());
    expect(text).toBe(
      [
        "Report a bug",
        "Tell us what happened, in your own words.",
        "What went wrong?",
        // The screenshot button needs getDisplayMedia, absent in node.
        "Screenshots are not available in this browser.",
        "We attach the technical details of this conversation to help us fix it.",
        "Cancel",
        "Send",
      ].join(" "),
    );
  });

  it("renders no id and no technical word, even though the context has them", () => {
    const html = renderDialog();
    const text = visibleText(html);
    expect(text).not.toMatch(/\b[0-9a-f]{24}\b/i);
    expect(text).not.toMatch(/\b[0-9a-f]{32}\b/i);
    for (const word of ["trace", "session", "environment"]) {
      expect(text.toLowerCase()).not.toContain(word);
    }
    // Not in attributes either: the whole dialog DOM is free of the values.
    for (const value of hiddenValues) {
      expect(html).not.toContain(value);
    }
    expect(html).not.toContain("1280");
  });

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
