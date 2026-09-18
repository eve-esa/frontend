# API keys

Self-service management of `eve_` API keys for programmatic access, from the sidebar.

## Where it lives

Sidebar item "API keys" (key icon, next to Artifacts), gated by the `FEATURE_API_KEYS` flag.
Opens `ApiKeysDialog`, which fetches the key list only once the dialog opens, not on page load.

## List view

- Name, masked token (`eve_…a1b2c3`), created date, "Last used …" or "Never used", expiry
  (or "No expiration" / "Expired"), provenance ("Created via API key eve_…d4e5f6" when the
  key was created by another key), Delete.
- "N of `<limit>` active keys" counter, sourced from the `X-API-Key-Limit` response header
  (falls back to 10). At the limit, Create is disabled and an inline notice explains why.

## Create

- Optional name field.
- Expiry radio: 30 / 90 / 365 days / No expiration, 90 preselected. Matches the backend
  default: an omitted `expires_in_days` also resolves to 90 days server side, so the UI's
  preselection and the API's default agree.
- Errors (409 limit, 429 throttle, 422 validation) show inline (`role="alert"`), not as
  toasts.

## Reveal

The create form says up front that the key will be shown only once. The raw secret is then
shown exactly once, right after create: a read-only input, a copy button, and a highlighted
warning that this is the only time it is shown. Closing the dialog, pressing Escape,
or reopening it never brings the secret back.

Secret hygiene in the implementation: the create mutation uses `gcTime: 0` and its data is
never rendered directly; `onSuccess` copies the key into local view state and the mutation
result is reset immediately after, so no lingering query-cache entry, toast, log line,
storage key or URL ever holds the raw token. The input sits outside any `<form>` with
`autoComplete="off"` and password-manager opt-out attributes.

## Delete

Confirmation step names how many keys created by this one will be revoked too ("N keys
created with it will be deleted too", "Delete N keys"), because revoke cascades server side.
A 404 (already deleted, by this or another session) shows a toast and returns to the list
instead of erroring inline.

## Use your key

Commands only, so the copy button copies something that runs as pasted: an
`export EVE_API_KEY="<your API key>"` line, then `GET /v1/models` and
`POST /v1/chat/completions` against `<origin>/api/v1`, one blank line between commands. The
hint with the OpenAI `base_url` sits above the box and is not copied. The snippet never
contains the real secret. Backend contract: the backend repo's `docs/api/api-keys.md` and
`docs/api/openai-gateway.md`.

## Accessibility

Every view has a `DialogTitle` and `DialogDescription`. Escape returns to the list from any
sub-view instead of closing the dialog outright (except from the list itself, where it
closes). Focus moves to a view-appropriate control on entry (the Create button on the list,
the Cancel button on the delete confirmation) and returns to the triggering sidebar item on
close.

## Feature flag

`FEATURE_API_KEYS` (`VITE_FEATURE_API_KEYS` at build time), code default **on**
(`isEnabled("FEATURE_API_KEYS", true)`). See [FEATURE-FLAGS.md](../../../docs/FEATURE-FLAGS.md)
for the full flag table and per-environment overrides. `false` hides the sidebar item
entirely and the dialog never fetches `/users/api-keys`.
