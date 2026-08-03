import {
  LOCAL_STORAGE_PRIVATE_COLLECTIONS,
  LOCAL_STORAGE_PUBLIC_COLLECTIONS,
} from "./localStorage";

type CollectionRef = {
  id: string;
  name: string;
};

export function getEnabledCollectionIds(storageKey: string): string[] {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function toggleCollectionInStorage(
  storageKey: string,
  currentIds: string[],
  collectionId: string,
): string[] {
  const newIds = currentIds.includes(collectionId)
    ? currentIds.filter((id) => id !== collectionId)
    : [...currentIds, collectionId];

  localStorage.setItem(storageKey, JSON.stringify(newIds));
  return newIds;
}

export function migrateCollectionStorage(
  storageKey: string,
  storedValue: string | null,
  allCollections: CollectionRef[],
): void {
  if (!allCollections.length) return;

  if (!storedValue) {
    localStorage.setItem(
      storageKey,
      JSON.stringify(allCollections.map((collection) => collection.id)),
    );
    return;
  }

  try {
    const parsed = JSON.parse(storedValue) as string[];
    const containsId = parsed.some((value) =>
      allCollections.some((collection) => collection.id === value),
    );
    const containsName = parsed.some((value) =>
      allCollections.some((collection) => collection.name === value),
    );

    if (!containsId && containsName) {
      const nameToId = new Map(
        allCollections.map((collection) => [collection.name, collection.id] as const),
      );
      const migrated = parsed
        .map((name) => nameToId.get(name))
        .filter((id): id is string => Boolean(id));
      localStorage.setItem(storageKey, JSON.stringify(migrated));
    }
  } catch {
    localStorage.setItem(
      storageKey,
      JSON.stringify(allCollections.map((collection) => collection.id)),
    );
  }
}

export function getMessageCollectionPayload() {
  return {
    public_collections: getEnabledCollectionIds(LOCAL_STORAGE_PUBLIC_COLLECTIONS),
    private_collections: getEnabledCollectionIds(LOCAL_STORAGE_PRIVATE_COLLECTIONS),
  };
}
