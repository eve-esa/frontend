import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage } from "@fortawesome/free-solid-svg-icons";
import { useImageBlob } from "@/services/useImageBlob";
import { Skeleton } from "./Skeleton";
import { cn } from "@/lib/utils";
import { isTrustedRequestUrl, resolveApiOrigin } from "@/utilities/sameOrigin";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const PAGE_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "";
const API_ORIGIN = resolveApiOrigin(API_BASE, PAGE_ORIGIN);

/**
 * Returns true only when `src` resolves to our own app origin or the configured
 * API origin, in which case it is fetched through the JWT-authenticated client.
 * Everything else — cross-origin absolute URLs and protocol-relative `//host`
 * URLs — is loaded as a plain, tokenless `<img>` so the bearer token can never
 * leak off-origin (see utilities/sameOrigin).
 */
const needsAuthenticatedFetch = (src: string): boolean =>
  isTrustedRequestUrl(src, API_BASE, PAGE_ORIGIN, API_ORIGIN);

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
