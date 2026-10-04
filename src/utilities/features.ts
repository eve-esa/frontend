/**
 * Feature flags.
 *
 * One rule: a flag names the feature it controls, never the environment it happens to be on.
 * The predecessor of this file was `VITE_IS_STAGING`, a single environment-named flag that gated
 * three unrelated things (the model picker, custom models, and self-signup). Nobody could tell
 * from the name what turning it on would do, and because nothing set it, all three disappeared
 * from every environment without anyone deciding they should.
 *
 * **A flag exists to turn a feature off, and defaults to on.**
 *
 * **Exception: the opening-scope flags are hidden unless an environment opts in.** The six flags
 * at the bottom of this file default to off, because the opening ships a deliberately narrow
 * product and the environments that keep a feature are the exception, not the rule. Fail closed:
 * an unset variable on staging or production hides the feature rather than exposing it. The cost
 * is that local development needs the six `VITE_FEATURE_*` set to `true` (see `.env.example` and
 * the frontend service in the root `docker-compose.yml`), otherwise `yarn dev` and compose lose
 * all six.
 *
 * Values arrive at the release stage rather than the build, so a switch can differ between
 * staging and production and can be flipped without rebuilding — see `runtimeConfig.ts` for why
 * the artifact cannot carry them, and for what that costs.
 */

import { isEnabled } from "./runtimeConfig";

/** The per-message model selector, listing platform and custom models. */
export const MODEL_PICKER_ENABLED = isEnabled("FEATURE_MODEL_PICKER", true);


/**
 * Token-by-token rendering over SSE. Off falls back to the blocking request, which answers only
 * once the whole message is ready.
 */
export const STREAMING_ENABLED = isEnabled("FEATURE_STREAMING", true);

/** The thematic / scientific / market dropdowns in the Control Panel. */
export const CLASSIFICATION_FILTERS_ENABLED = isEnabled(
  "FEATURE_CLASSIFICATION_FILTERS",
  true
);

/**
 * The "API keys" sidebar entry and its management dialog.
 *
 * Hides the UI only, not access control: any credential (browser session or `eve_` key) can
 * already create, list and revoke keys server side, so turning this off removes the entry
 * point rather than the capability. Off is a UI kill switch; the backend's own kill switch for
 * creation is `API_KEY_MAX_ACTIVE_PER_USER=0`.
 */
export const API_KEYS_ENABLED = isEnabled("FEATURE_API_KEYS", true);

/**
 * The Artifacts page and its sidebar entry. Off removes the `/artifacts` route, so a deep link
 * falls through to Not found; artifact links inside old messages go through the API rather than
 * the SPA route and keep working.
 */
export const ARTIFACTS_ENABLED = isEnabled("FEATURE_ARTIFACTS", false);

/**
 * Agentic chat: new turns go to the agentic pipeline (`stream-generate-agentic`, or
 * `generate-agentic` without streaming), where the model decides which MCP tools to call,
 * retrieval included. Off sends them to the classic pipeline (`stream_messages`, or `messages`),
 * which always searches the knowledge base and runs no tools, and hides Toolkits and custom
 * models with it (`TOOLKITS_ENABLED`, `CUSTOM_MODELS_ENABLED` below). For an environment with no MCP tools, where an agentic turn
 * would answer without sources.
 *
 * Default on, like the original flags: an environment opts out. Messages already in a
 * conversation keep rendering their sources and trace either way.
 */
export const AGENTIC_CHAT_ENABLED = isEnabled("FEATURE_AGENTIC_CHAT", true);

/**
 * MCP toolkits: the sidebar entry, its panel, and the user's choice of servers. Off, only the
 * default (eve_retrieval) is sent and the stored selection is ignored rather than deleted, so
 * flipping the flag back restores the user's choice. Always off with agentic chat off: the
 * classic pipeline runs no tools, so a toolkit choice would do nothing.
 */
