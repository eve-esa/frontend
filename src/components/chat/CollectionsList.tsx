import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { Skeleton } from "@/components/ui/Skeleton";
import type { CollectionType } from "@/services/useGetMyCollections";
import useInfinityLoading from "@/hooks/useInfinityLoading";

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
              className="flex items-center justify-between gap-2 cursor-pointer p-2 group"
              key={collection.id}
              onClick={() => onSelectCollection(collection)}
            >
              <span className=" relative group-hover:text-primary-300">
                {collection.name}
                <span className="absolute -bottom-1 right-0 w-0 h-0.5 bg-primary-300 transition-all duration-300 ease-in-out group-hover:w-full group-hover:left-0"></span>
              </span>
              <FontAwesomeIcon
                icon={faChevronRight}
                className="group-hover:text-primary-300 h-6 w-6"
              />
            </div>
          ))}
          {hasNextPage && <div ref={collectionsEndRef} />}
        </div>
      )}
    </>
  );
};
