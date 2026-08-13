import React, { useMemo, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { useClipboard } from "@/hooks/useClipboard";
import { faCopy } from "@fortawesome/free-regular-svg-icons";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import type { Element as HastElement } from "hast";
import { cn } from "@/lib/utils";
import { prepareLatexContent } from "@/utilities/prepareLatexContent";
import { stripArtifactMetadata } from "@/utilities/stripArtifactMetadata";
import { AuthenticatedImage } from "./AuthenticatedImage";
import { ImageLightbox } from "./ImageLightbox";
import {
  ArtifactDownloadChip,
  isArtifactDownloadLink,
} from "./ArtifactDownloadChip";
import "katex/dist/katex.min.css";

type SmartTextProps = {
  text: string;
  className?: string;
};

// Elements/attributes rehype-katex emits (via its rendered HTML, parsed back
// into hast) that aren't part of GitHub's default sanitize schema. Needed so
// rehype-sanitize (which runs after rehype-raw) doesn't strip KaTeX markup.
const katexTagNames = [
  "svg",
  "path",
  "math",
  "semantics",
  "annotation",
  "mrow",
  "mi",
  "mo",
  "mn",
  "msup",
  "msub",
  "mfrac",
  "mroot",
  "msqrt",
  "mtext",
  "mspace",
  "munder",
  "mover",
  "munderover",
  "mtable",
  "mtr",
  "mtd",
  "line",
  "g",
  "defs",
  "use",
];

// Presentational SVG/MathML attributes: safe to allow anywhere, they can't
// trigger navigation or script execution.
const katexAttributes = [
  "className",
  "ariaHidden",
  "viewBox",
  "xmlns",
  "xmlnsXLink",
  "d",
  "fill",
  "stroke",
  "preserveAspectRatio",
  "focusable",
  "role",
  "encoding",
  "mathvariant",
];

// `style` is excluded from the default schema (raw CSS is an XSS/clickjacking
// vector), but KaTeX relies on inline `style` for spacing/sizing. Only allow
// it on the tags KaTeX actually renders, not on links/images/etc.
const katexStyleTagNames = ["span", ...katexTagNames];

// Extends GitHub's default sanitize schema (which already covers GFM tables,
// lists, code blocks, images, etc.) with what KaTeX needs, and locks link
// protocols down to kill `javascript:`/`data:` hrefs (SEC-5).
const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...katexTagNames],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), ...katexAttributes],
    ...Object.fromEntries(
      katexStyleTagNames.map((tag) => [
        tag,
        [...(defaultSchema.attributes?.[tag] ?? []), "style"],
      ])
    ),
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
  },
};

// Markdown title of the form "MCP: {server}/{tool}" (or just "MCP") marks a
// stub image the backend generated from an MCP tool call, per the backend
// contract — used to render the provenance pill below.
const isMcpProvenance = (title: string | undefined): boolean =>
  Boolean(title?.toLowerCase().startsWith("mcp"));

// Small provenance pill, styled to match ArtifactCard's source label
// (src/pages/artifacts/ArtifactCard.tsx). Shows "MCP"; the full title (e.g.
// "MCP: filesystem/read_file") is available as a tooltip.
const McpBadge = ({ title }: { title: string }) => (
  <span
    title={title}
    className="absolute left-2 top-2 rounded-full border border-primary-400 bg-natural-1000/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-natural-50"
  >
    MCP
  </span>
);

