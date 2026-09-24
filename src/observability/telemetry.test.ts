import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import type { ConfigKey } from "@/utilities/runtimeConfig";

// Records whether the SDK module was ever evaluated, and what init received.
const sdkState = vi.hoisted(() => ({
  imported: 0,
  init: vi.fn(),
  recordException: vi.fn(),
  setGlobalAttributes: vi.fn(),
  getSessionId: vi.fn(() => "session-1"),
}));
const recorderState = vi.hoisted(() => ({
  imported: 0,
  init: vi.fn(),
  inited: false,
}));

// Registered again on every load (doMock, after the module registry reset in
// stubRuntimeConfig), so a factory run always means a real import in that test.
const mockSdkModules = () => {
  vi.doMock("@hyperdx/browser", () => {
    sdkState.imported += 1;
    return {
      default: {
        init: sdkState.init,
        recordException: sdkState.recordException,
        setGlobalAttributes: sdkState.setGlobalAttributes,
        getSessionId: sdkState.getSessionId,
      },
    };
  });
  vi.doMock("@hyperdx/otel-web-session-recorder", () => {
    recorderState.imported += 1;
    return {
      default: {
        get inited() {
          return recorderState.inited;
        },
        init: (config: unknown) => {
          recorderState.init(config);
          recorderState.inited = true;
        },
      },
    };
  });
};

const PAGE_ORIGIN = "https://app.example.org";

const loadTelemetry = (config: Partial<Record<ConfigKey, string>>) => {
  stubRuntimeConfig(config);
  mockSdkModules();
  vi.stubGlobal("window", {
    __EVE_CONFIG__: config,
    location: { origin: PAGE_ORIGIN },
  });
  vi.stubEnv("VITE_API_URL", "https://api.example.org/v1");
  return import("./telemetry");
};

const originalConsole = { error: console.error, warn: console.warn };

beforeEach(() => {
  sdkState.imported = 0;
  sdkState.init.mockClear();
  sdkState.recordException.mockClear();
  sdkState.setGlobalAttributes.mockClear();
  recorderState.imported = 0;
  recorderState.init.mockClear();
  recorderState.inited = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
});

describe("resolveTelemetryConfig", () => {
  const reader =
    (values: Partial<Record<ConfigKey, string>>) => (key: ConfigKey) =>
      values[key];

  it("is null without an endpoint, whatever else is set", async () => {
    const { resolveTelemetryConfig } = await loadTelemetry({});
    expect(
      resolveTelemetryConfig(
        reader({
          OBSERVABILITY_INGEST_KEY: "k",
          OBSERVABILITY_PRIVACY_MODE: "clear",
        }),
      ),
    ).toBeNull();
  });

  it("reads every key and trims the trailing slash of the endpoint", async () => {
    const { resolveTelemetryConfig } = await loadTelemetry({});
    expect(
      resolveTelemetryConfig(
        reader({
          OBSERVABILITY_ENDPOINT: "http://localhost:4318/",
          OBSERVABILITY_INGEST_KEY: "browser-key",
          OBSERVABILITY_UI_URL: "http://localhost:8081",
          OBSERVABILITY_ENVIRONMENT: "local",
          OBSERVABILITY_PRIVACY_MODE: "CLEAR",
          OBSERVABILITY_CONSOLE_CAPTURE: "true",
        }),
      ),
    ).toEqual({
      endpoint: "http://localhost:4318",
      ingestKey: "browser-key",
      uiUrl: "http://localhost:8081",
      environment: "local",
      privacyMode: "clear",
      consoleCapture: true,
    });
  });

  it("defaults to masked replay and no console capture", async () => {
    const { resolveTelemetryConfig } = await loadTelemetry({});
    const config = resolveTelemetryConfig(
      reader({ OBSERVABILITY_ENDPOINT: "http://collector" }),
    );
    expect(config?.privacyMode).toBe("mask");
    expect(config?.consoleCapture).toBe(false);
    expect(config?.ingestKey).toBe("");
  });

  it("reads the injected runtime config by default", async () => {
    const { resolveTelemetryConfig } = await loadTelemetry({
      OBSERVABILITY_ENDPOINT: " http://collector ",
      OBSERVABILITY_PRIVACY_MODE: "on_demand",
    });
    expect(resolveTelemetryConfig()).toMatchObject({
      endpoint: "http://collector",
      privacyMode: "on_demand",
    });
  });
});

describe("privacy modes", () => {
  it("map to the documented SDK options", async () => {
    const { privacyOptions } = await loadTelemetry({});
    expect(privacyOptions("off")).toEqual({ disableReplay: true });
    expect(privacyOptions("mask")).toEqual({
      maskAllInputs: true,
      maskAllText: true,
      blockSelector: "[data-private]",
    });
    expect(privacyOptions("on_demand")).toEqual({ disableReplay: true });
    expect(privacyOptions("clear")).toEqual({
      maskAllInputs: false,
      maskAllText: false,
      blockSelector: "[data-private]",
    });
  });

  it("fall back to mask on a blank or unknown value", async () => {
    const { parsePrivacyMode } = await loadTelemetry({});
    expect(parsePrivacyMode(undefined)).toBe("mask");
    expect(parsePrivacyMode("")).toBe("mask");
    expect(parsePrivacyMode("everything")).toBe("mask");
    expect(parsePrivacyMode(" Off ")).toBe("off");
  });
});

