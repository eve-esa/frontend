import { useMemo } from "react";
import { useGetSharedCollection } from "./useGetSharedCollection";
import { useGetMyCollections } from "./useGetMyCollections";
import { PRIVATE_COLLECTIONS_ENABLED } from "@/utilities/features";
import {
  buildCollectionCatalog,
  type CollectionCatalog,
} from "@/utilities/agentSteps";

/**
 * Collection labels for the agent steps, from the same queries and cache
 * entries the Knowledge Base panels use (`ChatLayout` already pulls every
 * page). My collections ids count only once the list is complete: a missing
 * page would turn a My collections id into a conversation document.
 */
export const useCollectionCatalog = (): CollectionCatalog => {
  const { data: publicData } = useGetSharedCollection();
  const { data: mineData, hasNextPage } = useGetMyCollections({
    enabled: PRIVATE_COLLECTIONS_ENABLED,
  });
  return useMemo(
    () =>
      buildCollectionCatalog(
        publicData?.pages.flatMap((page) => page.data) ?? [],
        mineData && !hasNextPage
          ? mineData.pages.flatMap((page) => page.data).map((c) => c.id)
          : null,
      ),
    [publicData, mineData, hasNextPage],
  );
};
