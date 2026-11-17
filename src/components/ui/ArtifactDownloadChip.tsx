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

// A workspace file the model linked from chat:
// `/conversations/{id}/workspace/{path}`. The bytes are served by the API.
// A bare `<a href>` opens the page origin, which has no such route.
const WORKSPACE_LINK_RE = /^\/conversations\/[\w-]+\/workspace\/(.+)$/;

export const workspaceDownloadName = (
  href: string | undefined,
): string | undefined => {
  if (typeof href !== "string" || !href.startsWith("/conversations/")) {
    return undefined;
  }
  let path: string;
  try {
    path = decodeURIComponent(href);
  } catch {
    return undefined;
  }
  if (/[?#\\]/.test(path)) return undefined;
  const match = WORKSPACE_LINK_RE.exec(path);
  if (!match) return undefined;
  const parts = match[1].split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    return undefined;
  }
  return parts[parts.length - 1];
};

export const isWorkspaceDownloadLink = (href: string | undefined): boolean =>
  workspaceDownloadName(href) !== undefined &&
  isTrustedRequestUrl(href, API_BASE, PAGE_ORIGIN, API_ORIGIN);

export const isArtifactDownloadLink = (href: string | undefined): boolean =>
  typeof href === "string" &&
  ARTIFACT_LINK_RE.test(href) &&
  isTrustedRequestUrl(href, API_BASE, PAGE_ORIGIN, API_ORIGIN);

const IMAGE_NAME = /\.(png|jpe?g|gif|webp)$/i;
const MARKDOWN_NAME = /\.(md|markdown)$/i;

export const isTrustedAppHref = (href: string | undefined): boolean =>
  isTrustedRequestUrl(href, API_BASE, PAGE_ORIGIN, API_ORIGIN);

// `/artifacts/{id}` or `/artifacts/{id}/{filename}`. `/artifacts/{id}/url` is
// the presigned-URL route, not the file.
export const artifactTarget = (
  href: string | undefined,
): { id: string; name?: string } | undefined => {
  if (typeof href !== "string" || !href.startsWith("/artifacts/")) return undefined;
  let path: string;
  try {
    path = decodeURIComponent(href.split(/[?#]/, 1)[0]);
  } catch {
    return undefined;
  }
  const match = /^\/artifacts\/([\w-]+)(?:\/(.*))?$/.exec(path);
  if (!match) return undefined;
  if (match[2] === undefined) return { id: match[1] };
  if (match[2] === "url") return undefined;
  const parts = match[2].split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    return undefined;
  }
  return { id: match[1], name: parts[parts.length - 1] };
};

// A picture the model linked with `[label](file.png)` instead of `![label](...)`.
// The artifact route is `/artifacts/{id}`, so the filename is dropped for the fetch.
export const linkedImageSrc = (href: string | undefined): string | undefined => {
  const artifact = artifactTarget(href);
  if (artifact?.name && IMAGE_NAME.test(artifact.name)) {
    return `/artifacts/${artifact.id}`;
  }
  const workspaceName = workspaceDownloadName(href);
  if (workspaceName && IMAGE_NAME.test(workspaceName)) return href;
  return undefined;
};

const MARKDOWN_LINK = /(!?)\[[^\]]*]\(([^)\s]+)\)/g;

export const workspaceMarkdownHrefs = (text: string): string[] => {
  const seen = new Set<string>();
  const hrefs: string[] = [];
  for (const match of text.matchAll(MARKDOWN_LINK)) {
    if (match[1] === "!") continue;
    const href = match[2];
    const name = workspaceDownloadName(href);
    if (!name || !MARKDOWN_NAME.test(name) || seen.has(href)) continue;
    seen.add(href);
    hrefs.push(href);
  }
  return hrefs;
};

// Where a non-image file link should download from. Image links are excluded.
export const downloadHrefForLink = (
  href: string | undefined,
): { href: string; filename?: string } | undefined => {
  if (!href || linkedImageSrc(href)) return undefined;
  const artifact = artifactTarget(href);
  if (artifact && isTrustedAppHref(href)) {
    return { href: `/artifacts/${artifact.id}`, filename: artifact.name };
  }
  const name = workspaceDownloadName(href);
  if (name && isWorkspaceDownloadLink(href)) {
    return { href, filename: name };
  }
  return undefined;
};

type ArtifactDownloadChipProps = {
  href: string;
  filename?: string;
};

/**
 * Renders a non-image artifact (`/artifacts/{id}`) or a workspace file
 * (`/conversations/{id}/workspace/{path}`) as a download chip instead of a
 * plain link. The JWT never leaves our origin: the bytes are fetched through
 * the authenticated axios client, never a bare `<a href>`.
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
