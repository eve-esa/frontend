import { PRIVATE_COLLECTIONS_ENABLED } from "./features";
import {
  LOCAL_STORAGE_PRIVATE_COLLECTIONS,
  LOCAL_STORAGE_PUBLIC_COLLECTIONS,
} from "./localStorage";
import {
  arraysEqual,
  getStoredStringArray,
  parseStoredStringArray,
  setStoredStringArray,
} from "./storedStringArray";

type CollectionRef = {
  id: string;
  name: string;
};

export function getEnabledCollectionIds(storageKey: string): string[] {
  return getStoredStringArray(storageKey);
}

type PagedCollections<T> = { pages: { data: T[] }[] } | undefined;

/**
 * Flatten an infinite query result into a catalog, but only once every page
 * has been fetched. reconcileCollectionStorage drops every stored id that is
 * not in the catalog it receives, so handing it a partial catalog would
 * silently disable collections that live on pages not loaded yet. Returns
 * null while the catalog is still incomplete.
 */
export function getCompleteCatalog<T extends CollectionRef>(
  data: PagedCollections<T>,
  hasNextPage: boolean,
): T[] | null {
  if (!data || hasNextPage) return null;
  return data.pages.flatMap((page) => page.data);
}

/**
 * Companion key holding the catalog ids seen at the last reconcile, so a
 * collection that appears in the catalog later can be enabled exactly once.
 */
export const getKnownCollectionsKey = (storageKey: string): string =>
  `${storageKey}_known`;

/**
 * Bring the stored selection under `storageKey` in line with the current
 * catalog:
 * - every stored value is mapped to a catalog id (ids pass through, names or
 *   aliases are resolved to their id) and anything unknown is dropped;
 * - a missing key means the user never chose anything, so every catalog id
 *   is enabled; an empty array is kept as is, the user disabled everything;
 * - ids that entered the catalog since the last reconcile are enabled once.
 *   The `${storageKey}_known` companion key records what was seen, so a later
 *   explicit toggle off is not undone on the next reconcile.
 *
 * Writes go through setStoredStringArray so useStoredSelection subscribers
 * rerender. An empty catalog is ignored (nothing to reconcile against).
 */
export function reconcileCollectionStorage(
  storageKey: string,
  catalog: CollectionRef[],
): void {
  if (!catalog.length) return;

  const knownKey = getKnownCollectionsKey(storageKey);
  const catalogIds = catalog.map((collection) => collection.id);
  const idSet = new Set(catalogIds);
  const nameToId = new Map(
    catalog.map((collection) => [collection.name, collection.id] as const),
  );

  const raw = localStorage.getItem(storageKey);
  const knownRaw = localStorage.getItem(knownKey);

  let next: string[];
  if (raw === null) {
    next = [...catalogIds];
  } else {
    let stored: string[] | null = null;
    try {
      stored = Array.isArray(JSON.parse(raw)) ? parseStoredStringArray(raw) : null;
    } catch {
      stored = null;
    }

    if (stored === null) {
      // Corrupted value: same treatment as a missing key.
      next = [...catalogIds];
    } else {
      const mapped = stored
        .map((value) => (idSet.has(value) ? value : nameToId.get(value)))
        .filter((id): id is string => Boolean(id));
      next = Array.from(new Set(mapped));

      // Only ids that appeared since the last reconcile count as new. With no
      // record yet, the current catalog is the baseline: re-enabling
      // everything would undo choices the user made before the key existed.
      if (knownRaw !== null) {
        const known = new Set(parseStoredStringArray(knownRaw));
        const enabled = new Set(next);
        for (const id of catalogIds) {
          if (!known.has(id) && !enabled.has(id)) {
            next.push(id);
            enabled.add(id);
          }
        }
      }
    }
  }

  if (!arraysEqual(getStoredStringArray(storageKey), next)) {
    setStoredStringArray(storageKey, next);
  }

  if (!arraysEqual(parseStoredStringArray(knownRaw), catalogIds)) {
    setStoredStringArray(knownKey, catalogIds);
  }
}

export function getMessageCollectionPayload() {
  return {
    public_collections: getEnabledCollectionIds(LOCAL_STORAGE_PUBLIC_COLLECTIONS),
    // Empty rather than absent when the feature is off: the stored ids survive
    // for a later flip, they simply do not reach the backend.
    private_collections: PRIVATE_COLLECTIONS_ENABLED
      ? getEnabledCollectionIds(LOCAL_STORAGE_PRIVATE_COLLECTIONS)
      : [],
  };
}
