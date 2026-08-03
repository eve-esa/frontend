import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  getStoredStringArrayRaw,
  parseStoredStringArray,
  subscribeStoredStringArray,
  updateStoredStringArray,
} from "@/utilities/storedStringArray";

export const useStoredSelection = (storageKey: string) => {
  const storedRaw = useSyncExternalStore(
    (onStoreChange) => subscribeStoredStringArray(storageKey, onStoreChange),
    () => getStoredStringArrayRaw(storageKey),
    () => "",
  );

  const selected = useMemo(
    () => parseStoredStringArray(storedRaw || null),
    [storedRaw],
  );

  const setSelected = useCallback(
    (value: string, included: boolean) => {
      updateStoredStringArray(storageKey, (current) => {
        const isIncluded = current.includes(value);
        if (included === isIncluded) return current;

        return included
          ? [...current, value]
          : current.filter((item) => item !== value);
      });
    },
    [storageKey],
  );

  const isSelected = useCallback(
    (value: string) => selected.includes(value),
    [selected],
  );

  return { selected, setSelected, isSelected };
};
