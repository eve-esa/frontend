import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { CollectionDocumentItem } from "./CollectionDocumentItem";
import { useGetDocuments } from "@/services/useGetDocuments";
import { DocumentsSkeleton } from "./DocumentsSkeleton";
import { useApiError } from "@/hooks/useApiError";
import type { CollectionType } from "@/services/useGetMyCollections";
import useInfinityLoading from "@/hooks/useInfinityLoading";
import { useState, useEffect } from "react";
import { DeleteCollectionDialog } from "./DeleteCollectionDialog";
import { useGetProfile } from "@/services/useMe";
import { useTour } from "@/components/onboarding/TourContext";

type CollectionProps = {
  collection: CollectionType;
  goBack: () => void;
  onDocumentsChange?: (hasDocuments: boolean) => void;
};

export const Collection = ({
  collection,
  goBack,
  onDocumentsChange,
}: CollectionProps) => {
  const { isRunning } = useTour();
  const [isDeleteCollectionDialogOpen, setIsDeleteCollectionDialogOpen] =
    useState(false);

  const { data: profile } = useGetProfile();

  const isMine = profile?.id === collection.user_id;

  const {
    data: documents,
    isLoading,
    isFetched,
    error,
    fetchNextPage,
    hasNextPage,
  } = useGetDocuments({ collectionId: collection.id, enabled: !isRunning });

  const [documentsEndRef] = useInfinityLoading({
    fetchFunction: fetchNextPage,
    dependencies: [hasNextPage],
  });

  const documentsList = !isRunning
    ? documents?.pages.flatMap((page) => page.data)
    : [];
  const emptyDocuments = documentsList?.length === 0;

  // Notify parent component when documents change
  useEffect(() => {
    if (onDocumentsChange && isFetched) {
      onDocumentsChange(!emptyDocuments);
    }
  }, [emptyDocuments, isFetched, onDocumentsChange]);

  useApiError(error);

  return (
    <div className="flex flex-col h-full w-full ">
      {/* Fixed Header */}
      <div className="flex-none flex items-start flex-col gap-4 pb-4 px-6">
        <FontAwesomeIcon
          icon={faChevronLeft}
          onClick={goBack}
          className="cursor-pointer h-6 w-6"
        />
        <div className="flex w-full flex-col">
          <span className="text-[12px] 3xl:text-xl text-natural-200">
            files in
          </span>
          <div className="flex w-full items-center gap-2 justify-between">
            <span className="text-[22px]">{collection.name}</span>
            {isMine && (
              <FontAwesomeIcon
                onClick={() => isMine && setIsDeleteCollectionDialogOpen(true)}
                icon={faTrashCan}
                className="text-danger-300 cursor-pointer"
              />
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}

      <div className="flex-1 overflow-y-auto scrollable-content mask-y-from-97% mask-y-to-100% px-6">
        {!isLoading && isFetched && emptyDocuments && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm 3xl:text-xl text-natural-200">
              No documents found
            </span>
          </div>
        )}
        {isLoading ? (
          <>
            <DocumentsSkeleton />
            <DocumentsSkeleton />
            <DocumentsSkeleton />
          </>
        ) : (
          <>
            {documentsList?.map((document, index, array) => (
              <CollectionDocumentItem
                key={document.id}
                document={document}
                isLastItem={index === array.length - 1}
              />
            ))}
            {hasNextPage && <div ref={documentsEndRef} />}
          </>
        )}
      </div>

      {isMine && isDeleteCollectionDialogOpen && (
        <DeleteCollectionDialog
          isOpen={isDeleteCollectionDialogOpen}
          onOpenChange={setIsDeleteCollectionDialogOpen}
          collectionId={collection?.id}
          onDeleteSuccess={() => {
            setIsDeleteCollectionDialogOpen(false);
            goBack();
          }}
        />
      )}
    </div>
  );
};
