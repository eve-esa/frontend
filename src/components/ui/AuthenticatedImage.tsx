import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage } from "@fortawesome/free-solid-svg-icons";
import { useImageBlob } from "@/services/useImageBlob";
import { Skeleton } from "./Skeleton";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/**
 * Returns true when `src` points at our own backend and therefore needs a
 * JWT-authenticated fetch. Relative URLs (`/images/...`) and URLs prefixed with
 * `VITE_API_URL` are served by us; other absolute http(s) URLs are loaded
 * directly by the browser.
 */
const needsAuthenticatedFetch = (src: string): boolean =>
  src.startsWith("/") || (API_BASE !== "" && src.startsWith(API_BASE));

type AuthenticatedImageProps = {
  src: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
  "data-testid"?: string;
};

/**
 * Renders an image that may live behind our authenticated API. Keeps a
 * fixed-size skeleton while loading (no layout shift), shows the image once
 * ready, and falls back to an error box on failure.
 */
export const AuthenticatedImage = ({
  src,
  alt = "",
  className,
  onClick,
  "data-testid": dataTestId,
}: AuthenticatedImageProps) => {
  const authenticated = needsAuthenticatedFetch(src);
  const [directError, setDirectError] = useState(false);

  const {
    data: blobUrl,
    isLoading,
    isError,
  } = useImageBlob(src, authenticated);

  const errorFallback = (
    <div
      data-testid="image-error"
      className={cn(
        "flex flex-col items-center justify-center gap-1 bg-primary-800/40 text-natural-400 rounded-md p-2 text-center",
        className,
      )}
    >
      <FontAwesomeIcon icon={faImage} className="w-5 h-5" />
      <span className="text-xs break-all line-clamp-2">
        {alt || "Image unavailable"}
      </span>
    </div>
  );

  if (authenticated) {
    if (isError) return errorFallback;
    if (isLoading || !blobUrl) {
      return <Skeleton className={className} data-testid={dataTestId} />;
    }
    return (
      <img
        src={blobUrl}
        alt={alt}
        loading="lazy"
        onClick={onClick}
        data-testid={dataTestId}
        className={className}
      />
    );
  }

  if (directError) return errorFallback;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onClick={onClick}
      onError={() => setDirectError(true)}
      data-testid={dataTestId}
      className={className}
    />
  );
};
