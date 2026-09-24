/**
 * Browser telemetry: traces, errors and session replay sent to the ClickStack
 * (HyperDX) collector over OTLP.
 *
 * Off unless OBSERVABILITY_ENDPOINT is configured. When it is off nothing is
 * imported, nothing is wrapped and every export below is a cheap no-op, so the
 * app behaves exactly as it did before this module existed. The SDK is loaded
 * with a dynamic import() so it lives in its own chunk and never reaches a
 * browser that does not need it; calls made before the import resolves wait in
 * a bounded queue. Nothing here throws: telemetry must never break the app.
 */
import { configValue, type ConfigKey } from "@/utilities/runtimeConfig";
import { resolveApiOrigin } from "@/utilities/sameOrigin";
import { installConsoleRing, getRecentConsoleErrors } from "./consoleRing";
import { redactString } from "./redact";

export { getRecentConsoleErrors };

export type PrivacyMode = "off" | "mask" | "on_demand" | "clear";

export const PRIVACY_MODES: readonly PrivacyMode[] = [
  "off",
  "mask",
  "on_demand",
  "clear",
];

/**
 * Used when OBSERVABILITY_PRIVACY_MODE is blank or unknown. Replay stays on,
 * but every input and text node is masked, so a missing variable never records
 * what a user typed or read.
 */
export const DEFAULT_PRIVACY_MODE: PrivacyMode = "mask";

/** Elements the replay never records: the composer and the message bubbles. */
export const PRIVATE_SELECTOR = "[data-private]";

export const SERVICE_NAME = "eve-frontend";

export type TelemetryConfig = {
  endpoint: string;
  ingestKey: string;
  uiUrl?: string;
  environment?: string;
  privacyMode: PrivacyMode;
  consoleCapture: boolean;
};

type ReplayOptions = {
  disableReplay?: boolean;
  maskAllInputs?: boolean;
  maskAllText?: boolean;
  blockSelector?: string;
};

type AttributeValue = string | number | boolean;
type Attributes = Record<string, AttributeValue>;

/** The subset of the `@hyperdx/browser` init options this app sets. */
export type SdkInitOptions = ReplayOptions & {
  service: string;
  apiKey: string;
  url: string;
  consoleCapture: boolean;
  advancedNetworkCapture: false;
  tracePropagationTargets: RegExp[];
  otelResourceAttributes: Attributes;
};

export const parsePrivacyMode = (raw: string | undefined): PrivacyMode => {
  const value = (raw ?? "").trim().toLowerCase();
  return (PRIVACY_MODES as readonly string[]).includes(value)
    ? (value as PrivacyMode)
    : DEFAULT_PRIVACY_MODE;
};

/**
 * The replay options each privacy mode maps to, named as the SDK names them.
 *
 * - off: no replay at all.
 * - mask: replay with every input and text node masked.
 * - on_demand: no replay at init; startReplayOnDemand() starts a masked one.
 * - clear: replay unmasked except for the [data-private] regions.
 */
export const privacyOptions = (mode: PrivacyMode): ReplayOptions => {
  switch (mode) {
    case "off":
      return { disableReplay: true };
    case "mask":
      return {
        maskAllInputs: true,
        maskAllText: true,
        blockSelector: PRIVATE_SELECTOR,
      };
    case "on_demand":
      return { disableReplay: true };
    case "clear":
      return {
        maskAllInputs: false,
        maskAllText: false,
        blockSelector: PRIVATE_SELECTOR,
      };
  }
};

/**
 * Reads the OBSERVABILITY_* keys. Returns null when there is no endpoint,
 * which is the one switch that turns telemetry on.
 */