// Renders both `![]()` markdown images and raw `<img>` (rehype-raw routes both
// through the `img` override). Memoized on src+alt+title so it doesn't
// re-render — and re-fetch its blob — on every streamed token. The `tile`
// variant is used inside the gallery grid: uniform cropped thumbnails instead
// of the free-flowing inline size.
//
// Clicking normally opens this image's own lightbox. When `onImageClick` is
// passed (the gallery-grid case), it defers to the caller instead so a whole
// paragraph of images can share one lightbox instance with next/prev nav.
const MarkdownImage = React.memo(
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
    // AuthenticatedImage's onError). Collapse the whole wrapper — badge and
    // lightbox trigger included — rather than leaving an empty husk behind.
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

type GalleryImage = { src: string; alt?: string; title?: string };

// When a paragraph contains only images (whitespace and <br> aside), returns
// their src/alt so they can be laid out as a gallery grid. Any meaningful text
// or fewer than two images returns null and the paragraph renders as usual.
// Reading the hast node (rather than sniffing React children) keeps detection
// stable while the answer streams in token by token.
const extractGalleryImages = (
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

const SmartText: React.FC<SmartTextProps> = ({ text, className }) => {
  const { copyToClipboard } = useClipboard();
  // useClipboard returns a fresh function each render; keep it behind a ref so
  // the memoized `components` below don't churn on every streamed frame.
  const copyRef = useRef(copyToClipboard);
  copyRef.current = copyToClipboard;
  const [copiedContent, setCopiedContent] = useState<string | null>(null);
  // Single shared lightbox for gallery-grid paragraphs (2+ images): clicking
  // any tile opens the same instance seeded with the full image list and the
  // clicked index, so prev/next can navigate across the whole gallery.
  const [galleryLightbox, setGalleryLightbox] = useState<{
    images: GalleryImage[];
    index: number;
  } | null>(null);

  // Base styles for all text elements
  const baseText = cn("text-natural-200 leading-6", className);
  const baseBlock = cn(baseText, "mb-4 last:mb-0");
  const baseHeading = cn(baseText, "font-bold");

  // Memoized so its identity is stable across streamed frames: the markdown
  // element below is keyed on it, so a stable `components` lets an unchanged
  // text skip a full reparse. Only interaction state (a code block being
  // copied) and the theme-independent styles change it.
  const components: Components = useMemo(() => ({
    a: ({ href, children }) => {
      if (isArtifactDownloadLink(href)) {
        return (
          <ArtifactDownloadChip
            href={href!}
            filename={
              typeof children === "string" ? children : undefined
            }
          />
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={cn(
            baseText,
            "text-success-200 hover:text-success-300 underline transition-colors"
          )}
        >
          {children}
        </a>
      );
    },
    img: ({ src, alt, node }) => (
      // Keyed by src: react-markdown reparses the whole tree on every
      // streamed token with no keys of its own, so React falls back to
      // positional reconciliation. If a sibling earlier in the paragraph
      // changes shape (e.g. a soft break turns into a paragraph break as
      // more text streams in), an already-rendered image can get bumped to
      // a new position and remount — refetching its blob and flashing.
      // Keying by src lets React match it back up regardless of position.
      <MarkdownImage
        key={typeof src === "string" ? src : undefined}
        src={typeof src === "string" ? src : undefined}
        alt={typeof alt === "string" ? alt : undefined}
        title={
          typeof node?.properties?.title === "string"
            ? node.properties.title
            : undefined
        }
      />
    ),
    em: ({ children }) => (
      <em className={cn(baseText, "italic")}>{children}</em>
    ),
    strong: ({ children }) => (
      <strong className={cn(baseText, "font-bold")}>{children}</strong>
    ),
    br: () => <br />,
    code: (props) => {
      const { className, children, ...rest } = props;

      // Check if it's a block code by looking at the content
      const content = String(children);
      const isBlockCode = content.includes("\n") || content.length > 50;

      if (!isBlockCode) {
        return (
          <code
            className={cn(
              baseText,
              "bg-primary-800/40 text-natural-200 px-1 rounded",
              className
            )}
            {...rest}
          >
            {children}
          </code>
        );
      }

      const handleCopy = () => {
        copyRef.current(content);
        setCopiedContent(content);
        // Reset copied state after 1 second
        setTimeout(() => {
          setCopiedContent(null);
        }, 1000);
      };

      return (
        <code
          className={cn(
            baseText,
            "whitespace-pre-wrap break-words block bg-primary-800/40 p-4 pr-12 rounded-lg my-4 overflow-x-auto relative group",
            className
          )}
          {...rest}
        >
          {children}
          <span
            onClick={handleCopy}
            className="absolute top-2 right-2 p-2 cursor-pointer rounded-lg transition-colors"
          >
            {copiedContent === content ? (
              <FontAwesomeIcon
                icon={faCheck}
                className="w-4 h-4 text-primary-300"
              />
            ) : (
              <FontAwesomeIcon
                icon={faCopy}
                className="w-4 h-4 text-primary-300"
              />
            )}
          </span>
        </code>
      );
    },
    p: ({ node, children }) => {
      const content = React.Children.toArray(children);
      if (
        content.length === 1 &&
        React.isValidElement(content[0]) &&
        content[0].type === "pre"
      ) {
        return <>{content[0]}</>;
      }
      const galleryImages = extractGalleryImages(node);
      if (galleryImages) {
        return (
          <div
            data-testid="markdown-image-gallery"
            className={cn(
              baseBlock,
              "grid max-w-[720px] grid-cols-2 gap-2",
              galleryImages.length > 2 && "sm:grid-cols-3"
            )}
          >
            {galleryImages.map((image, index) => (
              <MarkdownImage
                key={`${image.src}-${index}`}
                src={image.src}
                alt={image.alt}
                title={image.title}
                variant="tile"
                onImageClick={() =>
                  setGalleryLightbox({ images: galleryImages, index })
                }
              />
            ))}
          </div>
        );
      }
      return <p className={cn(baseBlock, "whitespace-pre-wrap")}>{children}</p>;
    },
    ul: ({ children }) => (
      <ul
        className={cn(
          baseBlock,
          "list-disc list-outside pl-8 space-y-2 [&_ul]:list-[circle] [&_ul_ul]:list-[square]"
        )}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className={cn(baseBlock, "list-decimal list-outside pl-8 space-y-2")}>
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className={cn(baseBlock, "space-y-2")}>{children}</li>
    ),
    h1: ({ children }) => (
      <h1 className={cn(baseHeading, "text-2xl mb-4")}>{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className={cn(baseHeading, "text-lg mb-3")}>{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className={cn(baseHeading, "text-md mb-2")}>{children}</h3>
    ),
    blockquote: ({ children }) => {
      // Convert blockquote to div to avoid nesting issues
      return (
        <div
          className={cn(
            baseBlock,
            "border-l-4 border-primary-400 pl-4 italic text-natural-200"
          )}
        >
          {children}
        </div>
      );
    },
    hr: () => <hr className="my-6 border-natural-200" />,
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border border-natural-200 rounded-lg divide-y divide-natural-200">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-primary-500/20 text-natural-100">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="bg-primary-500/40 divide-y divide-natural-600">
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-primary-500/50 transition-colors">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left font-bold border-b border-natural-200">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 border-b border-natural-200">{children}</td>
    ),
  }), [copiedContent, baseText, baseBlock, baseHeading]);

  // Prepare content to handle LaTeX delimiters. Memoized on `text` so the
  // markdown element below only rebuilds when the text actually grows.
  const preparedText = useMemo(
    () => prepareLatexContent(stripArtifactMetadata(text)),
    [text],
  );

  // The heavy bit: parsing markdown + GFM + KaTeX. Keyed on the text and the
  // component overrides, so a re-render that doesn't change either (e.g. a
  // parent re-render on a frame that appended nothing) reuses the same element
  // and React skips reconciling the whole tree.
  const markdown = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={components}
      >
        {preparedText}
      </ReactMarkdown>
    ),
    [preparedText, components],
  );

  return (
    <div className={cn(baseText, "smarttext", className)}>
      {markdown}
      {galleryLightbox && (
        <ImageLightbox
          images={galleryLightbox.images}
          initialIndex={galleryLightbox.index}
          open={Boolean(galleryLightbox)}
          onOpenChange={(open) => !open && setGalleryLightbox(null)}
        />
      )}
    </div>
  );
};

// Memoized so a parent re-render with the same `text`/`className` (the chat list
// re-rendering on every smooth-stream frame) doesn't reparse the markdown tree.
export default React.memo(SmartText);
