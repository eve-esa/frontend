import { describe, expect, it } from "vitest";
import {
  DEFAULT_API_KEY_LIMIT,
  buildCreateApiKeyBody,
  buildQuickstartSteps,
  pickQuickstartModel,
  cascadeWarning,
  countActive,
  countDescendants,
  createdLabel,
  expiryLabel,
  expiryShort,
  formatKeyMask,
  isApiKeyLimitError,
  lastUsedLabel,
  lastUsedShort,
  parseLimitHeader,
  provenanceLabel,
  resolveApiBaseUrl,
} from "./apiKeys";
import type { ApiError, ApiKey } from "@/types";

const NOON_UTC_DEC = "2026-12-17T12:00:00Z";
const NOON_UTC_SEP = "2026-09-18T14:02:00Z";

const key = (overrides: Partial<ApiKey> = {}): ApiKey => ({
  id: "id",
  name: "name",
  token_suffix: "a1b2c3",
  status: "active",
  created_at: NOON_UTC_SEP,
  expires_at: null,
  revoked_at: null,
  last_used_at: null,
  created_via: "oidc",
  created_by_key_id: null,
  created_by: null,
  is_current: false,
  ...overrides,
});

describe("formatKeyMask", () => {
  it("masks a suffix", () => {
    expect(formatKeyMask("a1b2c3")).toBe("eve_…a1b2c3");
  });

  it("falls back to the bare prefix for null", () => {
    expect(formatKeyMask(null)).toBe("eve_…");
  });

  it("falls back to the bare prefix for undefined", () => {
    expect(formatKeyMask(undefined)).toBe("eve_…");
  });
});

describe("buildCreateApiKeyBody", () => {
  it("omits a blank name", () => {
    expect(buildCreateApiKeyBody({ name: "   ", expiry: "90" })).toEqual({
      expires_in_days: 90,
    });
  });

  it("keeps a 100-character name untouched", () => {
    const name = "a".repeat(100);
    expect(buildCreateApiKeyBody({ name, expiry: "90" })).toEqual({
      name,
      expires_in_days: 90,
    });
  });

  it("converts a numeric expiry string to a number", () => {
    expect(buildCreateApiKeyBody({ name: "", expiry: "30" }).expires_in_days).toBe(30);
    expect(buildCreateApiKeyBody({ name: "", expiry: "365" }).expires_in_days).toBe(365);
  });

  it("sends expires_in_days: null for never, and no expires_at", () => {
    const body = buildCreateApiKeyBody({ name: "", expiry: "never" });
    expect(body.expires_in_days).toBeNull();
    expect("expires_at" in body).toBe(false);
  });
});

describe("expiryLabel", () => {
  it("shows No expiration when there is no expiry", () => {
    expect(expiryLabel(null, "active")).toBe("No expiration");
  });

  it("shows Expires with the date for an active key", () => {
    expect(expiryLabel(NOON_UTC_DEC, "active")).toBe("Expires 17 Dec 2026");
  });

  it("shows Expired with the date for an expired key", () => {
    expect(expiryLabel(NOON_UTC_DEC, "expired")).toBe("Expired 17 Dec 2026");
  });
});

describe("lastUsedLabel", () => {
  it("shows Never used when there is no last use", () => {
    expect(lastUsedLabel(null)).toBe("Never used");
  });

  it("shows the UTC date and time", () => {
    expect(lastUsedLabel(NOON_UTC_SEP)).toBe("Last used 18 Sep 2026, 14:02 UTC");
  });
});

describe("createdLabel", () => {
  it("shows the UTC date", () => {
    expect(createdLabel(NOON_UTC_SEP)).toBe("Created 18 Sep 2026");
  });
});

describe("provenanceLabel", () => {
  it("is null for a key made from a session", () => {
    expect(provenanceLabel(null)).toBeNull();
  });

  it("only says a key made it, never which one", () => {
    expect(provenanceLabel("parent-id")).toBe("via API key");
  });
});

