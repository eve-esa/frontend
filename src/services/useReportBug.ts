import { useMutation, type QueryClient } from "@tanstack/react-query";
import { matchPath } from "react-router-dom";
import { toast } from "sonner";
import z from "zod";
import api from "./axios";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import {
  buildSessionUrl,
  getRecentConsoleErrors,
  getSessionId,
  resolveTelemetryConfig,
  type PrivacyMode,
  type TelemetryConfig,
} from "@/observability/telemetry";
import type { ConsoleEntry } from "@/observability/consoleRing";
import { getLastTraceId, isTraceId } from "@/observability/lastTrace";
import { configValue } from "@/utilities/runtimeConfig";
import { handleApiError } from "@/utilities/helpers";
import type { ApiError, ChaMessageType } from "@/types";

export const BUG_REPORT_DESCRIPTION_MAX = 4000;
export const BUG_REPORT_RATE_LIMITED_CODE = "bug_report_rate_limited";
const CHAT_PATH = "/chat/:conversationId";

export const ReportBugSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, { message: "Please describe what went wrong" })
    .max(BUG_REPORT_DESCRIPTION_MAX, {
      message: `Keep the description under ${BUG_REPORT_DESCRIPTION_MAX} characters`,
    }),
});

export type ReportBugValidation = z.infer<typeof ReportBugSchema>;

/** The `context` form field of POST /bug-reports, as the backend expects it. */
export type BugReportContext = {
  session_id: string | null;
  replay_url: string | null;
  trace_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  app_version: string | null;
  app_commit: string | null;
  environment: string | null;
  user_agent: string;
  viewport: { width: number; height: number };
  path: string;
  console_errors: string[];
  /** Replay privacy mode; "off" too when browser telemetry is off. */
  privacy_mode: PrivacyMode;
};

export type BugReportResponse = {
  id: string;
  created_at: string;
  screenshot: boolean;
};

export type ReportBugParams = {
  description: string;
  context: BugReportContext;
  screenshot?: Blob | null;
};

/** Everything the context is made of, read by collectBugReportContext. */
export type BugReportSources = {
  telemetry: TelemetryConfig | null;
  sessionId?: string;
  traceId?: string;
  conversationId?: string;
  messageId?: string;
  appVersion?: string;
  appCommit?: string;
  environment?: string;
  userAgent: string;
  viewport: { width: number; height: number };
  path: string;
  consoleErrors: ConsoleEntry[];
  now?: number;
};

const orNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const formatConsoleEntry = (entry: ConsoleEntry): string =>
  `${entry.at} ${entry.level}: ${entry.message}`;

/**
 * Pure: the context object from its sources. The replay link is left out when
 * replay is off, because the report would otherwise promise a recording that
 * does not exist.
 */
export const buildBugReportContext = (
  sources: BugReportSources,
): BugReportContext => {
  const privacyMode: PrivacyMode = sources.telemetry?.privacyMode ?? "off";
  const sessionId = orNull(sources.sessionId);
  const replayUrl =
    privacyMode === "off"
      ? undefined
      : buildSessionUrl(
          sources.telemetry?.uiUrl,
          sessionId ?? undefined,
          sources.now,
        );
  return {
    session_id: sessionId,
    replay_url: orNull(replayUrl),
    trace_id: orNull(sources.traceId),
    conversation_id: orNull(sources.conversationId),
    message_id: orNull(sources.messageId),
    app_version: orNull(sources.appVersion),
    app_commit: orNull(sources.appCommit),
    environment: orNull(sources.environment),
    user_agent: sources.userAgent,
    viewport: sources.viewport,
    path: sources.path,
    console_errors: sources.consoleErrors.map(formatConsoleEntry),
    privacy_mode: privacyMode,
  };
};

/** The conversation id of a chat page path, if it is one. */
export const conversationIdFromPath = (pathname: string): string | undefined =>
  matchPath(CHAT_PATH, pathname)?.params.conversationId ?? undefined;

