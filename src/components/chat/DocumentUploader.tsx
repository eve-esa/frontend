import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileLines } from "@fortawesome/free-solid-svg-icons";
import { useUploadDocument } from "@/services/useUploadDocument";
import type { CollectionType } from "@/services/useGetMyCollections";
import { Spinner } from "@/components/ui/Spinner";

type DocumentUploaderProps = {
  selectedCollection: CollectionType | null;
  onUploadSuccess?: () => void;
};

export const DocumentUploader = ({
  selectedCollection,
  onUploadSuccess,
}: DocumentUploaderProps) => {
  const { mutate: uploadDocument, isPending } =
    useUploadDocument(onUploadSuccess);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      // Upload the file to backend
      if (acceptedFiles.length > 0 && selectedCollection) {
        uploadDocument({
          file: acceptedFiles,
          collectionId: selectedCollection.id,
        });
      }
    },
    [selectedCollection]
  );

  const { getRootProps, getInputProps, isDragAccept, isDragReject } =
    useDropzone({
      onDrop,
      accept: {
        "application/pdf": [".pdf"],
        "text/plain": [".txt"],
      },
      disabled: isPending,
    });

  return (
    <div className="flex-none flex items-center justify-between bg-primary-500 hover:bg-primary-400/40 transition-all duration-200 ease-in-out rounded-lg cursor-pointer">
      <div
        {...getRootProps()}
        className={cn(
          "flex-none py-4 md:py-8 px-4 md:px-6 w-full",
          "border-2 border-dashed border-neutral-400 rounded-lg flex",
          "cursor-pointer",
          "transition-all duration-200 ease-in-out",

          {
            "bg-primary-400/40": isDragAccept,
            "bg-danger-200/20": isDragReject,
          }
        )}
      >
        <input {...getInputProps()} />
        <div className="flex w-full flex-col items-center gap-2">
          <FontAwesomeIcon icon={faFileLines} className="h-[30px] w-[25px]" />
          {isPending ? (
            <div className="pt-1">
              <Spinner />
            </div>
          ) : (
            <div
              className={`font-['NotesESA'] text-sm flex justify-center gap-1`}
            >
              <span className="transition-all duration-200 ease-in-out text-xs">
                Drag & drop here or
              </span>
              <span className="text-primary-50 text-xs">browse files</span>
            </div>
          )}

          <span className="text-sm text-natural-200 text-center">
            Supported formats: PDF, and TXT files
          </span>
          {isDragReject && (
            <span className="text-sm text-danger-300">file not accepted</span>
          )}
        </div>
      </div>
    </div>
  );
};