describe("lastUsedShort", () => {
  const now = Date.parse("2026-09-18T14:02:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("says Never for an unused key", () => {
    expect(lastUsedShort(null, now)).toBe("Never");
  });

  it("counts elapsed minutes, hours and days", () => {
    expect(lastUsedShort(ago(20_000), now)).toBe("Just now");
    expect(lastUsedShort(ago(5 * 60_000), now)).toBe("5 min ago");
    expect(lastUsedShort(ago(3 * 3_600_000), now)).toBe("3 h ago");
    expect(lastUsedShort(ago(26 * 3_600_000), now)).toBe("1 day ago");
    expect(lastUsedShort(ago(4 * 86_400_000), now)).toBe("4 days ago");
  });

  it("falls back to the date after 30 days", () => {
    expect(lastUsedShort("2026-07-01T12:00:00Z", now)).toBe("1 Jul 2026");
  });
});

describe("expiryShort", () => {
  it("shows the date, No expiry or Expired", () => {
    expect(expiryShort(NOON_UTC_DEC, "active")).toBe("17 Dec 2026");
    expect(expiryShort(null, "active")).toBe("No expiry");
    expect(expiryShort(NOON_UTC_SEP, "expired")).toBe("Expired");
  });
});

describe("countDescendants", () => {
  it("counts a chain of grandchildren", () => {
    const keys = [
      key({ id: "A" }),
      key({ id: "B", created_by_key_id: "A" }),
      key({ id: "C", created_by_key_id: "B" }),
    ];
    expect(countDescendants(keys, "A")).toBe(2);
  });

  it("counts siblings under one parent", () => {
    const keys = [
      key({ id: "A" }),
      key({ id: "B", created_by_key_id: "A" }),
      key({ id: "C", created_by_key_id: "A" }),
    ];
    expect(countDescendants(keys, "A")).toBe(2);
  });

  it("ignores keys under an unrelated parent", () => {
    const keys = [
      key({ id: "A" }),
      key({ id: "B", created_by_key_id: "A" }),
      key({ id: "X" }),
      key({ id: "Y", created_by_key_id: "X" }),
    ];
    expect(countDescendants(keys, "A")).toBe(1);
  });

  it("does not count a revoked child but still counts its children", () => {
    const keys = [
      key({ id: "A" }),
      key({ id: "B", created_by_key_id: "A", status: "revoked" }),
      key({ id: "C", created_by_key_id: "B" }),
    ];
    expect(countDescendants(keys, "A")).toBe(1);
  });

  it("terminates on a cycle", () => {
    const keys = [
      key({ id: "A", created_by_key_id: "C" }),
      key({ id: "B", created_by_key_id: "A" }),
      key({ id: "C", created_by_key_id: "B" }),
    ];
    expect(countDescendants(keys, "A")).toBe(2);
  });

  it("returns 0 for an unknown root", () => {
    expect(countDescendants([key({ id: "A" })], "missing")).toBe(0);
  });
});

describe("cascadeWarning", () => {
  it("is null for zero", () => {
    expect(cascadeWarning(0)).toBeNull();
  });

  it("uses the singular for one", () => {
    expect(cascadeWarning(1)).toBe("1 key created with it will be deleted too.");
  });

  it("uses the plural for more than one", () => {
    expect(cascadeWarning(3)).toBe("3 keys created with it will be deleted too.");
  });
});

describe("countActive", () => {
  it("counts only active keys", () => {
    const keys = [
      key({ id: "A", status: "active" }),
      key({ id: "B", status: "expired" }),
      key({ id: "C", status: "revoked" }),
      key({ id: "D", status: "active" }),
    ];
    expect(countActive(keys)).toBe(2);
  });
});

const apiError = (status: number, detail: unknown): ApiError =>
  ({ response: { status, data: { detail } } }) as ApiError;

describe("isApiKeyLimitError", () => {
  it("is true for the 409 limit-reached detail", () => {
    expect(
      isApiKeyLimitError(
        apiError(409, { code: "api_key_limit_reached", message: "nope", limit: 10 }),
      ),
    ).toBe(true);
  });

  it("is false for a different 409 code", () => {
    expect(isApiKeyLimitError(apiError(409, { code: "something_else" }))).toBe(false);
  });

  it("is false for a non-409 status", () => {
    expect(
      isApiKeyLimitError(apiError(429, { code: "api_key_limit_reached" })),
    ).toBe(false);
  });

  it("is false for a string detail", () => {
    expect(isApiKeyLimitError(apiError(409, "nope"))).toBe(false);
  });

  it("is false for a non-error value", () => {
    expect(isApiKeyLimitError(undefined)).toBe(false);
    expect(isApiKeyLimitError(new Error("boom"))).toBe(false);
  });
});

