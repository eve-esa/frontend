import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileLines,
  faFilePdf,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

type StagedDocumentsProps = {
  files: File[];
  onRemove: (file: File) => void;
  disabled?: boolean;
};

/**
 * Documents picked for the next message. Nothing is uploaded yet: they can be
 * removed freely, and Send uploads and processes them with the question.
 */
export const StagedDocuments = ({
  files,
  onRemove,
  disabled,
}: StagedDocumentsProps) => {
  if (files.length === 0) return null;

  return (
    <div
      data-testid="staged-documents"
      className="flex flex-wrap items-center gap-2 px-4 md:px-8 pt-3"
    >
      {files.map((file) => (
        <div
          key={`${file.name}-${file.size}-${file.lastModified}`}
          data-testid="staged-document"
          title={file.name}
          className="flex items-center gap-2 rounded-lg border border-primary-400 bg-primary-800/40 px-2 py-1 text-xs text-natural-100"
        >
          <FontAwesomeIcon
            icon={file.name.toLowerCase().endsWith(".pdf") ? faFilePdf : faFileLines}
            className="h-3.5 w-3.5"
          />
          <span className="max-w-48 truncate">{file.name}</span>
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            disabled={disabled}
            onClick={() => onRemove(file)}
            className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-natural-300 hover:bg-primary-600 hover:text-natural-50 cursor-pointer disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
};
