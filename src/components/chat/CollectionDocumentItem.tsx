import type { DocumentType } from "@/services/useGetDocuments";
import { formatApiDate } from "@/utilities/dayjs";
import { faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { DeleteDocumentDialog } from "./DeleteDocumentDialog";
import { useGetProfile } from "@/services/useMe";

type CollectionDocumentItemProps = {
  document: DocumentType;
  isLastItem: boolean;
};

export const CollectionDocumentItem = ({
  document,
  isLastItem,
}: CollectionDocumentItemProps) => {
  const [isOpenDeleteDocumentDialog, setIsOpenDeleteDocumentDialog] =
    useState(false);

  const { data: profile } = useGetProfile();
  const isMine = profile?.id === document.user_id;
  const uploadedOn = formatApiDate(document.timestamp);

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="collection-document"
      data-document-id={document.id}
    >
      <div className="flex w-full items-center justify-between gap-2 group">
        <div className="flex w-full items-start flex-col justify-between gap-2 py-2 ">
          <div className="flex items-center justify-between w-full">
            <span className="relative group">
              <span
                className="group-hover:text-primary-300"
                data-testid="collection-document-name"
              >
                {document.name}
              </span>
              <span className="absolute -bottom-1 right-0 w-0 h-0.5 bg-primary-300"></span>
            </span>
            {isMine && (
              <FontAwesomeIcon
                onClick={() => isMine && setIsOpenDeleteDocumentDialog(true)}
                data-testid="collection-document-delete"
                icon={faTrashCan}
                className="text-danger-300 cursor-pointer opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
              />
            )}
          </div>

          {uploadedOn && (
            <span
              className="text-[12px] text-primary-50"
              data-testid="collection-document-date"
            >
              {uploadedOn}
            </span>
          )}
        </div>
      </div>
      {!isLastItem && (
        <span className="border-b border-[1px] border-primary-50 w-full" />
      )}

      {isOpenDeleteDocumentDialog && (
        <DeleteDocumentDialog
          isOpen={isOpenDeleteDocumentDialog}
          onOpenChange={setIsOpenDeleteDocumentDialog}
          collectionId={document?.collection_id}
          documentId={document?.id}
        />
      )}
    </div>
  );
};
