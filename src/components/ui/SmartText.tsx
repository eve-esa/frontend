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
import rehypeSanitize from "rehype-sanitize";
import { sanitizeSchema } from "@/utilities/markdownSanitize";
import { cn } from "@/lib/utils";
import { prepareLatexContent } from "@/utilities/prepareLatexContent";
import { stripArtifactMetadata } from "@/utilities/stripArtifactMetadata";
import { ImageLightbox } from "./ImageLightbox";
import { extractGalleryImages, MarkdownImage, type GalleryImage } from "./MarkdownImage";
import {
  ArtifactDownloadChip,
  isArtifactDownloadLink,
} from "./ArtifactDownloadChip";
import "katex/dist/katex.min.css";
import type { Pluggable } from "unified";
import type { MarkerInstance } from "@/utilities/citations";
import {
  CiteOverride,
  DivOverride,
  citationRehypePlugin,
} from "@/components/chat/citations/AnswerMarkers";

type SmartTextProps = {
  text: string;
  className?: string;
  /** Read by StreamdownText only; react-markdown renders the same either way. */
  isStreaming?: boolean;
  /**
   * Inline citations (FEATURE_INLINE_CITATIONS): the markers `markCitations`
   * put in `text` as placeholders. With them the placeholders render as
   * source markers inside a `CitationsProvider`; without, nothing changes.
   */
  markers?: readonly MarkerInstance[];
};

const SmartText: React.FC<SmartTextProps> = ({ text, className, markers }) => {
  // Behind a ref: the rehype step below stays one stable plugin while the
  // marker list grows with the stream.
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const withMarkers = markers !== undefined;
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
          data-testid="smart-text-link"
          href={href}
          target="_blank"
          rel="noreferrer"
          className={cn(
            baseText,
            "text-success-200 in-data-[theme=light]:text-success-100 underline transition-colors"
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
      // a new position and remount, refetching its blob and flashing.
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
    // Source markers and the blocks that hold them (inline citations); a
    // `cite` or `div` from the text itself renders as before.
    cite: CiteOverride,
    div: DivOverride,
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
            "whitespace-pre-wrap break-words block bg-primary-800/40 p-4 pr-12 rounded-lg in-data-[theme=light]:bg-natural-900 my-4 overflow-x-auto relative group",
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
  // Inline citations add their step after the sanitizer, before KaTeX: the
  // marker elements are ours, never the model's.
  const rehypePlugins = useMemo<Pluggable[]>(
    () => [
      rehypeRaw,
      [rehypeSanitize, sanitizeSchema],
      ...(withMarkers ? [citationRehypePlugin(() => markersRef.current)] : []),
      rehypeKatex,
    ],
    [withMarkers],
  );

  const markdown = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        // Sanitize first, KaTeX last: the sanitizer keeps the
        // `language-math` class remark-math puts on formulas, and KaTeX's
        // generated markup (inline style included) is added after it.
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {preparedText}
      </ReactMarkdown>
    ),
    [preparedText, components, rehypePlugins],
  );

  return (
    <div data-testid="smart-text" className={cn(baseText, "smarttext", className)}>
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
