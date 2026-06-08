type StoredStringArrayListener = () => void;

const EMPTY_STRING_ARRAY: string[] = [];

const listeners = new Map<string, Set<StoredStringArrayListener>>();

const notifyStoredStringArrayListeners = (key: string) => {
  listeners.get(key)?.forEach((listener) => listener());
};

export const parseStoredStringArray = (raw: string | null): string[] => {
  if (!raw) return EMPTY_STRING_ARRAY;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_STRING_ARRAY;

    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return EMPTY_STRING_ARRAY;
  }
};

export const getStoredStringArrayRaw = (key: string): string =>
  localStorage.getItem(key) ?? "";

export const getStoredStringArray = (key: string): string[] =>
  parseStoredStringArray(localStorage.getItem(key));

export const setStoredStringArray = (key: string, values: string[]): void => {
  localStorage.setItem(key, JSON.stringify(values));
  notifyStoredStringArrayListeners(key);
};

export const ensureStoredStringArray = (
  key: string,
  defaultValues: string[],
): void => {
  const raw = localStorage.getItem(key);

  if (!raw) {
    setStoredStringArray(key, defaultValues);
    return;
  }

  try {
    JSON.parse(raw);
  } catch {
    setStoredStringArray(key, defaultValues);
  }
};

export const subscribeStoredStringArray = (
  key: string,
  listener: StoredStringArrayListener,
): (() => void) => {
  const keyListeners =
    listeners.get(key) ?? new Set<StoredStringArrayListener>();
  keyListeners.add(listener);
  listeners.set(key, keyListeners);

  return () => {
    keyListeners.delete(listener);
    if (keyListeners.size === 0) {
      listeners.delete(key);
    }
  };
};

export const arraysEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

export const updateStoredStringArray = (
  key: string,
  updater: (current: string[]) => string[],
): void => {
  const current = getStoredStringArray(key);
  const next = updater(current);

  if (arraysEqual(current, next)) return;

  setStoredStringArray(key, next);
};
