import type { AdvancedSettingsValidation } from "./advancedSettingsSchema";
import { CLASSIFICATION_FILTERS_ENABLED } from "./features";
import { LOCAL_STORAGE_SETTINGS } from "./localStorage";

// Frontend defaults are the source of truth for the chat (k=10,
// score_threshold=0.6); the backend DEFAULT_K / DEFAULT_SCORE_THRESHOLD only
// apply when a client omits the fields.
export const MAX_K = 10;
export const DEFAULT_SCORE_THRESHOLD = 0.6;

export const messageDefaultSettings: AdvancedSettingsValidation = {
  score_threshold: DEFAULT_SCORE_THRESHOLD,
  temperature: 0.0645,
  year: {
    startYear: undefined,
    endYear: undefined,
  },
  journal: undefined,
  thematic_perspective: undefined,
  scientific_and_technical: undefined,
  market_perspective: undefined,
  n_citations: 0,
  k: MAX_K,
};

const clampNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const toOptionalYear = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const normalizeYear = (
  value: unknown,
): AdvancedSettingsValidation["year"] => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as { startYear?: unknown; endYear?: unknown };
  const startYear = toOptionalYear(raw.startYear);
  const endYear = toOptionalYear(raw.endYear);
  if (startYear === undefined && endYear === undefined) return undefined;
  return { startYear, endYear };
};

const parseStoredSettings = (): Record<string, unknown> => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SETTINGS);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

/**
 * Settings as the user set them, merged over messageDefaultSettings so every
 * key is present, with numeric fields clamped to the ranges the UI allows.
 * Tolerates missing or corrupt localStorage content.
 *
 * The one place the three classification perspectives are dropped when the flag
 * is off. They are not a top-level payload field: helpers.ts turns each set one
 * into a filters.must[] entry, so undefined here is what keeps them out of both
 * the classic and the agentic request. A value left in localStorage from before
 * the flag flipped is cleaned up by ChatLayout, which re-serialises this on
 * mount.
 */
export const readStoredSettings = (): AdvancedSettingsValidation => {
  const stored = parseStoredSettings();
  const merged = { ...messageDefaultSettings, ...stored } as Record<
    string,
    unknown
  >;

  const classification = CLASSIFICATION_FILTERS_ENABLED
    ? {}
    : {
        thematic_perspective: undefined,
        scientific_and_technical: undefined,
        market_perspective: undefined,
      };

  return {
    ...(merged as AdvancedSettingsValidation),
    score_threshold: clampNumber(
      merged.score_threshold,
      0,
      1,
      messageDefaultSettings.score_threshold,
    ),
    temperature: clampNumber(
      merged.temperature,
      0,
      1,
      messageDefaultSettings.temperature,
    ),
    k: Math.round(
      clampNumber(merged.k, 0, MAX_K, messageDefaultSettings.k ?? MAX_K),
    ),
    year: normalizeYear(merged.year),
    ...classification,
  };
};
