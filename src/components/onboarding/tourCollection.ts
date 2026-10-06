import type { CollectionType } from "@/services/useGetMyCollections";

/**
 * The onboarding tour shows a placeholder collection that exists only in the
 * browser. Its id is not an ObjectId, so the API must never see it.
 */
export const TOUR_COLLECTION_ID = "tour_collection";

export const isTourCollection = (collectionId: string) =>
  collectionId === TOUR_COLLECTION_ID;

export const tourCollection = (): CollectionType => ({
  id: TOUR_COLLECTION_ID,
  name: "Your own collection",
  timestamp: Date.now().toString(),
  user_id: "tour_user",
});
