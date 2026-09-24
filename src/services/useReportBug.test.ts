import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import type { ApiError, ChaMessageType, MessageType } from "@/types";
import type { TelemetryConfig } from "@/observability/telemetry";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  getSessionId: vi.fn<() => string | undefined>(),
  resolveTelemetryConfig: vi.fn<() => TelemetryConfig | null>(),
  getRecentConsoleErrors: vi.fn(),
}));

vi.mock("@/services/axios", () => ({ default: { post: mocks.post } }));
vi.mock("@/observability/telemetry", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/observability/telemetry")>();
  return {
    ...actual,
    getSessionId: mocks.getSessionId,
    resolveTelemetryConfig: mocks.resolveTelemetryConfig,
    getRecentConsoleErrors: mocks.getRecentConsoleErrors,
  };
});

import {
  BUG_REPORT_DESCRIPTION_MAX,
  ReportBugSchema,
  buildBugReportContext,
  buildBugReportFormData,
  collectBugReportContext,
  conversationIdFromPath,
  httpReportBug,
  reportBugErrorMessage,
  resolveMessageAndTrace,
  type BugReportContext,
} from "./useReportBug";
import { QUERY_KEYS } from "./keys";
import { clearLastTraces, rememberTraceId } from "@/observability/lastTrace";

const TRACE_STREAM = "0af7651916cd43dd8448eb211c80319c";
const TRACE_STORED = "4bf92f3577b34da6a3ce929d0e0e4736";

const telemetry: TelemetryConfig = {
  endpoint: "http://localhost:4318",
  ingestKey: "k",
  uiUrl: "http://localhost:8081",
  environment: "local",
  privacyMode: "clear",
  consoleCapture: false,
};

const CONTEXT_KEYS = [
  "session_id",
  "replay_url",
  "trace_id",
  "conversation_id",
  "message_id",
  "app_version",
  "app_commit",
  "environment",
  "user_agent",
  "viewport",
  "path",
  "console_errors",
  "privacy_mode",
].sort();

const message = (id: string, trace_id?: string | null) =>
  ({ id, trace_id }) as unknown as MessageType;

const sampleContext: BugReportContext = {
  session_id: "sess-1",
  replay_url: "http://localhost:8081/sessions?sid=sess-1",
  trace_id: TRACE_STREAM,
  conversation_id: "conv-1",
  message_id: "msg-2",
  app_version: "v0.1.2",
  app_commit: "abc1234def",
  environment: "local",
  user_agent: "UA/1.0",
  viewport: { width: 1280, height: 800 },
  path: "/chat/conv-1",
  console_errors: ["2026-09-24T10:00:00.000Z error: boom"],
  privacy_mode: "clear",
};

beforeEach(() => {
  mocks.post.mockReset();
  mocks.getSessionId.mockReset();
  mocks.resolveTelemetryConfig.mockReset();
  mocks.getRecentConsoleErrors.mockReset().mockReturnValue([]);
  clearLastTraces();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ReportBugSchema", () => {
  it("requires a description", () => {
    expect(ReportBugSchema.safeParse({ description: "" }).success).toBe(false);
    expect(ReportBugSchema.safeParse({ description: "   " }).success).toBe(
      false,
    );
  });

  it("accepts 4000 characters and rejects 4001", () => {
    const max = "a".repeat(BUG_REPORT_DESCRIPTION_MAX);
    expect(ReportBugSchema.safeParse({ description: max }).success).toBe(true);
    expect(
      ReportBugSchema.safeParse({ description: `${max}a` }).success,
    ).toBe(false);
  });
});