describe("buildSdkOptions", () => {
  const config = {
    endpoint: "http://localhost:4318",
    ingestKey: "browser-key",
    environment: "local",
    privacyMode: "mask" as const,
    consoleCapture: false,
  };

  it("sets service, key, url, resource and never advanced network capture", async () => {
    const { buildSdkOptions } = await loadTelemetry({});
    const options = buildSdkOptions(config, {
      apiOrigin: "https://api.example.org",
      version: "0.0.19",
      commit: "abc123",
    });
    expect(options).toMatchObject({
      service: "eve-frontend",
      apiKey: "browser-key",
      url: "http://localhost:4318",
      consoleCapture: false,
      advancedNetworkCapture: false,
      maskAllInputs: true,
      maskAllText: true,
      blockSelector: "[data-private]",
      otelResourceAttributes: {
        "service.version": "0.0.19",
        "vcs.ref.head.revision": "abc123",
        "deployment.environment.name": "local",
      },
    });
  });

  it("propagates traceparent to the API origin only", async () => {
    const { buildSdkOptions } = await loadTelemetry({});
    const { tracePropagationTargets } = buildSdkOptions(config, {
      apiOrigin: "https://api.example.org",
    });
    expect(tracePropagationTargets).toHaveLength(1);
    const [target] = tracePropagationTargets;
    for (const url of [
      "https://api.example.org",
      "https://api.example.org/",
      "https://api.example.org/conversations/1/stream_messages",
      "https://api.example.org?x=1",
    ]) {
      expect(target.test(url), url).toBe(true);
    }
    for (const url of [
      "https://api.example.org.evil.com/x",
      "https://api.example.org:8443/x",
      "http://api.example.org/x",
      "https://apixexample.org/x",
      "https://evil.com/?u=https://api.example.org/",
      "https://keycloak.example.org/realms/eve",
    ]) {
      expect(target.test(url), url).toBe(false);
    }
  });

  it("uses the origin sameOrigin.resolveApiOrigin returns at init", async () => {
    const telemetry = await loadTelemetry({
      OBSERVABILITY_ENDPOINT: "http://localhost:4318",
    });
    await telemetry.initTelemetry();
    const options = sdkState.init.mock.calls[0][0];
    const { resolveApiOrigin } = await import("@/utilities/sameOrigin");
    const origin = resolveApiOrigin("https://api.example.org/v1", PAGE_ORIGIN);
    expect(origin).toBe("https://api.example.org");
    expect(options.tracePropagationTargets).toEqual([
      telemetry.exactOriginMatcher(origin),
    ]);
    expect(options.advancedNetworkCapture).toBe(false);
  });
});

describe("buildSessionUrl", () => {
  const now = 1_700_000_000_000;
  const fourHours = 4 * 60 * 60 * 1000;

  it("links to the session page of the configured UI", async () => {
    const { buildSessionUrl } = await loadTelemetry({});
    const url = new URL(
      buildSessionUrl("https://o11y.example.org/", "abc", now)!,
    );
    expect(url.origin + url.pathname).toBe("https://o11y.example.org/sessions");
    expect(url.searchParams.get("sid")).toBe("abc");
    expect(url.searchParams.get("sfrom")).toBe(String(now - fourHours));
    expect(url.searchParams.get("sto")).toBe(String(now + fourHours));
  });

  it("keeps a path prefix and encodes the session id", async () => {
    const { buildSessionUrl } = await loadTelemetry({});
    const url = new URL(
      buildSessionUrl("https://example.org/hyperdx", "a b&c", now)!,
    );
    expect(url.pathname).toBe("/hyperdx/sessions");
    expect(url.searchParams.get("sid")).toBe("a b&c");
  });

  it("is undefined without a UI, a session or a web URL", async () => {
    const { buildSessionUrl } = await loadTelemetry({});
    expect(buildSessionUrl(undefined, "abc", now)).toBeUndefined();
    expect(buildSessionUrl("https://o11y.example.org", undefined)).toBeUndefined();
    expect(buildSessionUrl("not a url", "abc")).toBeUndefined();
    expect(buildSessionUrl("javascript:alert(1)", "abc")).toBeUndefined();
  });
});

