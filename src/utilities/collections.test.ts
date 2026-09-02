import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMemoryLocalStorage } from "@/test-utils/memoryLocalStorage";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import {
  getCompleteCatalog,
  getKnownCollectionsKey,
  reconcileCollectionStorage,
} from "./collections";
import {
  LOCAL_STORAGE_PRIVATE_COLLECTIONS,
  LOCAL_STORAGE_PUBLIC_COLLECTIONS,
} from "./localStorage";
import {
  getStoredStringArray,
  subscribeStoredStringArray,
  updateStoredStringArray,
} from "./storedStringArray";

const toggleOff = (key: string, id: string) =>
  updateStoredStringArray(key, (current) =>
    current.filter((value) => value !== id),
  );

const PUBLIC = LOCAL_STORAGE_PUBLIC_COLLECTIONS;
const PRIVATE = LOCAL_STORAGE_PRIVATE_COLLECTIONS;

// Shape of GET /collections/public: id is the Qdrant collection name, name is
// the alias when one is set, the Qdrant name otherwise.
const CATALOG = [
  { id: "wikipedia-512", name: "Wikipedia EO" },
  { id: "EVE open access", name: "EVE open access" },
];

const seed = (key: string, values: string[]) =>
  localStorage.setItem(key, JSON.stringify(values));

