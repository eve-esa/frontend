import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBan, faImage } from "@fortawesome/free-solid-svg-icons";
import { useImageBlob } from "@/services/useImageBlob";
import { cn } from "@/lib/utils";
import { isTrustedRequestUrl, resolveApiOrigin } from "@/utilities/sameOrigin";

// Read at call time, not at module load, so the origins always match the page
// that renders the image (and tests can set them).
const apiBase = (): string => import.meta.env.VITE_API_URL ?? "";
const pageOrigin = (): string =>
  typeof window !== "undefined" ? window.location.origin : "";

// Raster types a `data:` URL may carry and still render inline. SVG is left
// out on purpose: it is a document, not a picture, and never loads inline.
const ALLOWED_DATA_IMAGE_RE =
  /^data:image\/(?:png|jpeg|jpg|gif|webp|avif)(?:;[^,]*)?,/i;

/**
 * How an image source is rendered:
 * - `authenticated`: our app origin or the configured API origin, fetched
 *   through the JWT-authenticated client (see utilities/sameOrigin).
 * - `inline`: needs no network (an allowed raster `data:` URL, or a `blob:` URL
 *   this page created), rendered as a plain `<img>`.
 * - `external`: an http(s) URL on another host. Never fetched until the user
 *   asks for it: an image the model or a tool put in an answer would otherwise
 *   load as soon as the answer streams, and its URL can carry data out
 *   (zero-click exfiltration).
 * - `blocked`: anything else (`data:image/svg+xml`, other schemes, unparseable
 *   input). Never loaded.
 */
export type ImageSourceKind = "authenticated" | "inline" | "external" | "blocked";

export const classifyImageSrc = (src: string): ImageSourceKind => {
  const target = src.trim();
  if (!target) return "blocked";

  const origin = pageOrigin();
  const base = apiBase();
  if (
    isTrustedRequestUrl(target, base, origin, resolveApiOrigin(base, origin))
  ) {
    return "authenticated";
  }

  if (/^data:/i.test(target)) {
    return ALLOWED_DATA_IMAGE_RE.test(target) ? "inline" : "blocked";
  }

  // Protocol-relative forms resolve to a foreign host: external.
  const absolute = /^[\\/]{2}/.test(target)
    ? `https:${target.replace(/\\/g, "/")}`
    : target;
  try {
    const url = new URL(absolute);
    if (url.protocol === "blob:") {
      return url.origin === origin && origin !== "" ? "inline" : "blocked";
    }
    if (url.protocol === "http:" || url.protocol === "https:") {
      return "external";
    }
  } catch {
    // Relative input that is not trusted, or not a URL at all.
  }
  return "blocked";
};

/** Host shown on the placeholder, so the user knows where a click will go. */
export const imageSrcHost = (src: string): string => {
  const target = src.trim();
  const absolute = /^[\\/]{2}/.test(target)
    ? `https:${target.replace(/\\/g, "/")}`
    : target;
  try {
    return new URL(absolute).host || "unknown host";
  } catch {
    return "unknown host";
  }
};

// External URLs the user chose to load in this tab. A lightbox opened from a
// loaded image mounts its own AuthenticatedImage; without this it would ask
// again for the same picture.
const approvedExternal = new Set<string>();

export const approveExternalImage = (src: string): void => {
  approvedExternal.add(src);
};

/** Test hook: forget every approval. */
export const resetApprovedExternalImages = (): void => {
  approvedExternal.clear();
};

// Light: an opaque chip fill (primary-800 is #E0E4E7 there, the BRAND chips
// row), so the text keeps its contrast on the black lightbox overlay too.
const PLACEHOLDER_CLASS =
  "my-1 inline-flex max-w-full items-center gap-2 rounded-lg border border-primary-400 bg-primary-800/40 px-3 py-1.5 text-sm text-natural-200 in-data-[theme=light]:bg-primary-800";

// Longest URL shown in the tooltip; the host is always on the chip itself.
const TOOLTIP_URL_MAX = 200;

const tooltipUrl = (src: string): string => {
  const target = src.trim();
  return target.length > TOOLTIP_URL_MAX
    ? `${target.slice(0, TOOLTIP_URL_MAX)}...`
    : target;
};

type ExternalImagePlaceholderProps = {
  host: string;
  alt?: string;
  /** Full URL, shown in the tooltip so the user sees what a click requests. */
  src?: string;
  /** Sizing from the caller, e.g. a gallery tile. */
  className?: string;
  onLoad: () => void;
};

/**
 * Stands in for an image on another host. Nothing is requested until the
 * button is pressed. Hook-free on purpose, so it can be called directly.
 */
