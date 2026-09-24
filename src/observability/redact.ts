/**
 * String redaction for anything the browser sends to the telemetry backend.
 *
 * Same patterns as the backend `src/utils/redaction.py`, so a value scrubbed on
 * one side is scrubbed the same way on the other. Pure and total: a redactor
 * that throws would drop the very error it is protecting.
 */

export const REDACTED = "[REDACTED]";
export const REDACTED_EMAIL = "[REDACTED_EMAIL]";

// user:password@ in any URL.
const URL_USERINFO_RE = /\b([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]*:[^/\s@]+@/gi;
const JWT_RE = /eyJ[a-zA-Z0-9_-]+=*\.[a-zA-Z0-9_-]+=*\.[a-zA-Z0-9_\-+=/.]*/g;
const BEARER_RE = /\b(bearer)\s+[a-z0-9._~+/=-]+/gi;
// Basic needs a base64 looking value with an uppercase letter, digit or
// padding, so prose such as "basic setup" is left alone.
const BASIC_RE =
  /\b([Bb][Aa][Ss][Ii][Cc])\s+(?=[A-Za-z0-9+/]*[A-Z0-9+/=])[A-Za-z0-9+/]{8,}={0,2}/g;
// EVE keys are "eve_" + 64 hex chars, RunPod keys "rpa_" + alphanumerics. The
// length floor keeps identifiers like "eve_free" or "eve_jsc" readable.
const PREFIXED_KEY_RE = /(?<![A-Za-z0-9])(?:eve|rpa)_[A-Za-z0-9]{16,}/g;
// Query parameters named like a credential. The name is kept.
const QUERY_PARAM_RE =
  /([?&;][^=&#\s?;]*?(?:key|token|secret|password|passwd|pwd|signature|credential|jwt|code|session)[^=&#\s?;]*=)[^&#\s;]*/gi;
// Free text assignments: api_key=..., "password": "...", token: ... .
const ASSIGNMENT_RE =
  /\b([a-z0-9_-]*(?:api[_-]?key|apikey|token|secret|password|passwd)["']?\s*[:=]\s*["']?)[^\s"'&,;}]+/gi;
const EMAIL_RE =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** Returns `value` with credentials and email addresses replaced. */
export const redactString = (value: string): string => {
  if (!value || typeof value !== "string") return value;
  try {
    return value
      .replace(URL_USERINFO_RE, (_m, scheme: string) => `${scheme}${REDACTED}@`)
      .replace(JWT_RE, REDACTED)
      .replace(BEARER_RE, (_m, scheme: string) => `${scheme} ${REDACTED}`)
      .replace(BASIC_RE, (_m, scheme: string) => `${scheme} ${REDACTED}`)
      .replace(PREFIXED_KEY_RE, REDACTED)
      .replace(QUERY_PARAM_RE, (_m, name: string) => `${name}${REDACTED}`)
      .replace(ASSIGNMENT_RE, (_m, name: string) => `${name}${REDACTED}`)
      .replace(EMAIL_RE, REDACTED_EMAIL);
  } catch {
    return REDACTED;
  }
};