describe("buildBugReportContext", () => {
  const base = {
    telemetry,
    sessionId: "sess-1",
    traceId: TRACE_STREAM,
    conversationId: "conv-1",
    messageId: "msg-2",
    appVersion: "v0.1.2",
    appCommit: "abc1234def",
    environment: "local",
    userAgent: "UA/1.0",
    viewport: { width: 1280, height: 800 },
    path: "/chat/conv-1",
    consoleErrors: [
      { level: "error" as const, message: "boom", at: "2026-09-24T10:00:00.000Z" },
    ],
    now: Date.parse("2026-09-24T10:00:00Z"),
  };

  it("has exactly the fields of the contract", () => {
    const context = buildBugReportContext(base);
    expect(Object.keys(context).sort()).toEqual(CONTEXT_KEYS);
    expect(context).toMatchObject({
      session_id: "sess-1",
      trace_id: TRACE_STREAM,
      conversation_id: "conv-1",
      message_id: "msg-2",
      app_version: "v0.1.2",
      app_commit: "abc1234def",
      environment: "local",
      user_agent: "UA/1.0",
      viewport: { width: 1280, height: 800 },
      path: "/chat/conv-1",
      console_errors: ["2026-09-24T10:00:00.000Z error: boom"],
      privacy_mode: "clear",
    });
  });

  it("links the replay through buildSessionUrl", () => {
    const { replay_url } = buildBugReportContext(base);
    const url = new URL(replay_url!);
    expect(url.origin + url.pathname).toBe("http://localhost:8081/sessions");
    expect(url.searchParams.get("sid")).toBe("sess-1");
  });

  it("sends no replay link when replay is off", () => {
    const context = buildBugReportContext({
      ...base,
      telemetry: { ...telemetry, privacyMode: "off" },
    });
    expect(context.replay_url).toBeNull();
    expect(context.session_id).toBe("sess-1");
  });

  it("is all null, privacy off, with telemetry off", () => {
    const context = buildBugReportContext({
      ...base,
      telemetry: null,
      sessionId: undefined,
      traceId: undefined,
      appVersion: "",
      appCommit: undefined,
      environment: undefined,
    });
    expect(context).toMatchObject({
      session_id: null,
      replay_url: null,
      trace_id: null,
      app_version: null,
      app_commit: null,
      environment: null,
      privacy_mode: "off",
    });
  });
});

describe("conversationIdFromPath", () => {
  it("reads the id of a chat page", () => {
    expect(conversationIdFromPath("/chat/abc123")).toBe("abc123");
  });

  it("is undefined elsewhere", () => {
    expect(conversationIdFromPath("/")).toBeUndefined();
    expect(conversationIdFromPath("/artifacts")).toBeUndefined();
  });
});

describe("resolveMessageAndTrace", () => {
  const conversation = {
    messages: [
      message("msg-1", TRACE_STORED),
      message("msg-2", TRACE_STREAM),
      message("temp-3"),
    ],
  };

  it("prefers the trace from the stream and finds its message", () => {
    expect(resolveMessageAndTrace(conversation, TRACE_STORED)).toEqual({
      messageId: "msg-1",
      traceId: TRACE_STORED,
    });
  });

  it("falls back to the last persisted message and its trace", () => {
    expect(resolveMessageAndTrace(conversation, undefined)).toEqual({
      messageId: "msg-2",
      traceId: TRACE_STREAM,
    });
  });

  it("is empty without a conversation", () => {
    expect(resolveMessageAndTrace(undefined, undefined)).toEqual({
      messageId: undefined,
      traceId: undefined,
    });
  });
});

