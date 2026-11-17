import React, { useState } from "react";
import type { Element as HastElement } from "hast";
import { cn } from "@/lib/utils";
import { AuthenticatedImage } from "./AuthenticatedImage";
import { ImageLightbox } from "./ImageLightbox";

// Shared by the react-markdown renderer (SmartText) and the Streamdown renderer
// (StreamdownText), moved here unchanged so neither imports the other's stack.

// Markdown title of the form "MCP: {server}/{tool}" (or just "MCP") marks a
// stub image the backend generated from an MCP tool call, per the backend
// contract, used to render the provenance pill below.
const isMcpProvenance = (title: string | undefined): boolean =>
  Boolean(title?.toLowerCase().startsWith("mcp"));

// Small provenance pill, styled to match ArtifactCard's source label
// (src/pages/artifacts/ArtifactCard.tsx). Shows "MCP"; the full title (e.g.
// "MCP: filesystem/read_file") is available as a tooltip.
const McpBadge = ({ title }: { title: string }) => (
  <span
    title={title}
    className="absolute left-2 top-2 rounded-full border border-primary-400 bg-natural-1000/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-natural-50 in-data-[theme=light]:bg-primary-500"
  >
    MCP
  </span>
);

// Renders both `![]()` markdown images and raw `<img>` (rehype-raw routes both
// through the `img` override). Memoized on src+alt+title so it doesn't
// re-render (and re-fetch its blob) on every streamed token. The `tile`
// variant is used inside the gallery grid: uniform cropped thumbnails instead
// of the free-flowing inline size.
//
// Clicking normally opens this image's own lightbox. When `onImageClick` is
// passed (the gallery-grid case), it defers to the caller instead so a whole
// paragraph of images can share one lightbox instance with next/prev nav.
export const MarkdownImage = React.memo(
  ({
    src,
    alt,
    title,
    variant = "inline",
    onImageClick,
  }: {
    src?: string;
    alt?: string;
    title?: string;
    variant?: "inline" | "tile";
    onImageClick?: () => void;
  }) => {
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    // The model's prose sometimes embeds invented image URLs that 404 (see
    // AuthenticatedImage's onError). Collapse the whole wrapper (badge and
    // lightbox trigger included) rather than leaving an empty husk behind.
    const [hasError, setHasError] = useState(false);
    if (!src || hasError) return null;
    const showMcpBadge = isMcpProvenance(title);

    return (
      <>
        {/* span, not div: inline images render inside a markdown <p>, where a
            div would be invalid HTML and trigger React hydration warnings. */}
        <span
          className={cn(
            "relative",
            variant === "tile" ? "block w-full" : "inline-block",
          )}
        >
          <AuthenticatedImage
            src={src}
            alt={alt}
            onClick={onImageClick ?? (() => setIsLightboxOpen(true))}
            onError={() => setHasError(true)}
            data-testid="markdown-image"
            className={
              variant === "tile"
                ? "aspect-[4/3] w-full rounded-lg object-cover cursor-zoom-in"
                : "my-2 max-h-[400px] max-w-[480px] w-auto rounded-lg object-contain cursor-zoom-in"
            }
            // A gallery tile keeps its size while it is still a placeholder.
            placeholderClassName={
              variant === "tile"
                ? "my-0 flex aspect-[4/3] w-full justify-center"
                : undefined
            }
          />
          {showMcpBadge && <McpBadge title={title!} />}
        </span>
        {!onImageClick && (
          <ImageLightbox
            images={[{ src, alt, title }]}
            open={isLightboxOpen}
            onOpenChange={setIsLightboxOpen}
          />
        )}
      </>
    );
  },
  (prev, next) =>
    prev.src === next.src &&
    prev.alt === next.alt &&
    prev.title === next.title &&
    prev.variant === next.variant,
);
MarkdownImage.displayName = "MarkdownImage";

export type GalleryImage = { src: string; alt?: string; title?: string };

// When a paragraph contains only images (whitespace and <br> aside), returns
// their src/alt so they can be laid out as a gallery grid. Any meaningful text
// or fewer than two images returns null and the paragraph renders as usual.
// Reading the hast node (rather than sniffing React children) keeps detection
// stable while the answer streams in token by token.
export const extractGalleryImages = (
  node: HastElement | undefined,
): GalleryImage[] | null => {
  if (!node) return null;
  const images: GalleryImage[] = [];
  for (const child of node.children) {
    if (child.type === "text") {
      if (child.value.trim() !== "") return null;
      continue;
    }
    if (child.type === "element") {
      if (child.tagName === "br") continue;
      if (
        child.tagName === "img" &&
        typeof child.properties?.src === "string"
      ) {
        images.push({
          src: child.properties.src,
          alt:
            typeof child.properties.alt === "string"
              ? child.properties.alt
              : undefined,
          title:
            typeof child.properties.title === "string"
              ? child.properties.title
              : undefined,
        });
        continue;
      }
      return null;
    }
  }
  return images.length >= 2 ? images : null;
};

