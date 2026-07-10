import { LOCAL_STORAGE_MODEL_SELECTION } from "@/utilities/localStorage";
import type { ModelListResponse, ModelSelection, PlatformModel } from "@/types";

export const DEFAULT_MODEL_SELECTION: ModelSelection = {
  type: "platform",
  id: "eve-instruct",
};

export function parseModelSelection(raw: string | null): ModelSelection {
  if (!raw) return DEFAULT_MODEL_SELECTION;
  try {
    const parsed = JSON.parse(raw) as ModelSelection;
    if (
      (parsed.type === "platform" || parsed.type === "custom") &&
      typeof parsed.id === "string" &&
      parsed.id.length > 0
    ) {
      return parsed;
    }
  } catch {
    // Legacy llm_type string in localStorage
    if (raw === "main") {
      return DEFAULT_MODEL_SELECTION;
    }
    if (raw === "fallback") {
      return { type: "platform", id: "mistral-small-latest" };
    }
  }
  return DEFAULT_MODEL_SELECTION;
}

export function getStoredModelSelection(): ModelSelection {
  return parseModelSelection(localStorage.getItem(LOCAL_STORAGE_MODEL_SELECTION));
}

export function setStoredModelSelection(selection: ModelSelection): void {
  localStorage.setItem(LOCAL_STORAGE_MODEL_SELECTION, JSON.stringify(selection));
}

export function modelSelectionToValue(selection: ModelSelection): string {
  return `${selection.type}:${selection.id}`;
}

export function parseModelSelectionValue(value: string): ModelSelection {
  const [type, ...rest] = value.split(":");
  const id = rest.join(":");
  if ((type === "platform" || type === "custom") && id) {
    return { type, id };
  }
  return DEFAULT_MODEL_SELECTION;
}

export function isModelSelectionAvailable(
  selection: ModelSelection,
  models?: ModelListResponse,
): boolean {
  if (!models) return true;
  if (selection.type === "platform") {
    return models.platform.some((model) => model.id === selection.id);
  }
  return models.custom.some((model) => model.id === selection.id);
}

export function resolvePlatformLlmType(
  platformId: string,
  platformModels: PlatformModel[] = [],
): string {
  return platformModels.find((model) => model.id === platformId)?.llm_type ?? "main";
}

export function modelSelectionToPayload(
  selection: ModelSelection,
  models?: ModelListResponse,
): {
  llm_type?: string;
  custom_model_id?: string;
} {
  if (selection.type === "custom") {
    return { custom_model_id: selection.id };
  }
  return {
    llm_type: resolvePlatformLlmType(selection.id, models?.platform),
  };
}

export function reconcileModelSelection(
  selection: ModelSelection,
  models?: ModelListResponse,
): ModelSelection {
  if (!models || isModelSelectionAvailable(selection, models)) {
    return selection;
  }
  return DEFAULT_MODEL_SELECTION;
}
