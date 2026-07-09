import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faXmark,
  faRotateRight,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { Spinner } from "@/components/ui/Spinner";
import type { ImageAttachment } from "@/types";

export type PendingAttachmentStatus = "uploading" | "done" | "error";

// A locally-selected image being uploaded before the message is sent. The
// thumbnail is a local object URL (no network), while `uploaded` holds the
// server-side attachment once POST /artifacts resolves.
export type PendingAttachment = {
  localId: string;
  file: File;
  previewUrl: string;
  filename: string;
  status: PendingAttachmentStatus;
  progress: number;
  uploaded?: ImageAttachment;
};

type AttachmentPreviewListProps = {
  attachments: PendingAttachment[];
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
};

export const AttachmentPreviewList = ({
  attachments,
  onRemove,
  onRetry,
}: AttachmentPreviewListProps) => {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 md:px-8 pt-3">
      {attachments.map((attachment) => (
        <div
          key={attachment.localId}
          data-testid="attachment-preview"
          className="relative h-16 w-16 flex-none overflow-hidden rounded-lg border border-primary-400 bg-primary-800/40"
        >
          <img
            src={attachment.previewUrl}
            alt={attachment.filename}
            className="h-full w-full object-cover"
          />

          {attachment.status === "uploading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-natural-1000/50">
              <Spinner size="xs" />
            </div>
          )}

          {attachment.status === "error" && (
            <button
              type="button"
              onClick={() => onRetry(attachment.localId)}
              title="Retry upload"
              className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-danger-200/40 text-natural-50 cursor-pointer"
            >
              <FontAwesomeIcon icon={faTriangleExclamation} className="w-3 h-3" />
              <FontAwesomeIcon icon={faRotateRight} className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            data-testid="attachment-remove"
            onClick={() => onRemove(attachment.localId)}
            aria-label="Remove attachment"
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-primary-400 bg-primary-600 text-natural-50 hover:bg-primary-500 cursor-pointer"
          >
            <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};
