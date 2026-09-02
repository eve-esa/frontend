import type { AdvancedSettingsValidation } from "./advancedSettingsSchema";
import { CLASSIFICATION_FILTERS_ENABLED } from "./features";
import { filters } from "./filters";
import type { ApiError } from "@/types";

export const normalizeDate = (date: Date): Date => {
  // This ensures the date won't cross day boundaries when converted to UTC
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
    0,
    0,
    0,
  );
};

export const adaptSettingsForRequest = (
  settings: AdvancedSettingsValidation,
) => {
  const {
    year,
    thematic_perspective,
    journal,
    n_citations,
    scientific_and_technical,
    market_perspective,
    ...restSettings
  } = settings;

  // Create filters array from configuration
  const filtersArray = [];

  // Year filter (range)
  if (year?.startYear || year?.endYear) {
    filtersArray.push({
      ...filters.year,
      range: {
        ...filters.year.range,
        gte: year?.startYear ? Number(year.startYear) : null,
        lte: year?.endYear ? Number(year.endYear) : null,
      },
    });
  }

  // Journal filter (match)
  if (journal) {
    filtersArray.push({
      ...filters.journal,
      match: {
        ...filters.journal.match,
        value: journal,
      },
    });
  }

  // The three classification perspectives, behind one flag. This is where they
  // are withheld rather than in readStoredSettings: it is the only boundary
  // they cross on the way out, for the classic and the agentic pipeline alike,
  // and the stored values survive here for a later flip.
  if (CLASSIFICATION_FILTERS_ENABLED) {
    // Thematic perspective filter (match)
    if (thematic_perspective) {
      filtersArray.push({
        ...filters.thematic_perspective,
        match: {
          ...filters.thematic_perspective.match,
          value: thematic_perspective.label,
        },
      });
    }

    // Scientific and technical filter (match)
    if (scientific_and_technical) {
      filtersArray.push({
        ...filters.scientific_and_technical,
        match: {
          ...filters.scientific_and_technical.match,
          value: scientific_and_technical.label,
        },
      });
    }

    // Market perspective filter (match)
    if (market_perspective) {
      filtersArray.push({
        ...filters.market_perspective,
        match: {
          ...filters.market_perspective.match,
          value: market_perspective.label,
        },
      });
    }
  }

  // Min citations filter (range): only when the user asked for a minimum.
  // Sending it for 0 or undefined would exclude every point lacking the
  // n_citations payload field and make the backend skip Wiley retrieval.
  if (typeof n_citations === "number" && Number.isFinite(n_citations) && n_citations > 0) {
    filtersArray.push({
      ...filters.n_citations,
      range: {
        ...filters.n_citations.range,
        gte: n_citations,
      },
    });
  }

  return {
    ...restSettings,
    year: undefined,
    thematic_perspective: undefined,
    journal: undefined,
    scientific_and_technical: undefined,
    market_perspective: undefined,
    n_citations: undefined,
    filters:
      filtersArray.length > 0
        ? {
            should: null,
            min_should: null,
            must: filtersArray,
            must_not: null,
          }
        : undefined,
  };
};

export const handleApiError = (error: ApiError) => {
  if (error?.response?.status === 429) {
    return "You've run out of free credits. Please recharge and try again.";
  }
  const detail = error?.response?.data?.detail;
  const errorMessage = typeof detail === "string" ? detail : detail?.[0]?.msg;
  return errorMessage ?? "Something went wrong!";
};
