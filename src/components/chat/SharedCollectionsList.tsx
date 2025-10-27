import { Skeleton } from "@/components/ui/Skeleton";
import useInfinityLoading from "@/hooks/useInfinityLoading";
import type { SharedCollectionType } from "@/services/useGetSharedCollection";
import { Switch } from "@/components/ui/Switch";
import { useState } from "react";
import { LOCAL_STORAGE_PUBLIC_COLLECTIONS } from "@/utilities/localStorage";

type CollectionsListProps = {
  loading: boolean;
  collectionsList: SharedCollectionType[];
  fetchNextPage: () => void;
  hasNextPage: boolean;
};

export const SharedCollectionsList = ({
  loading,
  collectionsList,
  fetchNextPage,
  hasNextPage,
}: CollectionsListProps) => {
  const [collectionsEndRef] = useInfinityLoading({
    fetchFunction: fetchNextPage,
    dependencies: [hasNextPage],
  });

  const storedCollections = localStorage.getItem(
    LOCAL_STORAGE_PUBLIC_COLLECTIONS
  );

  const [enabledPublicCollections, setEnabledPublicCollections] = useState<
    string[]
  >(storedCollections ? JSON.parse(storedCollections) : []);

  const toggleCollection = (collectionId: string) => {
    setEnabledPublicCollections((prev) => {
      const isCurrentlyEnabled = prev.includes(collectionId);
      const newEnabledCollections = isCurrentlyEnabled
        ? prev.filter((id) => id !== collectionId)
        : [...prev, collectionId];

      localStorage.setItem(
        LOCAL_STORAGE_PUBLIC_COLLECTIONS,
        JSON.stringify(newEnabledCollections)
      );

      return newEnabledCollections;
    });
  };

  return (
    <>
      {loading ? (
        <div className="flex flex-col gap-8">
          <Skeleton className="w-full h-6" />
          <Skeleton className="w-full h-6" />
          <Skeleton className="w-full h-6" />
          <Skeleton className="w-full h-6" />
        </div>
      ) : (
        <div className="flex flex-col gap-8 pr-2">
          {collectionsList?.map((collection) => (
            <div className="flex flex-col gap-4" key={collection.id}>
              <div className="flex items-center gap-2">
                <Switch
                  checked={enabledPublicCollections.includes(collection.id)}
                  onCheckedChange={() => toggleCollection(collection.id)}
                />
                <span className="leading-none 3xl:text-3xl">
                  {collection.name}
                </span>
              </div>
              <p className="text-xs 3xl:text-xl text-natural-200">
                {collection.description}
              </p>
            </div>
          ))}
          {hasNextPage && <div ref={collectionsEndRef} />}
        </div>
      )}
    </>
  );
};
