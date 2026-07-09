import React, { useState } from "react";
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

// Renders both `![]()` markdown images and raw `<img>` (rehype-raw routes both
// through the `img` override). Memoized on src+alt so it doesn't re-render — and
// re-fetch its blob — on every streamed token. Clicking opens a lightbox.
// The `tile` variant is used inside the gallery grid: uniform cropped
// thumbnails instead of the free-flowing inline size.
const MarkdownImage = React.memo(
  ({
    src,
    alt,
    variant = "inline",
  }: {
    src?: string;
    alt?: string;
    variant?: "inline" | "tile";
  }) => {
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    if (!src) return null;

    return (
      <>
        <AuthenticatedImage
          src={src}
          alt={alt}
          onClick={() => setIsLightboxOpen(true)}
          data-testid="markdown-image"
          className={
            variant === "tile"
              ? "aspect-[4/3] w-full rounded-lg object-cover cursor-zoom-in"
              : "my-2 max-h-[400px] max-w-[480px] w-auto rounded-lg object-contain cursor-zoom-in"
          }
        />
        <ImageLightbox
          src={src}
          alt={alt}
          open={isLightboxOpen}
          onOpenChange={setIsLightboxOpen}
        />
      </>
    );
  },
  (prev, next) =>
    prev.src === next.src &&
    prev.alt === next.alt &&
    prev.variant === next.variant,
);
MarkdownImage.displayName = "MarkdownImage";

type GalleryImage = { src: string; alt?: string };

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
  const [copiedContent, setCopiedContent] = useState<string | null>(null);

  // Base styles for all text elements
  const baseText = cn("text-natural-200 leading-6", className);
  const baseBlock = cn(baseText, "mb-4 last:mb-0");
  const baseHeading = cn(baseText, "font-bold");

  const components: Components = {
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
    img: ({ src, alt }) => (
      <MarkdownImage
        src={typeof src === "string" ? src : undefined}
        alt={typeof alt === "string" ? alt : undefined}
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
        copyToClipboard(content);
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
                variant="tile"
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
  };

  // Prepare content to handle LaTeX delimiters
  const preparedText = prepareLatexContent(text);

  return (
    <div className={cn(baseText, "smarttext", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={components}
      >
        {preparedText}
      </ReactMarkdown>
    </div>
  );
};

export default SmartText;
