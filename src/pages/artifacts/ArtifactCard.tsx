import { Link, generatePath } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { AuthenticatedImage } from "@/components/ui/AuthenticatedImage";
import { Spinner } from "@/components/ui/Spinner";
import { routes } from "@/utilities/routes";
import { formatDate } from "@/utilities/dayjs";
import { formatBytes } from "@/utilities/formatBytes";
import type { ImageAsset } from "@/types";

type ArtifactCardProps = {
  asset: ImageAsset;
  onOpen: () => void;
  onDelete: () => void;
  isDeleting: boolean;
};

// The stable serving route never expires and is environment-independent, so it
// is safe to build client-side when the list endpoint omits an explicit `url`.
const assetUrl = (asset: ImageAsset): string =>
  asset.url ?? `/images/${asset.id}`;

export const ArtifactCard = ({
  asset,
  onOpen,
  onDelete,
  isDeleting,
}: ArtifactCardProps) => {
  return (
    <div
      data-testid="artifact-card"
      className="flex flex-col overflow-hidden rounded-lg border border-primary-400 bg-primary-900"
    >
      <div className="relative aspect-square w-full bg-primary-800/40">
        <AuthenticatedImage
          src={assetUrl(asset)}
          alt={asset.filename}
          onClick={onOpen}
          className="h-full w-full object-cover cursor-zoom-in"
        />
        <button
          type="button"
          data-testid="artifact-delete"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label="Delete image"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-primary-400 bg-natural-1000/60 text-natural-50 hover:bg-danger-400/70 disabled:opacity-60 cursor-pointer"
        >
          {isDeleting ? (
            <Spinner size="xs" />
          ) : (
            <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
          )}
        </button>
      </div>

      <div className="flex flex-col gap-1 p-3">
        <span
          className="truncate text-sm text-natural-50"
          title={asset.filename}
        >
          {asset.filename}
        </span>
        <div className="flex items-center justify-between text-xs text-natural-300">
          <span>{asset.timestamp ? formatDate(asset.timestamp) : ""}</span>
          <span>{formatBytes(asset.size_bytes)}</span>
        </div>
        {asset.conversation_id && (
          <Link
            to={generatePath(routes.CHAT.path, {
              conversationId: asset.conversation_id,
            })}
            className="mt-1 inline-flex items-center gap-1 text-xs text-success-200 hover:text-success-300"
          >
            <FontAwesomeIcon icon={faUpRightFromSquare} className="w-3 h-3" />
            Go to conversation
          </Link>
        )}
      </div>
    </div>
  );
};