export const ExternalImagePlaceholder = ({
  host,
  alt,
  src,
  className,
  onLoad,
}: ExternalImagePlaceholderProps) => (
  <button
    type="button"
    data-testid="external-image-load"
    data-host={host}
    onClick={(event) => {
      // Inside a linked image the button sits in an <a>: load the image,
      // do not follow the link.
      event?.preventDefault?.();
      event?.stopPropagation?.();
      onLoad();
    }}
    title={src ? tooltipUrl(src) : alt || undefined}
    aria-label={
      alt ? `Load image ${alt} from ${host}` : `Load image from ${host}`
    }
    className={cn(
      PLACEHOLDER_CLASS,
      "cursor-pointer hover:bg-primary-800/70 in-data-[theme=light]:hover:border-control outline-none focus-visible:ring-focus focus-visible:ring-[2px]",
      className,
    )}
  >
    <FontAwesomeIcon icon={faImage} className="w-3.5 h-3.5 flex-none" />
    <span className="truncate">
      Load image from{" "}
      <span data-testid="external-image-host" className="font-semibold">
        {host}
      </span>
    </span>
  </button>
);

const BlockedImagePlaceholder = ({
  alt,
  className,
}: {
  alt?: string;
  className?: string;
}) => (
  <span
    data-testid="blocked-image-placeholder"
    role="img"
    aria-label={alt ? `Image not shown: ${alt}` : "Image not shown"}
    title={alt || undefined}
    className={cn(PLACEHOLDER_CLASS, className)}
  >
    <FontAwesomeIcon icon={faBan} className="w-3.5 h-3.5 flex-none" />
    <span className="truncate" aria-hidden="true">
      Image not shown
    </span>
  </span>
);

/** An external image the user asked for that did not load (404, hotlink block). */
const FailedImagePlaceholder = ({
  alt,
  host,
  className,
}: {
  alt?: string;
  host: string;
  className?: string;
}) => (
  <span
    data-testid="external-image-failed"
    role="img"
    aria-label={
      alt
        ? `Image ${alt} could not be loaded from ${host}`
        : `Image could not be loaded from ${host}`
    }
    title={alt || undefined}
    className={cn(PLACEHOLDER_CLASS, className)}
  >
    <FontAwesomeIcon icon={faBan} className="w-3.5 h-3.5 flex-none" />
    <span className="truncate" aria-hidden="true">
      Could not load image from {host}
    </span>
  </span>
);

type AuthenticatedImageProps = {
  src: string;
  alt?: string;
  className?: string;
  /** Sizing for the placeholders, e.g. a gallery tile; the image keeps `className`. */
  placeholderClassName?: string;
  onClick?: () => void;
  "data-testid"?: string;
  // Notifies the caller (e.g. MarkdownImage) that the image failed to load,
  // so it can collapse its own wrapper (badges, lightbox trigger, ...) too.
  onError?: () => void;
};

/**
 * Renders an image that may live behind our authenticated API. Keeps a
 * fixed-size skeleton while loading (no layout shift), shows the image once
 * ready, and renders nothing on failure: the model's prose sometimes
 * embeds invented URLs that 404, and a broken-image placeholder box reads
 * worse than the image simply not being there.
 *
 * Images on another host are not loaded automatically: a placeholder shows
 * the host and loads the image only on an explicit click.
 */
export const AuthenticatedImage = ({
  src,
  alt = "",
  className,
  placeholderClassName,
  onClick,
  "data-testid": dataTestId,
  onError,
}: AuthenticatedImageProps) => {
  const kind = classifyImageSrc(src);
  const authenticated = kind === "authenticated";
  const [directError, setDirectError] = useState(false);
  // The approved src, not a boolean: if this instance is reused for another
  // src, the approval must not carry over to it.
  const [approvedSrc, setApprovedSrc] = useState<string | null>(null);
  const externalApproved =
    kind === "external" && (approvedSrc === src || approvedExternal.has(src));

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

  if (kind === "blocked") {
    return <BlockedImagePlaceholder alt={alt} className={placeholderClassName} />;
  }

  if (kind === "external" && !externalApproved) {
    return (
      <ExternalImagePlaceholder
        host={imageSrcHost(src)}
        alt={alt}
        src={src}
        className={placeholderClassName}
        onLoad={() => {
          approveExternalImage(src);
          setApprovedSrc(src);
        }}
      />
    );
  }

  if (directError) {
    // The user clicked this one: say it failed instead of making it vanish.
    return kind === "external" ? (
      <FailedImagePlaceholder
        alt={alt}
        host={imageSrcHost(src)}
        className={placeholderClassName}
      />
    ) : null;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      // A loaded external image still must not learn which page asked for it.
      referrerPolicy="no-referrer"
      onClick={onClick}
      onError={() => {
        setDirectError(true);
        // An approved external image keeps its own "could not load" chip, so
        // the caller must not collapse it.
        if (kind !== "external") onError?.();
      }}
      data-testid={dataTestId}
      className={className}
    />
  );
};
