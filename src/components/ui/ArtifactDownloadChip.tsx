import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faFile } from "@fortawesome/free-solid-svg-icons";
import { Spinner } from "./Spinner";
import { cn } from "@/lib/utils";
import api from "@/services/axios";
import { isTrustedRequestUrl, resolveApiOrigin } from "@/utilities/sameOrigin";

// Read at call time, not at module load, so the origins always match the page
// that renders the link (and tests can set them).
const apiBase = (): string => import.meta.env.VITE_API_URL ?? "";
const pageOrigin = (): string =>
  typeof window !== "undefined" ? window.location.origin : "";

// Only `/artifacts/{id}` (not `/artifacts/{id}/url`, the presigned-URL variant)
// identifies a downloadable artifact byte stream.
const ARTIFACT_LINK_RE = /^\/artifacts\/[\w-]+\/?$/;

// A file the backend saved from the sandbox working directory
// (`GET /conversations/{id}/workspace/{path}`). A `/workspace/...` sandbox path
// is not a URL the API serves, so it stays a plain link.
const WORKSPACE_LINK_RE = /^\/conversations\/[\w-]+\/workspace\/([^?#\s]*[^/?#\s])$/;

const workspaceFilePath = (href: string): string | null => {
  const match = WORKSPACE_LINK_RE.exec(href);
  if (!match) return null;
  const segments = match[1].split("/");
  return segments.some((part) => part === "" || part === "." || part === "..")
    ? null
    : match[1];
};

export const isArtifactDownloadLink = (href: string | undefined): boolean => {
  if (typeof href !== "string") return false;
  if (!ARTIFACT_LINK_RE.test(href) && workspaceFilePath(href) === null) {
    return false;
  }
  const base = apiBase();
  const origin = pageOrigin();
  return isTrustedRequestUrl(href, base, origin, resolveApiOrigin(base, origin));
};

/**
 * Name the browser saves the file as. A workspace file keeps its own name,
 * since the link text is often prose ("Download here").
 */
export const downloadFilename = (href: string, label?: string): string => {
  const path = workspaceFilePath(href);
  if (path) {
    const name = path.split("/").pop() ?? "";
    try {
      return decodeURIComponent(name) || label || "file";
    } catch {
      return name || label || "file";
    }
  }
  return label || "artifact";
};

type ArtifactDownloadChipProps = {
  href: string;
  filename?: string;
};

/**
 * Renders a link to a stored file (`/artifacts/{id}` or a saved workspace
 * file under `/conversations/{id}/workspace/`) as a small download chip
 * instead of a plain link. Mirrors AuthenticatedImage's
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
      link.download = downloadFilename(href, filename);
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
