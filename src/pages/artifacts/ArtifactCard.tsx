import { Link, generatePath } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUpRightFromSquare,
  faFile,
} from "@fortawesome/free-solid-svg-icons";
import { AuthenticatedImage } from "@/components/ui/AuthenticatedImage";
import { ArtifactDownloadChip } from "@/components/ui/ArtifactDownloadChip";
import { routes } from "@/utilities/routes";
import { formatDate } from "@/utilities/dayjs";
import { formatBytes } from "@/utilities/formatBytes";
import type { ImageAsset } from "@/types";

type ArtifactCardProps = {
  asset: ImageAsset;
  onOpen: () => void;
};

// The stable serving route never expires and is environment-independent, so it
// is safe to build client-side when the list endpoint omits an explicit `url`.
const assetUrl = (asset: ImageAsset): string =>
  asset.url ?? `/artifacts/${asset.id}`;

const sourceLabel = (asset: ImageAsset): string | null => {
  if (!asset.source) return null;
  return asset.source.type === "mcp_tool" ? "MCP" : "Upload";
};

export const ArtifactCard = ({
  asset,
  onOpen,
}: ArtifactCardProps) => {
  return (
    <div
      data-testid="artifact-card"
      className="flex flex-col overflow-hidden rounded-lg border border-primary-400 bg-primary-900"
    >
      <div className="relative aspect-square w-full bg-primary-800/40">
        {asset.content_type.startsWith("image/") ? (
          <AuthenticatedImage
            src={assetUrl(asset)}
            alt={asset.filename}
            onClick={onOpen}
            className="h-full w-full object-cover cursor-zoom-in"
          />
        ) : (
          // Non-image artifacts (pdf, csv, ...) have no thumbnail and no
          // lightbox: a file placeholder; the chip below downloads them.
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-natural-200">
            <FontAwesomeIcon icon={faFile} className="h-10 w-10" />
            <span className="text-xs uppercase">
              {asset.filename.split(".").pop()}
            </span>
          </div>
        )}
        {sourceLabel(asset) && (
          <span className="absolute left-2 top-2 rounded-full border border-primary-400 bg-natural-1000/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-natural-50">
            {sourceLabel(asset)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 p-3">
        <span
          className="truncate text-sm text-natural-50"
          title={asset.filename}
        >
          {asset.filename}
        </span>
        {/* natural-300 is near-black in this palette — unreadable on the
            dark card; natural-200 is the light muted tone. */}
        <div className="flex items-center justify-between text-xs text-natural-200">
          <span>{asset.timestamp ? formatDate(asset.timestamp) : ""}</span>
          <span>{formatBytes(asset.size_bytes)}</span>
        </div>
        {!asset.content_type.startsWith("image/") && (
          <ArtifactDownloadChip
            href={assetUrl(asset)}
            filename={asset.filename}
          />
        )}
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