export const resolveTelemetryConfig = (
  read: (key: ConfigKey) => string | undefined = configValue,
): TelemetryConfig | null => {
  const endpoint = read("OBSERVABILITY_ENDPOINT")?.replace(/\/+$/, "");
  if (!endpoint) return null;
  return {
    endpoint,
    ingestKey: read("OBSERVABILITY_INGEST_KEY") ?? "",
    uiUrl: read("OBSERVABILITY_UI_URL"),
    environment: read("OBSERVABILITY_ENVIRONMENT"),
    privacyMode: parsePrivacyMode(read("OBSERVABILITY_PRIVACY_MODE")),
    consoleCapture:
      (read("OBSERVABILITY_CONSOLE_CAPTURE") ?? "").toLowerCase() === "true",
  };
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * Matches every URL on exactly `origin` and nothing else.
 *
 * The SDK compares a string target with `===` against the full request URL, so
 * the bare origin as a string would match no API call and no traceparent would
 * ever be sent. A RegExp built only from the escaped origin, anchored at the
 * start and closed by "/", "?", "#" or the end, keeps the exact origin
 * semantics: `https://api.x.com.evil.com` and `https://api.x.com:8443` do not
 * match.
 */
export const exactOriginMatcher = (origin: string): RegExp =>
  new RegExp(`^${escapeRegExp(origin)}(?:[/?#]|$)`);

export const buildSdkOptions = (
  config: TelemetryConfig,
  context: {
    apiOrigin: string;
    version?: string;
    commit?: string;
  },
): SdkInitOptions => {
  const resource: Attributes = {};
  if (context.version) resource["service.version"] = context.version;
  if (context.commit) resource["vcs.ref.head.revision"] = context.commit;
  if (config.environment) {
    resource["deployment.environment.name"] = config.environment;
  }
  return {
    service: SERVICE_NAME,
    apiKey: config.ingestKey,
    url: config.endpoint,
    consoleCapture: config.consoleCapture,
    // Always off: it records request headers (Authorization) and bodies (the
    // SSE stream with the whole answer).
    advancedNetworkCapture: false,
    tracePropagationTargets: [exactOriginMatcher(context.apiOrigin)],
    otelResourceAttributes: resource,
    ...privacyOptions(config.privacyMode),
  };
};

/** How far before `at` the session link opens: the minutes that led there. */
export const SESSION_LINK_BEFORE_MS = 10 * 60 * 1000;
/** How far after `at` the session link reaches. */
export const SESSION_LINK_AFTER_MS = 60 * 1000;

/**
 * Deep link to a session in the HyperDX UI, positioned at `at` (epoch ms).
 * HyperDX reads sid, sfrom, sto and ts from /sessions: the session, the time
 * range to load and the moment the player seeks to. Built here because the
 * SDK's own getSessionUrl() always points at hyperdx.io.
 */
export const buildSessionUrl = (
  uiUrl: string | undefined,
  sessionId: string | undefined,
  at: number = Date.now(),
): string | undefined => {
  if (!uiUrl || !sessionId) return undefined;
  let base: URL;
  try {
    base = new URL(uiUrl);
  } catch {
    return undefined;
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") return undefined;
  const url = new URL(`${base.pathname.replace(/\/+$/, "")}/sessions`, base);
  url.searchParams.set("sid", sessionId);
  url.searchParams.set("sfrom", String(at - SESSION_LINK_BEFORE_MS));
  url.searchParams.set("sto", String(at + SESSION_LINK_AFTER_MS));
  url.searchParams.set("ts", String(at));
  return url.toString();
};

const MAX_ATTRIBUTE_LENGTH = 4096;

/** Flattens a context object into redacted, clipped span attributes. */
export const toAttributes = (
  context: Record<string, unknown> | undefined,
): Attributes => {
  const out: Attributes = {};
  if (!context) return out;
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
      continue;
    }
    let text: string;
    if (typeof value === "string") {
      text = value;
    } else {
      try {
        text = JSON.stringify(value) ?? String(value);
      } catch {
        text = String(value);
      }
    }
    out[key] = redactString(text).slice(0, MAX_ATTRIBUTE_LENGTH);
  }
  return out;
};

const toRedactedError = (
  error: unknown,
): { name: string; message: string; stack?: string } => {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: redactString(error.message ?? ""),
      stack: error.stack ? redactString(error.stack) : undefined,
    };
  }
  if (error && typeof error === "object") {
    const e = error as { name?: unknown; message?: unknown; stack?: unknown };
    return {
      name: typeof e.name === "string" && e.name ? e.name : "Error",
      message: redactString(String(e.message ?? "")),
      stack: typeof e.stack === "string" ? redactString(e.stack) : undefined,
    };
  }
  return { name: "Error", message: redactString(String(error)) };
};

/**
 * The redacted error as a real Error. The SDK only reads name, message and
 * stack from an `instanceof Error`; a plain object becomes "Object captured as
 * exception" and loses all three.
 */
export const toSdkError = (error: unknown): Error => {
  const safe = toRedactedError(error);
  const sdkError = new Error(safe.message);
  sdkError.name = safe.name;
  sdkError.stack = safe.stack ?? `${safe.name}: ${safe.message}`;
  return sdkError;
};

// ---------------------------------------------------------------------------
// Runtime state. Everything below is inert until initTelemetry() finds an
// endpoint.

type HyperDXSdk = (typeof import("@hyperdx/browser"))["default"];
type State = "idle" | "disabled" | "loading" | "ready" | "failed";

