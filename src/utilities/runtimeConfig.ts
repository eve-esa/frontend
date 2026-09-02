/**
 * Configuration read at run time, not baked into the build.
 *
 * The release pipeline builds one artifact and promotes it unchanged: the tarball
 * `promote-staging` produces is the one `promote-prod` republishes, byte for byte. That is the
 * property worth defending — what was tested is what ships — and it means a value that must
 * differ between staging and production cannot be a build-time constant, because there is only
 * one build.
 *
 * So config arrives at the release stage instead, as `window.__EVE_CONFIG__` injected into
 * `index.html` immediately before the upload (`.github/actions/inject-runtime-config`). The
 * script tag is a classic one, so it executes before the deferred module bundle and these reads
 * work at module scope, which is what every consumer needs. A fetched `/config.json` could not:
 * it is asynchronous, and CloudFront rewrites `.json` into `/releases/<sha>/`, which would make
 * it per-release rather than per-environment.
 *
 * **This trades away dead-code elimination.** A build-time flag folds to a literal and Rollup
 * deletes the branch; a runtime flag cannot, so guarded code ships everywhere. That is an
 * acceptable price for the switches here, none of which hide anything sensitive, and it is the
 * price of a kill switch being operable without a rebuild. It would not be acceptable for a
 * feature that must leave no trace in the shipped JavaScript — put that behind the backend.
 */

/**
 * Not OpenFeature, deliberately, but shaped so that becoming OpenFeature is a small step.
 *
 * The CNCF standard describes this exact starting point — evaluation from static environment
 * variables — and a graduation path to a file, a REST API or a vendor provider as a project
 * matures. Five booleans in a pilot do not earn an SDK and a provider yet. `isEnabled(key,
 * default)` mirrors `getBooleanValue(flagKey, defaultValue)` so the day one of these is needed,
 * only this file changes: flipping a flag without a deploy, per-user or percentage targeting,
 * or an audit trail of who changed what.
 *
 * One thing to know before that day: OpenFeature's web SDK initialises its provider
 * asynchronously, so adopting it forces the module-scope reads below into React state. That is
 * the same constraint that ruled out fetching a `/config.json`, and it is the real cost of the
 * migration — not the dependency.
 */
export type ConfigKey =
  | "FEATURE_MODEL_PICKER"
  | "FEATURE_CUSTOM_MODELS"
  | "FEATURE_STREAMING"
  | "FEATURE_CLASSIFICATION_FILTERS"
  // Opening-scope switches. Same shape as the four above, opposite default:
  // off unless an environment opts in (see features.ts for why).
  | "FEATURE_ARTIFACTS"
  | "FEATURE_TOOLKITS"
  | "FEATURE_PRIVATE_COLLECTIONS"
  | "FEATURE_ATTACHMENTS"
  | "FEATURE_ANSWERED_BY"
  | "FEATURE_BETA_BADGE"
  | "FEATURE_WELCOME_DIALOG"
  // Not switches. They are here because they are per-environment values that a
  // promoted artifact cannot carry, which is the same problem the flags have.
  // They were build-time only, set on deploy-dev and on nothing else, so
  // `window.open(undefined)` opened about:blank on staging and production —
  // on the exact path the "one artifact, promoted unchanged" argument runs
  // through, since promote-prod republishes staging's tarball byte for byte.
  | "CONTACT_URL"
  | "PRIVACY_POLICY_URL"
  | "ABOUT_US_URL"
  // The OIDC provider coordinates. Per-environment by nature (each environment
  // has its own issuer and app client), so they follow the same route as the
  // URLs above: injected at the release stage, VITE_ fallback for local dev.
  // Public values, not secrets: the client is a public OIDC client and both
  // appear in every authorization redirect.
  | "AUTH_ISSUER"
  | "AUTH_CLIENT_ID"
  | "AUTH_SCOPE";

declare global {
  interface Window {
    __EVE_CONFIG__?: Partial<Record<ConfigKey, string>>;
  }
}

/**
 * Build-time values, kept as the fallback for local development, where nothing injects.
 *
 * Spelled out one key at a time on purpose: Vite substitutes `import.meta.env.VITE_X` only when
 * the property is named literally, so a computed ``import.meta.env[`VITE_${key}`]`` would read
 * as undefined in a build and the fallback would silently vanish.
 */
const BUILD_TIME: Record<ConfigKey, string | undefined> = {
  FEATURE_MODEL_PICKER: import.meta.env.VITE_FEATURE_MODEL_PICKER,
  FEATURE_CUSTOM_MODELS: import.meta.env.VITE_FEATURE_CUSTOM_MODELS,
  FEATURE_STREAMING: import.meta.env.VITE_FEATURE_STREAMING,
  FEATURE_CLASSIFICATION_FILTERS:
    import.meta.env.VITE_FEATURE_CLASSIFICATION_FILTERS,
  FEATURE_ARTIFACTS: import.meta.env.VITE_FEATURE_ARTIFACTS,
  FEATURE_TOOLKITS: import.meta.env.VITE_FEATURE_TOOLKITS,
  FEATURE_PRIVATE_COLLECTIONS: import.meta.env
    .VITE_FEATURE_PRIVATE_COLLECTIONS,
  FEATURE_ATTACHMENTS: import.meta.env.VITE_FEATURE_ATTACHMENTS,
  FEATURE_ANSWERED_BY: import.meta.env.VITE_FEATURE_ANSWERED_BY,
  FEATURE_BETA_BADGE: import.meta.env.VITE_FEATURE_BETA_BADGE,
  FEATURE_WELCOME_DIALOG: import.meta.env.VITE_FEATURE_WELCOME_DIALOG,
  CONTACT_URL: import.meta.env.VITE_CONTACT_URL,
  PRIVACY_POLICY_URL: import.meta.env.VITE_PRIVACY_POLICY_URL,
  ABOUT_US_URL: import.meta.env.VITE_ABOUT_US_URL,
  AUTH_ISSUER: import.meta.env.VITE_AUTH_ISSUER,
  AUTH_CLIENT_ID: import.meta.env.VITE_AUTH_CLIENT_ID,
  AUTH_SCOPE: import.meta.env.VITE_AUTH_SCOPE,
};

const injected = (): Partial<Record<ConfigKey, string>> =>
  (typeof window !== "undefined" && window.__EVE_CONFIG__) || {};

/**
 * Whether a switch is on.
 *
 * Blank counts as absent, so `defaultOn` still applies. That matters because an undefined
 * GitHub Actions `${{ vars.X }}` expands to the empty string rather than to nothing: the value
 * arrives set and empty, and treating it as "off" is how a feature disappears from every
 * environment without anyone deciding it should. For the opening-scope flags the same rule
 * points the other way: their default is off, so an unset variable hides the feature.
 */
export const isEnabled = (key: ConfigKey, defaultOn: boolean): boolean => {
  const raw = (injected()[key] ?? BUILD_TIME[key] ?? "").trim().toLowerCase();
  if (!raw) {
    return defaultOn;
  }
  return raw === "true";
};

/**
 * A configured value, or undefined when there is none. Same resolution order as `isEnabled`
 * and the same treatment of blank as absent.
 *
 * Undefined rather than an empty string, so a caller has to decide what to do about a missing
 * value. Passing "" to `window.open` reopens the current page and passing undefined opens
 * about:blank; neither is a link, and both used to happen silently.
 */
export const configValue = (key: ConfigKey): string | undefined =>
  (injected()[key] ?? BUILD_TIME[key] ?? "").trim() || undefined;
