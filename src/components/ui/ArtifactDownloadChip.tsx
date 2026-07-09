import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faFile } from "@fortawesome/free-solid-svg-icons";
import { Spinner } from "./Spinner";
import { cn } from "@/lib/utils";
import api from "@/services/axios";
import { isTrustedRequestUrl, resolveApiOrigin } from "@/utilities/sameOrigin";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const PAGE_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "";
const API_ORIGIN = resolveApiOrigin(API_BASE, PAGE_ORIGIN);

// Only `/artifacts/{id}` (not `/artifacts/{id}/url`, the presigned-URL variant)
// identifies a downloadable artifact byte stream.
const ARTIFACT_LINK_RE = /^\/artifacts\/[\w-]+\/?$/;

export const isArtifactDownloadLink = (href: string | undefined): boolean =>
  typeof href === "string" &&
  ARTIFACT_LINK_RE.test(href) &&
  isTrustedRequestUrl(href, API_BASE, PAGE_ORIGIN, API_ORIGIN);

type ArtifactDownloadChipProps = {
  href: string;
  filename?: string;
};

/**
 * Renders a non-image artifact (a markdown link to `/artifacts/{id}`) as a
 * small download chip instead of a plain link. Mirrors AuthenticatedImage's
 * fetch→blob pattern: the JWT never leaves our origin, so the download is
 * always fetched through the authenticated axios client, never a bare `<a
 * href>` (which would hit the API unauthenticated).
 */
export const ArtifactDownloadChip = ({
  href,
  filename,
}: ArtifactDownloadChipProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setHasError(false);
    try {
      const { data } = await api.get<Blob>(href, { responseType: "blob" });
      const objectUrl = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename || "artifact";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Failed to download artifact", error);
      setHasError(true);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      type="button"
      data-testid="artifact-download-chip"
      onClick={handleDownload}
      disabled={isDownloading}
      className={cn(
        "my-1 inline-flex max-w-full items-center gap-2 rounded-lg border border-primary-400 bg-primary-800/40 px-3 py-1.5 text-sm text-natural-200 hover:bg-primary-800/70 disabled:opacity-60 cursor-pointer",
        hasError && "border-danger-400 text-danger-400",
      )}
    >
      <FontAwesomeIcon icon={faFile} className="w-3.5 h-3.5 flex-none" />
      <span className="truncate">{filename || href}</span>
      {isDownloading ? (
        <Spinner size="xs" />
      ) : (
        <FontAwesomeIcon icon={faDownload} className="w-3.5 h-3.5 flex-none" />
      )}
    </button>
  );
};
