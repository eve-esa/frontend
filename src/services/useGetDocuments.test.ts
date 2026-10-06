import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import api from "./axios";
import { documentsQueryOptions } from "./useGetDocuments";
import { TOUR_COLLECTION_ID } from "@/components/onboarding/tourCollection";

vi.mock("./axios", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { data: [], meta: {} } })),
  },
}));

/**
 * The onboarding tour shows a placeholder collection whose id is not an
 * ObjectId: asking the API for its documents answers 404.
 */
const observe = (collectionId: string, enabled?: boolean) => {
  const observer = new InfiniteQueryObserver(
    new QueryClient(),
    documentsQueryOptions({ collectionId, enabled })
  );
  const unsubscribe = observer.subscribe(() => undefined);
  return unsubscribe;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("documentsQueryOptions", () => {
  afterEach(() => vi.mocked(api.get).mockClear());

  it("never fetches the tour placeholder collection", async () => {
    const unsubscribe = observe(TOUR_COLLECTION_ID, true);
    await flush();
    unsubscribe();

    expect(api.get).not.toHaveBeenCalled();
  });

  it("fetches the documents of a real collection", async () => {
    const unsubscribe = observe("6ac2547f87bfef7ac2cc1a60");
    await flush();
    unsubscribe();

    expect(api.get).toHaveBeenCalledWith(
      "/collections/6ac2547f87bfef7ac2cc1a60/documents?limit=20&page=1"
    );
  });

  it("stays off when the caller disables it", async () => {
    const unsubscribe = observe("6ac2547f87bfef7ac2cc1a60", false);
    await flush();
    unsubscribe();

    expect(api.get).not.toHaveBeenCalled();
  });
});
