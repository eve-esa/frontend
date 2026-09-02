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
 * Bring-your-own-key: the "Manage custom models" button and its dialog, which let a user
 * register an external provider with their own API key.
 */
export const CUSTOM_MODELS_ENABLED = isEnabled("FEATURE_CUSTOM_MODELS", true);

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
 * The Artifacts page and its sidebar entry. Off removes the `/artifacts` route, so a deep link
 * falls through to Not found; artifact links inside old messages go through the API rather than
 * the SPA route and keep working.
 */
export const ARTIFACTS_ENABLED = isEnabled("FEATURE_ARTIFACTS", false);

/**
 * MCP toolkits: the sidebar entry, its panel, and the selection that routes a message to the
 * agentic endpoint. Off, the stored selection is ignored rather than deleted, so flipping the
 * flag back restores the user's choice.
 */
export const TOOLKITS_ENABLED = isEnabled("FEATURE_TOOLKITS", false);

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