const isPersistedId = (id: string | undefined): id is string =>
  !!id && !id.startsWith("temp-") && !id.startsWith("srv-");

/**
 * The message a report is about, and its trace. The trace remembered from
 * the stream wins; the cached conversation supplies the message id (the final
 * event carries none) and, after a reload, the trace id stored on the message.
 */
export const resolveMessageAndTrace = (
  conversation: Pick<ChaMessageType, "messages"> | undefined,
  rememberedTraceId: string | undefined,
): { messageId?: string; traceId?: string } => {
  const messages = (conversation?.messages ?? []).filter((m) =>
    isPersistedId(m?.id),
  );
  if (rememberedTraceId) {
    const traced = messages.find((m) => m.trace_id === rememberedTraceId);
    return {
      messageId: traced?.id ?? messages[messages.length - 1]?.id,
      traceId: rememberedTraceId,
    };
  }
  const last = messages[messages.length - 1];
  return {
    messageId: last?.id,
    traceId: isTraceId(last?.trace_id) ? last.trace_id : undefined,
  };
};

/**
 * Reads the live sources: telemetry session, remembered trace, the cached
 * conversation of the current chat page, build values and the window.
 */
export const collectBugReportContext = (
  queryClient?: QueryClient,
): BugReportContext => {
  const path = window.location.pathname;
  const conversationId = conversationIdFromPath(path);
  const conversation = conversationId
    ? queryClient?.getQueryData<ChaMessageType>([
        QUERY_KEYS.conversation,
        conversationId,
      ])
    : undefined;
  const { messageId, traceId } = resolveMessageAndTrace(
    conversation,
    getLastTraceId(conversationId),
  );
  return buildBugReportContext({
    telemetry: resolveTelemetryConfig(),
    sessionId: getSessionId(),
    traceId,
    conversationId,
    messageId,
    appVersion: import.meta.env.VITE_APP_VERSION,
    appCommit: import.meta.env.VITE_APP_COMMIT,
    environment: configValue("OBSERVABILITY_ENVIRONMENT"),
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    path,
    consoleErrors: getRecentConsoleErrors(),
  });
};

/** The multipart body of POST /bug-reports. */
export const buildBugReportFormData = ({
  description,
  context,
  screenshot,
}: ReportBugParams): FormData => {
  const formData = new FormData();
  formData.append("description", description);
  formData.append("context", JSON.stringify(context));
  if (screenshot) {
    const extension = screenshot.type === "image/png" ? "png" : "jpg";
    formData.append("screenshot", screenshot, `screenshot.${extension}`);
  }
  return formData;
};

export const httpReportBug = async (
  params: ReportBugParams,
): Promise<BugReportResponse> => {
  const { data } = await api.post<BugReportResponse>(
    "/bug-reports",
    buildBugReportFormData(params),
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
};

/** User facing text for a failed report. */
export const reportBugErrorMessage = (error: ApiError): string => {
  const data = error?.response?.data as
    | { detail?: unknown; code?: unknown }
    | undefined;
  const detail = data?.detail;
  const code =
    detail && typeof detail === "object" && !Array.isArray(detail)
      ? (detail as { code?: unknown }).code
      : data?.code;
  // Any 429 here is the report throttle: the generic 429 text is about the
  // token budget, which a bug report does not spend.
  if (
    code === BUG_REPORT_RATE_LIMITED_CODE ||
    error?.response?.status === 429
  ) {
    return "You have sent 5 bug reports in the last hour. Please try again later.";
  }
  return handleApiError(error);
};

export const useReportBug = (onSuccess?: (data: BugReportResponse) => void) => {
  return useMutation({
    mutationKey: [MUTATION_KEYS.reportBug],
    mutationFn: (params: ReportBugParams) => httpReportBug(params),
    onError: (error: ApiError) => {
      toast.error(reportBugErrorMessage(error));
    },
    onSuccess: (data) => {
      toast.success("Thank you, your report was sent.");
      onSuccess?.(data);
    },
  });
};
