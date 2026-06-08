import { Skeleton } from "@/components/ui/Skeleton";
import useInfinityLoading from "@/hooks/useInfinityLoading";
import type { SharedCollectionType } from "@/services/useGetSharedCollection";
import { Switch } from "@/components/ui/Switch";
import { useStoredSelection } from "@/hooks/useStoredSelection";
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
  const { isSelected, setSelected } = useStoredSelection(
    LOCAL_STORAGE_PUBLIC_COLLECTIONS,
  );

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
                  checked={isSelected(collection.id)}
                  onCheckedChange={(checked) =>
                    setSelected(collection.id, checked)
                  }
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
