import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import type { CollectionType } from "@/services/useGetMyCollections";
import useInfinityLoading from "@/hooks/useInfinityLoading";
import { useStoredSelection } from "@/hooks/useStoredSelection";
import { LOCAL_STORAGE_PRIVATE_COLLECTIONS } from "@/utilities/localStorage";

type CollectionsListProps = {
  onSelectCollection: (collection: CollectionType) => void;
  loading: boolean;
  collectionsList: CollectionType[];
  fetchNextPage: () => void;
  hasNextPage: boolean;
};

export const CollectionsList = ({
  onSelectCollection,
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
    LOCAL_STORAGE_PRIVATE_COLLECTIONS,
  );

  return (
    <>
      {loading ? (
        <div className="flex flex-col gap-8 pr-6">
          <Skeleton className="w-full h-6" />
          <Skeleton className="w-full h-6" />
          <Skeleton className="w-full h-6" />
          <Skeleton className="w-full h-6" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {collectionsList?.map((collection) => (
            <div
              className="flex items-center justify-between gap-2 p-2 group"
              key={collection.id}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Switch
                  checked={isSelected(collection.id)}
                  onCheckedChange={(checked) =>
                    setSelected(collection.id, checked)
                  }
                />
                <span
                  className="relative cursor-pointer group-hover:text-primary-300"
                  onClick={() => onSelectCollection(collection)}
                >
                  {collection.name}
                  <span className="absolute -bottom-1 right-0 h-0.5 w-0 bg-primary-300 transition-all duration-300 ease-in-out group-hover:left-0 group-hover:w-full"></span>
                </span>
              </div>
              <FontAwesomeIcon
                icon={faChevronRight}
                className="h-6 w-6 cursor-pointer group-hover:text-primary-300"
                onClick={() => onSelectCollection(collection)}
              />
            </div>
          ))}
          {hasNextPage && <div ref={collectionsEndRef} />}
        </div>
      )}
    </>
  );
};
