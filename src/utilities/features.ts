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