export const TOOLKITS_ENABLED =
  AGENTIC_CHAT_ENABLED && isEnabled("FEATURE_TOOLKITS", false);

/**
 * Bring-your-own-key: the "Manage custom models" button and its dialog, which let a user
 * register an external provider with their own API key, and the custom entries in the model
 * picker. Always off with agentic chat off: the classic pipeline cannot answer with a custom
 * model, so offering one would silently answer with the default model instead.
 */
export const CUSTOM_MODELS_ENABLED =
  AGENTIC_CHAT_ENABLED && isEnabled("FEATURE_CUSTOM_MODELS", true);

/**
 * Personal document collections: the "My collections" menu item and panel, the `/collections`
 * query, the private ids on the message payload, and the five tour steps that walk through them.
 */
export const PRIVATE_COLLECTIONS_ENABLED = isEnabled(
  "FEATURE_PRIVATE_COLLECTIONS",
  false
);

/**
 * Attaching files to a message: the attach button, the file input, drag and drop, and pasting an
 * image. Off hides only the ways in; attachments already on a message keep rendering.
 */
export const ATTACHMENTS_ENABLED = isEnabled("FEATURE_ATTACHMENTS", false);

/**
 * The "Answered by" line under an answer, naming the model that produced it.
 *
 * A diagnostic, so blank must not turn it on: an undefined GitHub Actions variable arrives as
 * the empty string, and `isEnabled` reads blank as absent, which for this flag means off.
 */
export const ANSWERED_BY_ENABLED = isEnabled("FEATURE_ANSWERED_BY", false);

/** The beta badge next to the logo in the sidebar header. */
export const BETA_BADGE_ENABLED = isEnabled("FEATURE_BETA_BADGE", false);

/**
 * The "Welcome to EVE" dialog shown once per browser on the empty chat screen.
 *
 * Seventh opening-scope flag, same default-off shape as the six above. The dialog is a pilot-era
 * introduction: useful while the audience is the team, noise for anyone arriving at a public
 * opening, and it is the first thing a new user sees before they have typed anything.
 */
export const WELCOME_DIALOG_ENABLED = isEnabled("FEATURE_WELCOME_DIALOG", false);

/**
 * Pre-answer `status` notices streamed while an answer is loading: "Retrieving relevant
 * documents" on the classic path, "Thinking" on the agentic path (`useSendRequest.ts`). The
 * `requery` notice ("Searched for: ...") is never gated by this flag; it always shows.
 *
 * Eighth opening-scope flag, same default-off shape as the six above and the seventh
 * (`WELCOME_DIALOG_ENABLED`): on in development, off in staging and production.
 */
export const STREAM_STATUS_NOTICES_ENABLED = isEnabled(
  "FEATURE_STREAM_STATUS_NOTICES",
  false
);

/**
 * "Report a bug": the entry under each answer, next to Trace, the one in the chat error message and
 * the one on the crash page, and the dialog they open, which sends a description and the
 * telemetry context (session, replay link, trace, conversation and message ids) to
 * `POST /bug-reports`. The context is attached, never shown to the user. There is no
 * app level entry (sidebar, profile menu): a report there would not know its conversation.
 *
 * Default off, like the opening-scope flags: it needs the backend endpoint and is only useful
 * where browser telemetry is on, so an environment opts in once both are there.
 */
export const REPORT_BUG_ENABLED = isEnabled("FEATURE_REPORT_BUG", false);

/**
 * Country and institution in the profile dialog: two optional inputs next to the name fields,
 * prefilled from `GET /users/me` and saved with the same `PATCH /users`. Off, the dialog is
 * unchanged and the update sends only the names, so a backend without the two fields never
 * receives them.
 *
 * Default off: a new capability ships off in production and on where an environment opts in.
 */
export const PROFILE_FIELDS_ENABLED = isEnabled("FEATURE_PROFILE_FIELDS", false);
