import type { ApiError, ApiErrorDetail, ApiKey, ApiKeyParent, ApiKeyStatus, CreateApiKeyBody } from "@/types";

// Fallback when GET /users/api-keys omits X-API-Key-Limit (an older backend,
// or a header CORS has not exposed yet). Matches the backend default
// (API_KEY_MAX_ACTIVE_PER_USER) so the UI reads correctly even unconfigured.
export const DEFAULT_API_KEY_LIMIT = 10;

export type ExpiryOption = "30" | "90" | "365" | "never";

export const EXPIRY_OPTIONS: { value: ExpiryOption; label: string }[] = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "365 days" },
  { value: "never", label: "No expiration" },
];

export const DEFAULT_EXPIRY: ExpiryOption = "90";

/** `eve_…a1b2c3`, or the bare prefix when a legacy key has no stored suffix. */
export const formatKeyMask = (suffix?: string | null): string =>
  suffix ? `eve_…${suffix}` : "eve_…";

/**
 * Builds the POST /users/api-keys body from the create form. A blank name is
 * omitted rather than sent as "" so the backend's generated default name
 * applies; "No expiration" sends an explicit `null`, distinct from omitting
 * the field (which would take the server's 90-day default). `expires_at` is
 * never sent by this client.
 */
export const buildCreateApiKeyBody = (form: {
  name: string;
  expiry: ExpiryOption;
}): CreateApiKeyBody => {
  const name = form.name.trim();
  return {
    ...(name ? { name } : {}),
    expires_in_days: form.expiry === "never" ? null : Number(form.expiry),
  };
};

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Renders an ISO datetime as day/month/year in UTC, independent of the
// browser's or the test runner's local timezone. Spelled out by hand rather
// than left to Intl/toLocaleDateString: ICU's en-GB month abbreviation for
// September is "Sept" on some Node builds and "Sep" on others, which would
// make this label (and the tests pinned to it) depend on the ICU data the
// runtime happens to ship.
const formatDate = (iso: string): string => {
  const date = new Date(iso);
  const day = date.getUTCDate();
  const month = SHORT_MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

export const apiKeyStatusLabel = (status: ApiKeyStatus): string => {
  switch (status) {
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "revoked":
      return "Revoked";
    default:
      return status;
  }
};

export const createdLabel = (createdAt: string): string =>
  `Created ${formatDate(createdAt)}`;

export const expiryLabel = (
  expiresAt: string | null,
  status: ApiKeyStatus,
): string => {
  if (!expiresAt) return "No expiration";
  const formatted = formatDate(expiresAt);
  return status === "expired" ? `Expired ${formatted}` : `Expires ${formatted}`;
};

export const lastUsedLabel = (lastUsedAt: string | null): string => {
  if (!lastUsedAt) return "Never used";
  const date = new Date(lastUsedAt);
  const datePart = formatDate(lastUsedAt);
  const timePart = `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
  return `Last used ${datePart}, ${timePart}`;
};

/** Null when the key has no parent (line 3 of a row is only rendered then). */
export const provenanceLabel = (createdBy: ApiKeyParent | null): string | null => {
  if (!createdBy) return null;
  return createdBy.token_suffix
    ? `Created via API key ${formatKeyMask(createdBy.token_suffix)}`
    : "Created via another API key";
};

/**
 * Counts a key's active descendants (children, grandchildren, …) by walking
 * `created_by_key_id` edges. Used for the delete confirmation's cascade
 * warning, so a revoked descendant is not counted (it is already gone, not
 * something the delete is about to take down), but traversal continues
 * through it, since ITS children may still be active. A visited set makes
 * a cycle (which should never occur server side, but the client should not
 * trust that) terminate instead of looping.
 */
export const countDescendants = (keys: ApiKey[], rootId: string): number => {
  const childrenByParent = new Map<string, ApiKey[]>();
  for (const key of keys) {
    if (!key.created_by_key_id) continue;
    const children = childrenByParent.get(key.created_by_key_id) ?? [];
    children.push(key);
    childrenByParent.set(key.created_by_key_id, children);
  }

  const visited = new Set<string>([rootId]);
  const queue = [...(childrenByParent.get(rootId) ?? [])];
  let count = 0;

  while (queue.length > 0) {
    const key = queue.shift();
    if (!key || visited.has(key.id)) continue;
    visited.add(key.id);
    if (key.status !== "revoked") count += 1;
    queue.push(...(childrenByParent.get(key.id) ?? []));
  }

  return count;
};

export const cascadeWarning = (n: number): string | null =>
  n === 0 ? null : `${n} ${n === 1 ? "key" : "keys"} created with it will be deleted too.`;

export const countActive = (keys: ApiKey[]): number =>
  keys.filter((key) => key.status === "active").length;

/** True for the 409 the active-key cap sends, the one that should disable Create. */
export const isApiKeyLimitError = (error: unknown): boolean => {
  const detail = (error as ApiError | undefined)?.response?.data?.detail;
  return (
    (error as ApiError | undefined)?.response?.status === 409 &&
    typeof detail === "object" &&
    detail !== null &&
    !Array.isArray(detail) &&
    (detail as ApiErrorDetail).code === "api_key_limit_reached"
  );
};

/** A positive integer parsed from X-API-Key-Limit, or the fallback default. */
export const parseLimitHeader = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_API_KEY_LIMIT;
};

/**
 * Resolves the API base URL for the "Use your key" snippet the same way
 * axios resolves `baseURL`: a relative value (e.g. "/api") is joined onto
 * the page origin, an absolute one keeps its own origin, and a missing or
 * blank value falls back to the page origin. Always origin + pathname, no
 * trailing slash, so callers can append "/v1/..." directly.
 */
export const resolveApiBaseUrl = (
  apiUrl: string | undefined,
  pageOrigin: string,
): string => {
  try {
    const url = new URL((apiUrl ?? "").trim() || "/", pageOrigin);
    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${pathname}`;
  } catch {
    return pageOrigin;
  }
};

/**
 * The "Use your key" example. Takes a base URL, never a token: the secret
 * exists only in the reveal view's state, and this snippet is also rendered,
 * collapsed, from the list view where no secret is in scope. `$EVE_API_KEY`
 * is a placeholder for the user's shell, not a value this app ever fills in.
 */
export const buildUsageSnippet = (baseUrl: string): string =>
  [
    `Set EVE_API_KEY to your key. The API is OpenAI-compatible: use \`${baseUrl}/v1\` as base_url.`,
    "",
    `curl ${baseUrl}/v1/models -H "Authorization: Bearer $EVE_API_KEY"`,
    `curl ${baseUrl}/v1/chat/completions \\`,
    `  -H "Authorization: Bearer $EVE_API_KEY" -H "Content-Type: application/json" \\`,
    `  -d '{"model": "<model id from /v1/models>", "messages": [{"role": "user", "content": "Hello, EVE"}]}'`,
  ].join("\n");
