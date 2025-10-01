import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useGetSharedCollection } from "@/services/useGetSharedCollection";
import { SharedCollectionsList } from "./SharedCollectionsList";

type SharedCollectionsProps = {
  onToggle: () => void;
};

export const SharedCollections = ({ onToggle }: SharedCollectionsProps) => {
  const {
    data: collections,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useGetSharedCollection();

  const collectionsList = collections?.pages.flatMap((page) => page.data);
  const emptyCollections = collectionsList?.length === 0;
  const loading = isLoading || isFetching;

  return (
    <div className="flex flex-col h-full py-6 gap-6 md:gap-10">
      {/* Header */}
      <div className="flex-none flex flex-col gap-6 md:gap-10 px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg 3xl:text-3xl text-natural-50 ">
            Shared collections
          </h2>
          <FontAwesomeIcon
            icon={faTimes}
            onClick={onToggle}
            className="text-primary-50 h-6 hover:bg-natural-700 rounded-md transition-colors cursor-pointer"
          />
        </div>
        <div>
          <p className="text-sm 3xl:text-xl text-natural-200 font-['NotesESA'] leading-6 pt-2">
            Collection of documents to enrich the Knowledge base. You can enable
            or disable collections to use them alongside your own collections in
            your queries.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-w-0 flex flex-col gap-8 py-2 px-6">
        <div className="flex h-full flex-col gap-4 ">
          {emptyCollections ? (
            <div className="flex flex-1 flex-col gap-4 items-center justify-center">
              <p className="text-sm text-natural-200">
                No shared collections found
              </p>
            </div>
          ) : (
            <SharedCollectionsList
              loading={loading}
              collectionsList={collectionsList || []}
              fetchNextPage={fetchNextPage}
              hasNextPage={hasNextPage}
            />
          )}
        </div>
      </div>
    </div>
  );
};