describe("collectBugReportContext", () => {
  it("reads telemetry, the remembered trace, the cached conversation and the window", () => {
    vi.stubEnv("VITE_APP_VERSION", "v0.1.2");
    vi.stubEnv("VITE_APP_COMMIT", "abc1234def");
    vi.stubGlobal("window", {
      __EVE_CONFIG__: { OBSERVABILITY_ENVIRONMENT: "local" },
      location: { pathname: "/chat/conv-1" },
      innerWidth: 1280,
      innerHeight: 800,
    });
    vi.stubGlobal("navigator", { userAgent: "UA/1.0" });
    mocks.resolveTelemetryConfig.mockReturnValue(telemetry);
    mocks.getSessionId.mockReturnValue("sess-1");
    mocks.getRecentConsoleErrors.mockReturnValue([
      { level: "warn", message: "careful", at: "2026-09-24T10:00:00.000Z" },
    ]);
    rememberTraceId("conv-1", TRACE_STREAM);
    const queryClient = new QueryClient();
    queryClient.setQueryData<Partial<ChaMessageType>>(
      [QUERY_KEYS.conversation, "conv-1"],
      { messages: [message("msg-1", TRACE_STORED), message("msg-2", TRACE_STREAM)] },
    );

    const context = collectBugReportContext(queryClient);

    expect(context).toMatchObject({
      session_id: "sess-1",
      trace_id: TRACE_STREAM,
      conversation_id: "conv-1",
      message_id: "msg-2",
      app_version: "v0.1.2",
      app_commit: "abc1234def",
      environment: "local",
      user_agent: "UA/1.0",
      viewport: { width: 1280, height: 800 },
      path: "/chat/conv-1",
      console_errors: ["2026-09-24T10:00:00.000Z warn: careful"],
      privacy_mode: "clear",
    });
    expect(context.replay_url).toContain("sid=sess-1");
  });
});

describe("buildBugReportFormData", () => {
  it("carries description, context as JSON text and the screenshot file", () => {
    const screenshot = new Blob([new Uint8Array(10)], { type: "image/jpeg" });
    const form = buildBugReportFormData({
      description: "The answer never arrived",
      context: sampleContext,
      screenshot,
    });

    expect([...form.keys()].sort()).toEqual([
      "context",
      "description",
      "screenshot",
    ]);
    expect(form.get("description")).toBe("The answer never arrived");
    const context = JSON.parse(form.get("context") as string);
    expect(context).toEqual(sampleContext);
    expect(Object.keys(context).sort()).toEqual(CONTEXT_KEYS);
    const file = form.get("screenshot") as File;
    expect(file.name).toBe("screenshot.jpg");
    expect(file.type).toBe("image/jpeg");
    expect(file.size).toBe(10);
  });

  it("names a PNG screenshot .png", () => {
    const form = buildBugReportFormData({
      description: "x",
      context: sampleContext,
      screenshot: new Blob(["png"], { type: "image/png" }),
    });
    expect((form.get("screenshot") as File).name).toBe("screenshot.png");
  });

  it("has no screenshot field without a screenshot", () => {
    const form = buildBugReportFormData({
      description: "x",
      context: sampleContext,
      screenshot: null,
    });
    expect(form.has("screenshot")).toBe(false);
  });
});

describe("httpReportBug", () => {
  it("posts multipart to /bug-reports and returns the created report", async () => {
    const created = { id: "r1", created_at: "2026-09-24T10:00:00Z", screenshot: false };
    mocks.post.mockResolvedValue({ data: created });

    const result = await httpReportBug({
      description: "Broken",
      context: sampleContext,
    });

    expect(result).toEqual(created);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = mocks.post.mock.calls[0];
    expect(url).toBe("/bug-reports");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("description")).toBe("Broken");
    expect(JSON.parse((body as FormData).get("context") as string)).toEqual(
      sampleContext,
    );
    expect(config).toEqual({
      headers: { "Content-Type": "multipart/form-data" },
    });
  });
});

describe("reportBugErrorMessage", () => {
  const apiError = (status: number, data: unknown) =>
    ({ response: { status, data } }) as unknown as ApiError & AxiosError;

  it("explains the hourly limit on bug_report_rate_limited", () => {
    const message = reportBugErrorMessage(
      apiError(429, {
        detail: { code: "bug_report_rate_limited", message: "Too many" },
      }),
    );
    expect(message).toContain("5 bug reports in the last hour");
  });

  it("never shows the token budget text for a 429", () => {
    const message = reportBugErrorMessage(apiError(429, { detail: "slow down" }));
    expect(message).not.toContain("credits");
  });

  it("passes other errors through the shared handler", () => {
    expect(
      reportBugErrorMessage(apiError(422, { detail: "description too long" })),
    ).toBe("description too long");
  });
});
