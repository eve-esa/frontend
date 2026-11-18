import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultRehypePlugins,
  Streamdown,
  type Components,
  type DiagramPlugin,
  type MathPlugin,
  type PluginConfig,
} from "streamdown";
import { defaultUrlTransform } from "react-markdown";
import rehypeSanitize, { type Options as SanitizeSchema } from "rehype-sanitize";
import type { Pluggable } from "unified";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { mermaidConfigFor } from "@/utilities/mermaidTheme";
import { hardenMermaidSvg, sanitizeMermaid } from "@/utilities/mermaidSanitize";
import { sanitizeSchema } from "@/utilities/markdownSanitize";
import { escapePowerStars } from "@/utilities/escapePowerStars";
import { prepareLatexContent } from "@/utilities/prepareLatexContent";
import { stripArtifactMetadata } from "@/utilities/stripArtifactMetadata";
import {
  MATH_PENDING_CLASS,
  MATH_PENDING_DISPLAY_CLASS,
  scanMath,
  withMathPlaceholders,
} from "@/utilities/streamingMath";
import { skeletonBarClass } from "./SmartTextSkeleton";
import { ImageLightbox } from "./ImageLightbox";
import MermaidFallback from "./MermaidFallback";
import { extractGalleryImages, MarkdownImage, type GalleryImage } from "./MarkdownImage";
import {
  ArtifactDownloadChip,
  isArtifactDownloadLink,
} from "./ArtifactDownloadChip";
import type { MarkerInstance } from "@/utilities/citations";
import {
  CiteOverride,
  DivOverride,
  citationRehypePlugin,
} from "@/components/chat/citations/AnswerMarkers";

type StreamdownTextProps = {
  text: string;
  className?: string;
  /** The answer is still arriving: an unclosed formula is held back. */
  isStreaming?: boolean;
  /** Inline citation markers placed in `text` as placeholders (see SmartText). */
  markers?: readonly MarkerInstance[];
};

// Raw HTML is parsed, then sanitized with the same strict schema as SmartText:
// no script, no event handlers, no inline style, links limited to http, https
// and mailto. The only addition is the two fixed classes of the formula
// placeholder that withMathPlaceholders writes. The default Streamdown list
// also carries rehype-harden with every prefix and protocol allowed, which
// adds nothing over this schema, so it is left out. The math plugin's
// rehype-katex runs after the sanitizer (Streamdown appends it), on markup
// KaTeX itself produced with `trust` off.
const streamdownSanitizeSchema: SanitizeSchema = {
  ...sanitizeSchema,
  attributes: {
    ...sanitizeSchema.attributes,
    span: [
      ...(sanitizeSchema.attributes?.span ?? []),
      ["className", MATH_PENDING_CLASS, MATH_PENDING_DISPLAY_CLASS],
    ],
  },
};
const rehypePlugins: Pluggable[] = [
  defaultRehypePlugins.raw,
  [rehypeSanitize, streamdownSanitizeSchema],
];

