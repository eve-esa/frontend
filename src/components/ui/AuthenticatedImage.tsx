import { useEffect, useState } from "react";
import { useImageBlob } from "@/services/useImageBlob";
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
  // Notifies the caller (e.g. MarkdownImage) that the image failed to load,
  // so it can collapse its own wrapper (badges, lightbox trigger, ...) too.
  onError?: () => void;
};

/**
 * Renders an image that may live behind our authenticated API. Keeps a
 * fixed-size skeleton while loading (no layout shift), shows the image once
 * ready, and renders nothing on failure — the model's prose sometimes
 * embeds invented URLs that 404, and a broken-image placeholder box reads
 * worse than the image simply not being there.
 */
export const AuthenticatedImage = ({
  src,
  alt = "",
  className,
  onClick,
  "data-testid": dataTestId,
  onError,
}: AuthenticatedImageProps) => {
  const authenticated = needsAuthenticatedFetch(src);
  const [directError, setDirectError] = useState(false);

  const {
    data: blobUrl,
    isLoading,
    isError,
  } = useImageBlob(src, authenticated);

  useEffect(() => {
    if (isError) onError?.();
  }, [isError, onError]);

  if (authenticated) {
    if (isError) return null;
    if (isLoading || !blobUrl) {
      // span, not the Skeleton component: this can render inside a markdown
      // <p> (chat images), where Skeleton's <div> would be invalid HTML and
      // trigger a React hydration warning. Mirrors Skeleton's own styling.
      return (
        <span
          data-slot="skeleton"
          data-testid={dataTestId}
          className={cn(
            "inline-block bg-primary-300 animate-pulse rounded-md",
            className,
          )}
        />
      );
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

  if (directError) return null;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onClick={onClick}
      onError={() => {
        setDirectError(true);
        onError?.();
      }}
      data-testid={dataTestId}
      className={className}
    />
  );
};
