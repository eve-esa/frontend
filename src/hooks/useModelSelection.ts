import { useCallback, useEffect, useMemo, useState } from "react";
import { CUSTOM_MODELS_ENABLED } from "@/utilities/features";
import {
  getStoredModelSelection,
  modelSelectionToValue,
  parseModelSelectionValue,
  reconcileModelSelection,
  setStoredModelSelection,
  withoutCustomModels,
} from "@/utilities/modelSelection";
import { useListModels } from "@/services/useListModels";

/**
 * Fired on `window` when the model is chosen outside the composer (the header field on a phone),
 * so a composer still mounted next to it follows. The choice itself lives in local storage, which
 * is what a send reads.
 */
export const MODEL_SELECTION_EVENT = "eve:model-selection-changed";

/**
 * The model the next message goes to, and the list to choose from. Same rules as the composer's
 * picker: custom models are listed only where they are enabled, and a stored choice that is no
 * longer offered falls back to the default.
 */
export const useModelSelection = () => {
  const { data: listedModels } = useListModels();
  const models = useMemo(
    () =>
      CUSTOM_MODELS_ENABLED ? listedModels : withoutCustomModels(listedModels),
    [listedModels],
  );
  const [value, setValue] = useState<string>(() =>
    modelSelectionToValue(getStoredModelSelection()),
  );

  useEffect(() => {
    if (!models) return;
    const stored = getStoredModelSelection(models);
    const reconciled = reconcileModelSelection(stored, models);
    if (reconciled.type !== stored.type || reconciled.id !== stored.id) {
      setStoredModelSelection(reconciled);
    }
    setValue(modelSelectionToValue(reconciled));
  }, [models]);

  useEffect(() => {
    const onChange = () =>
      setValue(modelSelectionToValue(getStoredModelSelection()));
    window.addEventListener(MODEL_SELECTION_EVENT, onChange);
    return () => window.removeEventListener(MODEL_SELECTION_EVENT, onChange);
  }, []);

  const select = useCallback((next: string) => {
    if (!next) return;
    setValue(next);
    setStoredModelSelection(parseModelSelectionValue(next));
    window.dispatchEvent(new Event(MODEL_SELECTION_EVENT));
  }, []);

  const currentName = useMemo(() => {
    const [type, ...rest] = value.split(":");
    const id = rest.join(":");
    const list = type === "custom" ? models?.custom : models?.platform;
    return list?.find((model) => model.id === id)?.display_name ?? null;
  }, [models, value]);

  return { models, value, select, currentName };
};