beforeEach(() => {
  installMemoryLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("reconcileCollectionStorage", () => {
  it("maps stored aliases to catalog ids", () => {
    seed(PUBLIC, ["Wikipedia EO", "EVE open access"]);

    reconcileCollectionStorage(PUBLIC, CATALOG);

    expect(getStoredStringArray(PUBLIC)).toEqual([
      "wikipedia-512",
      "EVE open access",
    ]);
  });

  it("drops ids that are no longer in the catalog", () => {
    seed(PUBLIC, ["Wikipedia EO", "EVE open access", "esa-data-qwen-1024"]);

    reconcileCollectionStorage(PUBLIC, CATALOG);

    expect(getStoredStringArray(PUBLIC)).toEqual([
      "wikipedia-512",
      "EVE open access",
    ]);
  });

  it("seeds every catalog id when the key is absent", () => {
    reconcileCollectionStorage(PUBLIC, CATALOG);

    expect(getStoredStringArray(PUBLIC)).toEqual([
      "wikipedia-512",
      "EVE open access",
    ]);
    expect(getStoredStringArray(getKnownCollectionsKey(PUBLIC))).toEqual([
      "wikipedia-512",
      "EVE open access",
    ]);
  });

  it("keeps an empty selection empty", () => {
    seed(PUBLIC, []);

    reconcileCollectionStorage(PUBLIC, CATALOG);

    expect(localStorage.getItem(PUBLIC)).toBe("[]");
  });

  it("enables a new catalog id once and respects a later toggle off", () => {
    seed(PUBLIC, ["wikipedia-512"]);
    reconcileCollectionStorage(PUBLIC, CATALOG);
    expect(getStoredStringArray(PUBLIC)).toEqual(["wikipedia-512"]);

    const grown = [
      ...CATALOG,
      { id: "esa-rag-scraped-qwen3-newpipeline", name: "ESA scraped" },
    ];

    reconcileCollectionStorage(PUBLIC, grown);
    expect(getStoredStringArray(PUBLIC)).toEqual([
      "wikipedia-512",
      "esa-rag-scraped-qwen3-newpipeline",
    ]);

    toggleOff(PUBLIC, "esa-rag-scraped-qwen3-newpipeline");
    expect(getStoredStringArray(PUBLIC)).toEqual(["wikipedia-512"]);

    reconcileCollectionStorage(PUBLIC, grown);
    expect(getStoredStringArray(PUBLIC)).toEqual(["wikipedia-512"]);
  });

  it("does not auto-enable anything when no known list exists yet", () => {
    // First reconcile after this logic ships: the user may have disabled
    // entries on purpose before the companion key existed.
    seed(PUBLIC, ["wikipedia-512"]);

    reconcileCollectionStorage(PUBLIC, CATALOG);

    expect(getStoredStringArray(PUBLIC)).toEqual(["wikipedia-512"]);
  });

  it("leaves the private key untouched when reconciling the public one", () => {
    seed(PUBLIC, ["Wikipedia EO"]);
    seed(PRIVATE, ["my-private-collection"]);

    reconcileCollectionStorage(PUBLIC, CATALOG);

    expect(localStorage.getItem(PRIVATE)).toBe(
      JSON.stringify(["my-private-collection"]),
    );
    expect(localStorage.getItem(getKnownCollectionsKey(PRIVATE))).toBeNull();
  });

  it("requires the complete catalog: a partial page drops ids from later pages", () => {
    // Documents why ChatLayout must not reconcile while hasNextPage is true.
    seed(PUBLIC, ["wikipedia-512", "EVE open access"]);
    const firstPageOnly = [CATALOG[0]];

    reconcileCollectionStorage(PUBLIC, firstPageOnly);

    expect(getStoredStringArray(PUBLIC)).toEqual(["wikipedia-512"]);
  });

  it("does nothing when the catalog is empty", () => {
    seed(PUBLIC, ["Wikipedia EO"]);

    reconcileCollectionStorage(PUBLIC, []);

    expect(localStorage.getItem(PUBLIC)).toBe(JSON.stringify(["Wikipedia EO"]));
    expect(localStorage.getItem(getKnownCollectionsKey(PUBLIC))).toBeNull();
  });

  it("notifies stored array subscribers when it rewrites the selection", () => {
    seed(PUBLIC, ["Wikipedia EO"]);
    const listener = vi.fn();
    const unsubscribe = subscribeStoredStringArray(PUBLIC, listener);

    reconcileCollectionStorage(PUBLIC, CATALOG);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("does not rewrite the selection when nothing changed", () => {
    seed(PUBLIC, ["wikipedia-512", "EVE open access"]);
    reconcileCollectionStorage(PUBLIC, CATALOG);
    const listener = vi.fn();
    const unsubscribe = subscribeStoredStringArray(PUBLIC, listener);

    reconcileCollectionStorage(PUBLIC, CATALOG);

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe("getCompleteCatalog", () => {
  const pages = { pages: [{ data: [CATALOG[0]] }, { data: [CATALOG[1]] }] };

  it("returns null while data is missing or pages remain", () => {
    expect(getCompleteCatalog(undefined, false)).toBeNull();
    expect(getCompleteCatalog(pages, true)).toBeNull();
  });

  it("flattens every page once the last one is fetched", () => {
    expect(getCompleteCatalog(pages, false)).toEqual(CATALOG);
  });
});

// The payload is the one function here that reads a flag, and it reads it at
// module scope, so each case loads the module against an explicit config.
const loadPayload = async (privateCollections: "true" | "false") => {
  stubRuntimeConfig({ FEATURE_PRIVATE_COLLECTIONS: privateCollections });
  const { getMessageCollectionPayload } = await import("./collections");
  return getMessageCollectionPayload;
};

describe("getMessageCollectionPayload", () => {
  it("sends only the enabled ids after a toggle", async () => {
    reconcileCollectionStorage(PUBLIC, CATALOG);
    seed(PRIVATE, ["mine"]);

    toggleOff(PUBLIC, "EVE open access");

    const getMessageCollectionPayload = await loadPayload("true");

    expect(getMessageCollectionPayload()).toEqual({
      public_collections: ["wikipedia-512"],
      private_collections: ["mine"],
    });
  });

  it("sends an empty list, not a missing field, when everything is off", async () => {
    seed(PUBLIC, []);

    const getMessageCollectionPayload = await loadPayload("true");

    expect(getMessageCollectionPayload()).toEqual({
      public_collections: [],
      private_collections: [],
    });
  });

  it("sends private_collections: [] when the feature is off, keeping the ids stored", async () => {
    seed(PUBLIC, ["wikipedia-512"]);
    seed(PRIVATE, ["mine"]);

    const getMessageCollectionPayload = await loadPayload("false");

    expect(getMessageCollectionPayload()).toEqual({
      public_collections: ["wikipedia-512"],
      private_collections: [],
    });
    expect(localStorage.getItem(PRIVATE)).toBe(JSON.stringify(["mine"]));
  });
});