describe("initTelemetry without an endpoint", () => {
  it("never imports the SDK and leaves console untouched", async () => {
    const telemetry = await loadTelemetry({});
    const errorBefore = console.error;
    await telemetry.initTelemetry();
    telemetry.recordException(new Error("boom"), { a: 1 });
    telemetry.setTelemetryUser("user-1");
    expect(await telemetry.startReplayOnDemand()).toBe(false);

    expect(sdkState.imported).toBe(0);
    expect(recorderState.imported).toBe(0);
    expect(sdkState.init).not.toHaveBeenCalled();
    expect(console.error).toBe(errorBefore);
    expect(telemetry.getSessionId()).toBeUndefined();
    expect(telemetry.getRecentConsoleErrors()).toEqual([]);
  });

  it("treats a blank endpoint, as GitHub injects it, as unset", async () => {
    const telemetry = await loadTelemetry({ OBSERVABILITY_ENDPOINT: "  " });
    await telemetry.initTelemetry();
    expect(sdkState.imported).toBe(0);
  });
});

describe("initTelemetry with an endpoint", () => {
  it("imports and initialises the SDK, then flushes the queue", async () => {
    const telemetry = await loadTelemetry({
      OBSERVABILITY_ENDPOINT: "http://localhost:4318",
      OBSERVABILITY_INGEST_KEY: "browser-key",
    });
    const ready = telemetry.initTelemetry();
    // Before the import resolves: queued, redacted.
    telemetry.recordException(new Error("token=abc123 failed"), {
      "url.full": "https://app/x?api_key=secret",
    });
    telemetry.setTelemetryUser("user-1");
    expect(sdkState.recordException).not.toHaveBeenCalled();
    await ready;

    expect(sdkState.imported).toBe(1);
    expect(sdkState.init).toHaveBeenCalledTimes(1);
    expect(sdkState.setGlobalAttributes).toHaveBeenCalledWith({
      userId: "user-1",
    });
    expect(sdkState.recordException).toHaveBeenCalledTimes(1);
    const [error, attributes] = sdkState.recordException.mock.calls[0];
    expect(error.message).toBe("token=[REDACTED] failed");
    expect(attributes["url.full"]).toBe("https://app/x?api_key=[REDACTED]");
    expect(telemetry.getSessionId()).toBe("session-1");
  });

  it("bounds the queue while the SDK is loading", async () => {
    const telemetry = await loadTelemetry({
      OBSERVABILITY_ENDPOINT: "http://localhost:4318",
    });
    const ready = telemetry.initTelemetry();
    for (let i = 0; i < telemetry.MAX_PENDING_EXCEPTIONS + 25; i += 1) {
      telemetry.recordException(new Error(`e${i}`));
    }
    await ready;
    expect(sdkState.recordException).toHaveBeenCalledTimes(
      telemetry.MAX_PENDING_EXCEPTIONS,
    );
  });

  it("does not throw and stays off when the SDK fails to start", async () => {
    const telemetry = await loadTelemetry({
      OBSERVABILITY_ENDPOINT: "http://localhost:4318",
    });
    sdkState.init.mockImplementationOnce(() => {
      throw new Error("bad config");
    });
    await expect(telemetry.initTelemetry()).resolves.toBeUndefined();
    expect(() => telemetry.recordException(new Error("x"))).not.toThrow();
    expect(sdkState.recordException).not.toHaveBeenCalled();
  });

  it("starts the on demand replay masked, with the same key and endpoint", async () => {
    const telemetry = await loadTelemetry({
      OBSERVABILITY_ENDPOINT: "http://localhost:4318",
      OBSERVABILITY_INGEST_KEY: "browser-key",
      OBSERVABILITY_PRIVACY_MODE: "on_demand",
    });
    await telemetry.initTelemetry();
    expect(sdkState.init.mock.calls[0][0].disableReplay).toBe(true);
    expect(recorderState.imported).toBe(0);

    expect(await telemetry.startReplayOnDemand()).toBe(true);
    expect(recorderState.init).toHaveBeenCalledWith({
      apiKey: "browser-key",
      url: "http://localhost:4318/v1/logs",
      maskAllInputs: true,
      maskTextSelector: "*",
      blockSelector: "[data-private]",
    });
  });

  it("does not start an on demand replay in any other mode", async () => {
    const telemetry = await loadTelemetry({
      OBSERVABILITY_ENDPOINT: "http://localhost:4318",
      OBSERVABILITY_PRIVACY_MODE: "mask",
    });
    await telemetry.initTelemetry();
    expect(await telemetry.startReplayOnDemand()).toBe(false);
    expect(recorderState.imported).toBe(0);
  });

  it("feeds the console ring buffer with redacted entries", async () => {
    const telemetry = await loadTelemetry({
      OBSERVABILITY_ENDPOINT: "http://localhost:4318",
    });
    console.error = vi.fn();
    console.warn = vi.fn();
    await telemetry.initTelemetry();
    console.error("failed for", "someone@example.org");
    console.warn("Authorization: Bearer abc.def");
    expect(
      telemetry.getRecentConsoleErrors().map((e) => [e.level, e.message]),
    ).toEqual([
      ["error", "failed for [REDACTED_EMAIL]"],
      ["warn", "Authorization: Bearer [REDACTED]"],
    ]);
  });
});
