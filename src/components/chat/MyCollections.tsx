import { faPlus, faTimes, faUpload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import { CollectionsList } from "./CollectionsList";
import { Collection } from "./Collection";
import { DocumentUploader } from "./DocumentUploader";
import { Button } from "../ui/Button";
import { CreateCollectionDialog } from "./CreateCollectionDialog";
import { cn } from "@/lib/utils";
import {
  useGetMyCollections,
  type CollectionType,
} from "@/services/useGetMyCollections";
import { useTour } from "@/components/onboarding/TourContext";

type MyCollectionsProps = {
  onToggle: () => void;
};

export const MyCollections = ({ onToggle }: MyCollectionsProps) => {
  const { isRunning, currentStep } = useTour();
  const [isCreateCollectionDialogOpen, setIsCreateCollectionDialogOpen] =
    useState(false);
  const [selectedCollection, setSelectedCollection] =
    useState<CollectionType | null>(null);
  const [showUploadArea, setShowUploadArea] = useState(false);
  const [hasDocuments, setHasDocuments] = useState(false);
  const [isDocumentsLoaded, setIsDocumentsLoaded] = useState(false);

  // Handle upload success - hide upload area with animation
  const handleUploadSuccess = () => {
    setShowUploadArea(false);
  };

  // Reset upload area state when collection changes
  const handleCollectionSelect = (collection: CollectionType) => {
    setSelectedCollection(collection);
    setShowUploadArea(false); // Reset upload area state
    setIsDocumentsLoaded(false); // Reset documents loaded state
  };

  const {
    data: collections,
    isLoading,
    fetchNextPage,
    hasNextPage,
  } = useGetMyCollections({ enabled: !isRunning });

  const collectionsList = !isRunning
    ? collections?.pages.flatMap((page) => page.data)
    : [
        {
          id: "tour_collection",
          name: "Your own collection",
          timestamp: Date.now().toString(),
          user_id: "tour_user",
        },
      ];

  useEffect(() => {
    if (currentStep === 8) {
      setSelectedCollection({
        id: "tour_collection",
        name: "Your own collection",
        timestamp: Date.now().toString(),
        user_id: "tour_user",
      });
      setShowUploadArea(true);
    } else if (currentStep === 7) {
      setSelectedCollection(null);
      setShowUploadArea(false);
    }
  }, [currentStep]);

  const emptyCollections = collectionsList?.length === 0;

  return (
    <div className="flex flex-col h-full py-6 gap-6">
      {/* Header */}
      <div className="flex-none flex flex-col gap-6 px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg 3xl:text-3xl text-natural-50">
            My Collections
          </h2>
          <FontAwesomeIcon
            icon={faTimes}
            onClick={onToggle}
            className="text-primary-50 h-6 hover:bg-natural-700 rounded-md transition-colors cursor-pointer"
          />
        </div>
        <div>
          <p className="text-sm 3xl:text-xl text-natural-200 font-['NotesESA'] leading-6">
            Collection of documents to enrich the Knowledge base.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-w-0 flex flex-col gap-6 pt-4 new-my-collections-list-tour">
        {selectedCollection ? (
          <Collection
            collection={selectedCollection}
            goBack={() => setSelectedCollection(null)}
            onDocumentsChange={(hasDocs) => {
              setHasDocuments(hasDocs);
              setIsDocumentsLoaded(true);
            }}
          />
        ) : (
          <div className="flex h-full flex-col gap-4">
            <div
              className="flex flex-none items-center justify-between  px-6 new-my-collections-button-tour"
              data-tour="new-my-collections-button"
            >
              <Button
                className="w-full"
                variant="outline"
                size="md"
                onClick={() => setIsCreateCollectionDialogOpen(true)}
              >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                <span className="whitespace-nowrap mt-[2px] overflow-hidden text-ellipsis font-['NotesESA']">
                  NEW COLLECTION
                </span>
              </Button>
            </div>
            <div
              className="flex-1 overflow-y-auto pt-4 mask-y-from-95% mask-y-to-100%  pb-2 pl-6 pr-4 new-my-collections-list-tour"
              data-tour="new-my-collections-list"
            >
              {emptyCollections ? (
                <div className="flex h-full flex-col gap-4 items-center justify-center">
                  <p className="text-sm text-natural-200">
                    No collections found
                  </p>
                  <p className="text-sm text-natural-200">
                    Create a new collection to get started
                  </p>
                </div>
              ) : (
                <CollectionsList
                  onSelectCollection={handleCollectionSelect}
                  loading={isLoading}
                  collectionsList={collectionsList || []}
                  fetchNextPage={fetchNextPage}
                  hasNextPage={hasNextPage}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {selectedCollection && (
        <div className="border-t-2 border-primary-500 mx-6" />
      )}

      {/* Footer: Upload area */}
      {selectedCollection && (
        <div className="flex flex-col ">
          {/* Upload button - only show when documents exist and upload area is hidden */}
          <div
            className={cn(
              "transition-all duration-500 ease-in-out px-6 ",
              isDocumentsLoaded && hasDocuments && !showUploadArea
                ? "opacity-100 h-auto"
                : "opacity-0 h-0 overflow-hidden"
            )}
          >
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowUploadArea(true)}
              className="w-full"
            >
              <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
              <span className="whitespace-nowrap mt-[2px] overflow-hidden text-ellipsis font-['NotesESA']">
                Upload another document
              </span>
            </Button>
          </div>

          {/* Upload area - show when no documents OR when upload area is expanded */}

          <div
            className={cn(
              "overflow-hidden transition-all duration-500 ease-in-out",
              (!hasDocuments && isDocumentsLoaded) || showUploadArea
                ? "max-h-[286px]"
                : "max-h-0"
            )}
          >
            <div className="flex flex-col gap-4 px-6 ">
              <span className="text-lg text-natural-200">
                Upload files in this collection
              </span>
              <DocumentUploader
                selectedCollection={selectedCollection}
                onUploadSuccess={handleUploadSuccess}
              />
            </div>
          </div>
        </div>
      )}

      {isCreateCollectionDialogOpen && (
        <CreateCollectionDialog
          isOpen={isCreateCollectionDialogOpen}
          onOpenChange={setIsCreateCollectionDialogOpen}
        />
      )}
    </div>
  );
};
