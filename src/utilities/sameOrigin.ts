/**
 * Origin-safety helpers. The bearer token lives in localStorage and is attached
 * by the axios request interceptor, so it must ONLY ever travel to our own app
 * origin or the configured API origin. A naive string-prefix check ("starts with
 * /") is unsafe: a protocol-relative URL like `//attacker.example/x` also starts
 * with "/" and would resolve to a foreign host, exfiltrating the JWT. These pure
 * helpers resolve real origins the same way axios does and are the single source
 * of truth for "is this request target trusted?" — used by both the axios
 * interceptor and AuthenticatedImage.
 *
 * Kept dependency-free and pure (origins passed in, not read from `window`) so
 * they remain unit-testable if/when a frontend test harness is added.
 */

/** Resolves the configured API origin from VITE_API_URL, falling back to the page origin. */
export const resolveApiOrigin = (
  apiUrl: string | undefined,
  pageOrigin: string,
): string => {
  try {
    return apiUrl ? new URL(apiUrl, pageOrigin).origin : pageOrigin;
  } catch {
    return pageOrigin;
  }
};

/**
 * Returns true only when a request to `url` (as resolved by axios, i.e. relative
 * URLs are joined onto `baseUrl`) targets our page origin or the API origin.
 *
 * Protocol-relative (`//host/...`) and cross-origin absolute URLs resolve to a
 * foreign origin and return false. Unparseable inputs and opaque origins
 * (`data:`, `blob:`) also return false, so credentials are never attached and
 * such images fall back to a plain, tokenless `<img>`.
 */
export const isTrustedRequestUrl = (
  url: string | undefined,
  baseUrl: string | undefined,
  pageOrigin: string,
  apiOrigin: string,
): boolean => {
  const target = (url ?? "").trim();

  // Protocol-relative URLs (`//host/...`, plus the backslash variants
  // `/\`, `\/`, `\\` that browsers normalize to `//`) borrow the page scheme and
  // point at an arbitrary host while still starting with a slash. Reject them
  // outright — legitimate API calls never use this form.
  if (/^[\\/]{2}/.test(target)) return false;

  try {
    // Mirror axios: relative URLs are resolved against baseURL; absolute URLs
    // keep their own origin.
    const base = baseUrl || pageOrigin;
    const resolved = new URL(target, base);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return false;
    }
    return resolved.origin === pageOrigin || resolved.origin === apiOrigin;
  } catch {
    return false;
  }
};