export const MAX_PENDING_EXCEPTIONS = 50;

let state: State = "idle";
let sdk: HyperDXSdk | undefined;
let activeConfig: TelemetryConfig | null = null;
let pendingExceptions: Array<[Error, Attributes]> = [];
let pendingAttributes: Record<string, string> = {};
let replayStarted = false;

const flushPending = (): void => {
  if (!sdk) return;
  if (Object.keys(pendingAttributes).length > 0) {
    sdk.setGlobalAttributes(pendingAttributes);
  }
  for (const [error, attributes] of pendingExceptions) {
    sdk.recordException(error, attributes);
  }
  pendingExceptions = [];
  pendingAttributes = {};
};

/**
 * Starts browser telemetry when OBSERVABILITY_ENDPOINT is set; otherwise does
 * nothing, not even an import. Safe to call more than once. The returned
 * promise settles when the SDK is ready or has failed to load, and never
 * rejects.
 */
export const initTelemetry = async (): Promise<void> => {
  if (state !== "idle") return;
  try {
    activeConfig = resolveTelemetryConfig();
    if (!activeConfig || typeof window === "undefined") {
      state = "disabled";
      return;
    }
    state = "loading";
    installConsoleRing();
    const options = buildSdkOptions(activeConfig, {
      apiOrigin: resolveApiOrigin(
        import.meta.env.VITE_API_URL,
        window.location.origin,
      ),
      version: import.meta.env.VITE_APP_VERSION,
      commit: import.meta.env.VITE_APP_COMMIT,
    });
    const module = await import("@hyperdx/browser");
    sdk = module.default;
    sdk.init(options);
    state = "ready";
    flushPending();
  } catch (error) {
    state = "failed";
    sdk = undefined;
    pendingExceptions = [];
    pendingAttributes = {};
    if (import.meta.env.DEV) {
      console.warn("Telemetry disabled, the SDK failed to start:", error);
    }
  }
};

/**
 * Records an exception on the telemetry backend. Message, stack and every
 * string in `context` are redacted first. Queued (bounded) while the SDK is
 * loading, dropped when telemetry is off.
 */
export const recordException = (
  error: unknown,
  context?: Record<string, unknown>,
): void => {
  if (state !== "loading" && state !== "ready") return;
  try {
    const safeError = toSdkError(error);
    const attributes = toAttributes(context);
    if (state === "ready" && sdk) {
      sdk.recordException(safeError, attributes);
      return;
    }
    if (pendingExceptions.length < MAX_PENDING_EXCEPTIONS) {
      pendingExceptions.push([safeError, attributes]);
    }
  } catch {
    // Telemetry never breaks the caller.
  }
};

/** Tags every later event with the signed-in user id. */
export const setTelemetryUser = (userId: string | undefined): void => {
  if (!userId || (state !== "loading" && state !== "ready")) return;
  try {
    if (state === "ready" && sdk) {
      sdk.setGlobalAttributes({ userId });
      return;
    }
    pendingAttributes = { ...pendingAttributes, userId };
  } catch {
    // Telemetry never breaks the caller.
  }
};

export const getSessionId = (): string | undefined => {
  try {
    return state === "ready" ? sdk?.getSessionId() : undefined;
  } catch {
    return undefined;
  }
};

/** Deep link to the current session in the HyperDX UI, if both are known. */
export const getSessionUrl = (): string | undefined =>
  buildSessionUrl(activeConfig?.uiUrl, getSessionId());

/**
 * In `on_demand` mode, starts a masked session replay for the rest of the
 * page's life, linked to the current session through rum.sessionId. Resolves
 * to true when a replay is running. The recorder cannot be stopped and resumed
 * cleanly, so there is no matching stop.
 */
export const startReplayOnDemand = async (): Promise<boolean> => {
  if (replayStarted) return true;
  if (
    state !== "ready" ||
    !activeConfig ||
    activeConfig.privacyMode !== "on_demand"
  ) {
    return false;
  }
  try {
    const recorder = (await import("@hyperdx/otel-web-session-recorder"))
      .default;
    if (!recorder.inited) {
      recorder.init({
        apiKey: activeConfig.ingestKey,
        url: `${activeConfig.endpoint}/v1/logs`,
        // The same masking as the `mask` mode, in rrweb's own option names,
        // which is how @hyperdx/browser passes them to this recorder.
        maskAllInputs: true,
        maskTextSelector: "*",
        blockSelector: PRIVATE_SELECTOR,
      });
    }
    replayStarted = recorder.inited;
    return replayStarted;
  } catch {
    return false;
  }
};