// Mermaid is about 1 MB of code: the plugin and mermaid itself load on the
// first diagram, never with the answer renderer. Streamdown hands the theme
// config (the `mermaid` prop) to getMermaid; it is applied right before each
// render, because mermaid is one global instance. securityLevel stays strict
// whatever the config says.
type MermaidInstance = ReturnType<DiagramPlugin["getMermaid"]>;
type MermaidConfig = Parameters<MermaidInstance["initialize"]>[0];
let mermaidInstance: Promise<MermaidInstance> | null = null;
const loadMermaid = (): Promise<MermaidInstance> => {
  mermaidInstance ??= import("@streamdown/mermaid").then(({ createMermaidPlugin }) =>
    createMermaidPlugin({ config: { theme: "dark", securityLevel: "strict" } }).getMermaid(),
  );
  return mermaidInstance;
};
// A fenced mermaid block anywhere in the answer, closed or still streaming.
const hasMermaidFence = (text: string) => /^ {0,3}(`{3,}|~{3,})\s*mermaid\b/m.test(text);
const strict = (config: MermaidConfig): MermaidConfig => ({ ...config, securityLevel: "strict" });
export const lazyMermaid: DiagramPlugin = {
  name: "mermaid",
  type: "diagram",
  language: "mermaid",
  getMermaid(config) {
    return {
      initialize(next) {
        void loadMermaid().then((m) => m.initialize(strict(next)));
      },
      // Unquoted labels with brackets or quotes are quoted first; a diagram
      // that still fails is logged at debug level only and Streamdown shows
      // MermaidFallback instead of the error. A `click` link in the diagram
      // opens in a new tab, never in place of the app (hardenMermaidSvg).
      async render(id, source) {
        const m = await loadMermaid();
        if (config) m.initialize(strict(config));
        try {
          const result = await m.render(id, sanitizeMermaid(source));
          return { ...result, svg: hardenMermaidSvg(result.svg) };
        } catch (error) {
          console.debug("Mermaid diagram not rendered", error);
          throw error;
        }
      },
    };
  },
};

// The math plugin pulls remark-math, rehype-katex and katex: loaded the first
// time an answer contains a formula, or earlier through preloadSmartText. Until
// it arrives each formula shows a placeholder bar, then the block re-renders
// with KaTeX.
let mathPlugin: MathPlugin | null = null;
let mathLoading: Promise<MathPlugin> | null = null;
export const loadMathPlugin = (): Promise<MathPlugin> => {
  mathLoading ??= Promise.all([
    import("@streamdown/math"),
    import("katex/dist/katex.min.css"),
  ]).then(([{ createMathPlugin }]) => {
    // singleDollarTextMath: remark-math's default, which SmartText relies on.
    // errorColor: invalid LaTeX in the danger colour of each theme (light
    // Excite Red +1, dark Excite Red -1); the plugin's default points at a
    // token the app does not define.
    mathPlugin = createMathPlugin({
      singleDollarTextMath: true,
      errorColor: "var(--color-danger-300)",
    });
    return mathPlugin;
  });
  return mathLoading;
};
const useMathPlugin = (needed: boolean): MathPlugin | null => {
  const [plugin, setPlugin] = useState<MathPlugin | null>(mathPlugin);
  useEffect(() => {
    if (!needed || plugin) return;
    let live = true;
    void loadMathPlugin().then((p) => live && setPlugin(p));
    return () => {
      live = false;
    };
  }, [needed, plugin]);
  return plugin;
};

// The placeholder of a held-back or not yet renderable formula: one bar on
// the line rhythm for display math, a short inline bar for inline math.
const MathPending = ({ display }: { display: boolean }) => (
  <span
    data-testid="streamdown-math-pending"
    aria-hidden="true"
    className={cn(
      skeletonBarClass,
      display ? "block h-4 my-1 w-40 max-w-full" : "inline-block h-4 w-12 align-middle",
    )}
  />
);

const StreamdownText: React.FC<StreamdownTextProps> = ({
  text,
  className,
  isStreaming = false,
  markers,
}) => {
  // Inline citations: one stable rehype step after the sanitizer, reading the
  // live marker list through a ref while the answer streams.
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const withMarkers = markers !== undefined;
  const answerRehypePlugins = useMemo<Pluggable[]>(
    () => (withMarkers ? [...rehypePlugins, citationRehypePlugin(() => markersRef.current)] : rehypePlugins),
    [withMarkers],
  );
  const [galleryLightbox, setGalleryLightbox] = useState<{
    images: GalleryImage[];
    index: number;
  } | null>(null);

  // prepareLatexContent turns \( \) and \[ \] into $ and $$, as for SmartText;
  // escapePowerStars keeps `3**50` literal instead of opening bold.
  const preparedText = useMemo(
    () => escapePowerStars(prepareLatexContent(stripArtifactMetadata(text))),
    [text],
  );
  const mathSegments = useMemo(() => scanMath(preparedText), [preparedText]);
  const math = useMathPlugin(mathSegments.length > 0);
  // A formula is never shown as LaTeX source: while the math chunk loads, and
  // while its closing delimiter has not streamed in yet, it is a placeholder.
  const renderedText = useMemo(
    () =>
      withMathPlaceholders(preparedText, mathSegments, {
        streaming: isStreaming,
        mathReady: math !== null,
      }),
    [preparedText, mathSegments, isStreaming, math],
  );

  const wantsMermaid = hasMermaidFence(preparedText);
  useEffect(() => {
    if (wantsMermaid) void loadMermaid();
  }, [wantsMermaid]);

  // Diagrams follow the app theme (dark, light, System). Streamdown's memo
  // compares `plugins` but not `mermaid`, so a new plugins object goes with a
  // new config: that re-renders the answer and its diagrams redraw.
  const { resolved: theme } = useTheme();
  const mermaid = useMemo(
    () => ({ config: mermaidConfigFor(theme), errorComponent: MermaidFallback }),
    [theme],
  );
  const plugins: PluginConfig = useMemo(
    () => (math ? { math, mermaid: lazyMermaid } : { mermaid: lazyMermaid }),
    [math, mermaid],
  );

  // Same classes as SmartText, so both themes keep their tokens.
  const baseText = cn("text-natural-200 leading-6", className);
  const baseBlock = cn(baseText, "mb-4 last:mb-0");
  const baseHeading = cn(baseText, "font-bold");

  const components: Components = useMemo(() => ({
    // KaTeX output passes through unchanged; only the placeholder markup that
    // withMathPlaceholders writes becomes the MathPending bar.
    span: ({ node, ...props }) => {
      const raw = node?.properties?.className;
      const classes = Array.isArray(raw) ? raw.map(String) : [];
      if (classes.includes(MATH_PENDING_CLASS)) {
        return <MathPending display={classes.includes(MATH_PENDING_DISPLAY_CLASS)} />;
      }
      return <span {...props} />;
    },
    a: ({ href, children }) => {
      if (isArtifactDownloadLink(href)) {
        return (
          <ArtifactDownloadChip
            href={href!}
            filename={typeof children === "string" ? children : undefined}
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
            "text-success-200 in-data-[theme=light]:text-success-100 underline transition-colors",
          )}
        >
          {children}
        </a>
      );
    },
    img: ({ src, alt, title }) => (
      <MarkdownImage
        key={typeof src === "string" ? src : undefined}
        src={typeof src === "string" ? src : undefined}
        alt={typeof alt === "string" ? alt : undefined}
        title={typeof title === "string" ? title : undefined}
      />
    ),
    // Source markers and the blocks that hold them (inline citations).
    cite: CiteOverride,
    div: DivOverride,
    em: ({ children }) => <em className={cn(baseText, "italic")}>{children}</em>,
    strong: ({ children }) => (
      <strong className={cn(baseText, "font-bold")}>{children}</strong>
    ),
    inlineCode: ({ children }) => (
      <code
        data-testid="smart-text-inline-code"
        className={cn(baseText, "bg-primary-800/40 text-natural-200 px-1 rounded")}
      >
        {children}
      </code>
    ),
    p: ({ node, children }) => {
      const galleryImages = extractGalleryImages(node);
      if (galleryImages) {
        return (
          <div
            data-testid="markdown-image-gallery"
            className={cn(
              baseBlock,
              "grid max-w-[720px] grid-cols-2 gap-2",
              galleryImages.length > 2 && "sm:grid-cols-3",
            )}
          >
            {galleryImages.map((image, index) => (
              <MarkdownImage
                key={`${image.src}-${index}`}
                src={image.src}
                alt={image.alt}
                title={image.title}
                variant="tile"
                onImageClick={() => setGalleryLightbox({ images: galleryImages, index })}
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
          "list-disc list-outside pl-8 space-y-2 [&_ul]:list-[circle] [&_ul_ul]:list-[square]",
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
    li: ({ children }) => <li className={cn(baseBlock, "space-y-2")}>{children}</li>,
    h1: ({ children }) => <h1 className={cn(baseHeading, "text-2xl mb-4")}>{children}</h1>,
    h2: ({ children }) => <h2 className={cn(baseHeading, "text-lg mb-3")}>{children}</h2>,
    h3: ({ children }) => <h3 className={cn(baseHeading, "text-md mb-2")}>{children}</h3>,
    blockquote: ({ children }) => (
      <div className={cn(baseBlock, "border-l-4 border-primary-400 pl-4 italic text-natural-200")}>
        {children}
      </div>
    ),
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
      <tbody className="bg-primary-500/40 divide-y divide-natural-600">{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-primary-500/50 transition-colors">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left font-bold border-b border-natural-200">{children}</th>
    ),
    td: ({ children }) => <td className="px-4 py-2 border-b border-natural-200">{children}</td>,
  }), [baseText, baseBlock, baseHeading]);

  return (
    <div data-testid="streamdown-text" className={cn(baseText, "smarttext streamdown", className)}>
      <Streamdown
        mode="streaming"
        // Marks the last block's unclosed fence as incomplete while the
        // answer streams: MermaidFallback then shows the placeholder.
        isAnimating={isStreaming}
        rehypePlugins={answerRehypePlugins}
        // Streamdown's own transform keeps every URL; react-markdown's drops
        // javascript:, data: and other unsafe schemes from href and src.
        urlTransform={defaultUrlTransform}
        plugins={plugins}
        mermaid={mermaid}
        components={components}
        controls={{ code: true, table: false, mermaid: { copy: true, download: false, fullscreen: false, panZoom: false } }}
        linkSafety={{ enabled: false }}
      >
        {renderedText}
      </Streamdown>
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

export default React.memo(StreamdownText);
