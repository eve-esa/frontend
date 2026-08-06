import type { SharedCollectionType } from "@/services/useGetSharedCollection";
import { LOCAL_STORAGE_PUBLIC_COLLECTIONS } from "@/utilities/localStorage";
import { setStoredStringArray } from "@/utilities/storedStringArray";

const parseStoredIds = (raw: string): string[] | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return null;
  }
};

export const initializePublicCollectionsStorage = (
  collections: SharedCollectionType[],
): void => {
  const key = LOCAL_STORAGE_PUBLIC_COLLECTIONS;
  const raw = localStorage.getItem(key);
  const defaultIds = collections.map((collection) => collection.id);

  if (!raw) {
    setStoredStringArray(key, defaultIds);
    return;
  }

  const parsed = parseStoredIds(raw);
  if (!parsed) {
    setStoredStringArray(key, defaultIds);
    return;
  }

  const containsId = parsed.some((value) =>
    collections.some((collection) => collection.id === value),
  );
  const containsName = parsed.some((value) =>
    collections.some((collection) => collection.name === value),
  );

  if (!containsId && containsName) {
    const nameToId = new Map(
      collections.map((collection) => [collection.name, collection.id] as const),
    );
    const migrated = parsed
      .map((name) => nameToId.get(name))
      .filter((id): id is string => Boolean(id));

    setStoredStringArray(key, migrated);
  }
};