describe("parseLimitHeader", () => {
  it("parses a numeric string header", () => {
    expect(parseLimitHeader("25")).toBe(25);
  });

  it("falls back to the default for missing, zero or negative values", () => {
    expect(parseLimitHeader(undefined)).toBe(DEFAULT_API_KEY_LIMIT);
    expect(parseLimitHeader("0")).toBe(DEFAULT_API_KEY_LIMIT);
    expect(parseLimitHeader("-1")).toBe(DEFAULT_API_KEY_LIMIT);
  });

  it("falls back to the default for a non-numeric value", () => {
    expect(parseLimitHeader("abc")).toBe(DEFAULT_API_KEY_LIMIT);
  });
});

describe("resolveApiBaseUrl", () => {
  it("joins a relative API url onto the page origin", () => {
    expect(resolveApiBaseUrl("/api", "https://dev.eve-chat.chat")).toBe(
      "https://dev.eve-chat.chat/api",
    );
  });

  it("keeps an absolute API url's own origin", () => {
    expect(resolveApiBaseUrl("http://localhost:8000", "http://localhost:5173")).toBe(
      "http://localhost:8000",
    );
  });

  it("strips a trailing slash", () => {
    expect(resolveApiBaseUrl("/api/", "https://dev.eve-chat.chat")).toBe(
      "https://dev.eve-chat.chat/api",
    );
  });

  it("falls back to the page origin when the api url is undefined or blank", () => {
    expect(resolveApiBaseUrl(undefined, "https://eve-chat.chat")).toBe(
      "https://eve-chat.chat",
    );
    expect(resolveApiBaseUrl("", "https://eve-chat.chat")).toBe("https://eve-chat.chat");
  });
});

describe("buildQuickstartSteps", () => {
  const steps = buildQuickstartSteps("https://dev.eve-chat.chat/api", "eve/eve-esa/EVE-Instruct");
  const all = steps.map((step) => step.code).join("\n");

  it("sets the key and the model first, then lists models, then sends a request", () => {
    expect(steps.map((step) => step.title)).toEqual([
      "Set your key and model",
      "List the models",
      "Send a chat request",
    ]);
    expect(steps[0].code).toBe(
      'export EVE_API_KEY="<your API key>"\nexport EVE_MODEL="eve/eve-esa/EVE-Instruct"',
    );
  });

  it("sends the model from EVE_MODEL, so step 3 runs without edits", () => {
    expect(steps[2].code).toContain('\\"model\\": \\"$EVE_MODEL\\"');
    expect(steps[2].code).not.toContain("<model id>");
  });

  it("falls back to a visible placeholder when no model is known", () => {
    expect(buildQuickstartSteps("https://x/api")[0].code).toContain('EVE_MODEL="<model id>"');
  });

  it("targets the OpenAI-compatible endpoints under the given base", () => {
    expect(steps[1].code).toContain("https://dev.eve-chat.chat/api/v1/models");
    expect(steps[2].code).toContain("https://dev.eve-chat.chat/api/v1/chat/completions");
  });

  it("uses the shell placeholder, never a real secret", () => {
    expect(all).toContain("$EVE_API_KEY");
    expect(all).not.toMatch(/eve_[0-9a-f]{6,}/);
  });

  it("holds commands only, no prose to strip before pasting", () => {
    expect(all).not.toContain("OpenAI-compatible");
  });
});

describe("pickQuickstartModel", () => {
  it("prefers an EVE-hosted model", () => {
    expect(pickQuickstartModel(["jsc/alias-eve", "eve/eve-esa/EVE-Instruct"])).toBe("eve/eve-esa/EVE-Instruct");
  });

  it("falls back to the first listed, then to null", () => {
    expect(pickQuickstartModel(["jsc/alias-eve"])).toBe("jsc/alias-eve");
    expect(pickQuickstartModel([])).toBeNull();
  });
});
