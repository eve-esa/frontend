import { Fragment, useEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { useClipboard } from "@/hooks/useClipboard";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  citationText,
  doiOf,
  externalHref,
  isUserFile,
  locatorValue,
  metaValue,
  plainPassage,
  sourceTitle,
  truncateMiddle,
  type Citation,
  type CitationSource,
} from "@/utilities/citations";
import { FOCUSABLE, OPENER_ATTR, useCitations } from "./CitationsContext";
import { CopyIcon, LockIcon, OpenIcon, PageIcon, ProviderSlug } from "./SourceLook";

/**
 * The source card (spec 4.4 to 4.7): provider row with the number, title,
 * passage, locator, Open and Copy citation. At most 320 px, anchored to the
 * element that opened it from md up, in place under its line on a phone. Colours from
 * BRAND.md: surface primary-600 (ESA white in light, `#001923` dark), edge
 * primary-400 ("Card edge"), text natural-50, secondary primary-300, links
 * success-200 dark and success-100 light ("Link text", Pure Teal +2), own
 * files trace-agent.
 */

const MUTED = "text-primary-300";
const LINK =
  "inline-flex items-center gap-1 text-xs text-success-200 underline in-data-[theme=light]:text-success-100 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const QUIET =
  "inline-flex cursor-pointer items-center gap-1 text-xs text-primary-300 hover:text-natural-50 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export const NewTabNote = () => <span className="sr-only"> (opens in a new tab)</span>;

/** Passages longer than this fold to four lines with a toggle. */
const LONG_PASSAGE = 220;

/**
 * The passage, as plain text, with the supporting span marked when the
 * Source carries one; a long one folds to four lines (spec 4.4: an excerpt
 * that expands to the passage).
 */
const Passage = ({ source }: { source: CitationSource }) => {
  const [expanded, setExpanded] = useState(false);
  const raw = source.passage?.trim();
  if (!raw) return null;
  const passage = plainPassage(raw);
  const span = passage === raw ? source.highlight?.[0] : undefined;
  const long = passage.length > LONG_PASSAGE;
  let body: ReactNode = passage;
  if (span) {
    const cps = [...passage];
    const [start, end] = span;
    if (start >= 0 && end > start && end <= cps.length) {
      body = (
        <>
          {cps.slice(0, start).join("")}
          <mark className="bg-highlight text-natural-50">{cps.slice(start, end).join("")}</mark>
          {cps.slice(end).join("")}
        </>
      );
    }
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <blockquote
        data-testid="source-passage"
        className={cn(
          "m-0 border-l-2 border-primary-400 py-0.5 pl-2.5 text-[13px] leading-5 whitespace-pre-line break-words text-natural-50",
          long && !expanded && "line-clamp-4",
        )}
      >
        {body}
      </blockquote>
      {long && (
        <button
          type="button"
          data-testid="source-passage-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className={cn(QUIET, "pl-3")}
        >
          {expanded ? "Show less" : "Show the whole passage"}
        </button>
      )}
    </div>
  );
};

const dateTime = (iso: string | null): string | null => {
  if (!iso) return null;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]} UTC` : iso;
};

const cloudCover = (source: CitationSource): string | null => {
  const raw = source.meta?.cloud_cover ?? source.locator?.cloud_cover;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return `${Math.round(raw * 10) / 10} %`;
};

/** Page, section, table, lines; mono for ids. */
const Locator = ({ source }: { source: CitationSource }) => {
  const parts: [string, string][] = [];
  const page = locatorValue(source, "page");
  const pageEnd = locatorValue(source, "page_end");
  if (page) parts.push(["Page", pageEnd && pageEnd !== page ? `${page} to ${pageEnd}` : page]);
  const section = locatorValue(source, "section");
  if (section) parts.push(["Section", section]);
  const table = locatorValue(source, "table");
  if (table) parts.push(["Table", table]);
  const lineStart = locatorValue(source, "line_start");
  const lineEnd = locatorValue(source, "line_end");
  if (lineStart) parts.push(["Lines", lineEnd && lineEnd !== lineStart ? `${lineStart} to ${lineEnd}` : lineStart]);
  const doi = doiOf(source);
  if (doi) parts.push(["DOI", doi]);
  if (parts.length === 0) return null;
  return (
    <div data-testid="source-locator" className={cn("flex flex-wrap gap-x-3 gap-y-1 text-xs", MUTED)}>
      {parts.map(([label, value]) => (
        <span key={label}>
          {label}{" "}
          <span className={cn("text-natural-50 tabular-nums", label === "DOI" && "font-mono break-all")}>{value}</span>
        </span>
      ))}
    </div>
  );
};

const StacScene = ({ source }: { source: CitationSource }) => {
  const collection = locatorValue(source, "stac_collection");
  const acquired = dateTime(locatorValue(source, "datetime") ?? metaValue(source, "datetime"));
  const cloud = cloudCover(source);
  const item = locatorValue(source, "stac_item_id");
  return (
    <>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2.5 text-xs leading-5">
        {collection && (
          <>
            <dt className={MUTED}>Collection</dt>
            <dd className="m-0 min-w-0 font-mono break-all text-natural-50">{collection}</dd>
          </>
        )}
        {acquired && (
          <>
            <dt className={MUTED}>Acquired</dt>
            <dd className="m-0 min-w-0 tabular-nums break-words text-natural-50">{acquired}</dd>
          </>
        )}
        {cloud && (
          <>
            <dt className={MUTED}>Cloud cover</dt>
            <dd className="m-0 tabular-nums text-natural-50">{cloud}</dd>
          </>
        )}
      </dl>
      {item && (
        <div data-testid="source-locator" className={cn("flex items-start gap-1 text-xs", MUTED)}>
          <span className="min-w-0">
            STAC item <span className="font-mono break-all text-natural-50">{item}</span>
          </span>
          <CopyButton value={item} label="Copy item id" testId="source-copy-item-id" className="-mt-1.5" />
        </div>
      )}
    </>
  );
};

/** The meta line under the title: venue and year, or where a user file lives. */
const metaLine = (source: CitationSource): string | null => {
  if (isUserFile(source)) return null;
  const parts = [metaValue(source, "venue"), metaValue(source, "year") ?? metaValue(source, "published")];
  const line = parts.filter(Boolean).join(", ");
  return line || null;
};

const openLabel = (source: CitationSource): string =>
  source.kind === "stac_item" ? "Open item" : source.kind === "web_page" ? "Open page" : "Open source";

/**
 * Open: outside EVE in a new tab (http or https only), or, for the user's
 * file, the My collections panel. The artifact view at the page does not
 * exist yet, so the card says where Open goes and never links to nothing.
 */
const OpenAction = ({ source }: { source: CitationSource }) => {
  const citations = useCitations();
  if (isUserFile(source)) {
    const open = citations?.onOpenMyCollections;
    const hintId = `${citations?.scope ?? "s"}-${source.id}-open-hint`;
    return (
      <span className="inline-flex items-center gap-2">
        {open && (
          <button
            type="button"
            data-testid="source-open"
            aria-describedby={hintId}
            className={cn(LINK, "cursor-pointer")}
            onClick={open}
          >
            <PageIcon className="size-3" />
            Open
          </button>
        )}
        <span id={hintId} data-testid="source-open-hint" className={cn("text-xs", MUTED)}>
          Opens in My collections
        </span>
      </span>
    );
  }
  const href = externalHref(source);
  if (!href) return null;
  return (
    <a data-testid="source-open" href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
      <OpenIcon className="size-3" />
      {openLabel(source)}
      <NewTabNote />
    </a>
  );
};

const CopyCitation = ({ source }: { source: CitationSource }) => {
  const { copyToClipboard, isCopied } = useClipboard();
  return (
    <button
      type="button"
      data-testid="source-copy-citation"
      className={QUIET}
      onClick={() => void copyToClipboard(citationText(source))}
    >
      <CopyIcon className="size-3" />
      {isCopied ? "Copied" : "Copy citation"}
    </button>
  );
};

/** The number chip at the right of the provider row (decorative: the dialog is named). */
const NumberChip = ({ n }: { n: number }) => (
  <span
    aria-hidden="true"
    className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-[4px] bg-primary-500 px-1 text-[11px] leading-[14px] tabular-nums text-natural-50"
  >
    {n}
  </span>
);

const ProviderRow = ({ source, n }: { source: Citation; n: number }) => (
  <div className="flex flex-wrap items-center gap-2 text-xs">
    <ProviderSlug source={source} testId="source-provider" />
    <NumberChip n={n} />
  </div>
);

export const FileName = ({ source, max, className }: { source: CitationSource; max: number; className?: string }) => {
  const full = sourceTitle(source);
  return (
    <span data-testid="source-file-name" title={full} className={cn("[overflow-wrap:anywhere]", className)}>
      {truncateMiddle(full, max)}
    </span>
  );
};

/**
 * The body of one source: title, meta, passage or scene, locator, actions.
 * `compact` (an item of a range card) keeps the provider row, the title, the
 * meta line and the actions.
 */
const SourceBody = ({ source, n, compact = false }: { source: Citation; n: number; compact?: boolean }) => {
  const meta = metaLine(source);
  const own = isUserFile(source);
  return (
    <>
      <ProviderRow source={source} n={n} />
      <p className="m-0 line-clamp-2 text-sm leading-5 font-semibold [overflow-wrap:anywhere] text-natural-50">
        {own ? <FileName source={source} max={40} /> : sourceTitle(source)}
      </p>
      {meta && <p className={cn("m-0 text-xs leading-[18px] break-words", MUTED)}>{meta}</p>}
      {!compact && (source.kind === "stac_item" ? <StacScene source={source} /> : <Passage source={source} />)}
      {!compact && source.kind !== "stac_item" && <Locator source={source} />}
      {own && !compact && (
        <p className={cn("m-0 flex items-center gap-1.5 text-xs", MUTED)}>
          <LockIcon className="size-3 flex-none" />
          Your file: only you can see it.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4 border-t border-primary-400 pt-2">
        <OpenAction source={source} />
        <CopyCitation source={source} />
      </div>
    </>
  );
};

/** One entry per number, the first passage standing for its document. */
const byNumber = (entries: readonly Citation[]): Citation[] => {
  const seen = new Set<number>();
  return entries.filter((entry) => (seen.has(entry.n) ? false : (seen.add(entry.n), true)));
};

export const SourceCard = ({
  id,
  entries,
  ...rest
}: { id: string; entries: readonly Citation[]; ref?: Ref<HTMLDivElement> } & Omit<HTMLAttributes<HTMLDivElement>, "id">) => {
  const citations = useCitations();
  const sources = byNumber(entries);
  if (!citations || sources.length === 0) return null;
  const single = sources.length === 1 ? sources[0] : null;
  const own = single ? isUserFile(single) : false;
  const label = single
    ? `Source ${single.n}: ${sourceTitle(single)}`
    : `Sources ${sources[0].n} to ${sources[sources.length - 1].n}`;
  // Tab stays in the card: past the last control it wraps to the first, and
  // Shift+Tab from the first goes back to the marker that opened it.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const active = document.activeElement;
      if (items.length > 0 && event.shiftKey && active === items[0]) {
        event.preventDefault();
        citations.focusOpener(id);
      } else if (items.length > 0 && !event.shiftKey && active === items[items.length - 1]) {
        event.preventDefault();
        items[0].focus();
      }
    }
    if (!event.defaultPrevented) rest.onKeyDown?.(event);
  };
  return (
    <div
      {...rest}
      id={citations.cardId(id)}
      role="dialog"
      aria-label={label}
      data-testid="source-card"
      data-kind={single?.kind ?? "group"}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn(
        "box-border flex max-h-[min(480px,70vh)] w-full flex-col gap-2 overflow-y-auto border border-primary-400 bg-primary-600 px-3.5 py-3 text-[13px] leading-5 text-natural-50 outline-none md:w-80",
        own && "border-l-2 border-l-trace-agent",
        rest.className,
      )}
    >
      {single ? (
        <SourceBody source={single} n={single.n} />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {sources.map((source) => (
            <li key={source.n} data-testid="source-card-item" className="flex flex-col gap-2 border-b border-primary-400 pb-3 last:border-b-0 last:pb-0">
              <SourceBody source={source} n={source.n} compact />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const EDGE = 16;

/** Top of the composer box when it sits inside the viewport. */
const composerTop = (): number | null => {
  const top = document.querySelector('[data-testid="composer-box"]')?.getBoundingClientRect().top;
  return top && top > 0 && top < window.innerHeight ? top : null;
};

/** Room the card keeps from the edges of its boundary (the chat scroller, else the viewport), the composer included at the bottom. */
const collisionPadding = (boundary: HTMLElement | null) => {
  const top = composerTop();
  const edge = boundary ? boundary.getBoundingClientRect().bottom : window.innerHeight;
  const bottom = top !== null && top < edge ? edge - top + EDGE / 2 : EDGE;
  return { top: EDGE, right: EDGE, left: EDGE, bottom };
};

/** The nearest ancestor that scrolls vertically: the chat scroller for an answer. */
const scrollerOf = (element: HTMLElement): HTMLElement | null => {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
};

/**
 * On a phone the card sits in place under its line, so near the end of an
 * answer it can open under the composer or past the viewport. Scroll the
 * chat until its bottom is EDGE / 2 above the composer (or the scroller's
 * bottom), never so far that its top leaves the scroller. Focus is not
 * touched; reduced motion scrolls at once.
 */
const revealCard = (card: HTMLElement) => {
  const scroller = scrollerOf(card);
  if (!scroller) return;
  const box = card.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  const limit = Math.min(composerTop() ?? Infinity, view.bottom, window.innerHeight);
  const delta = Math.min(box.bottom + EDGE / 2 - limit, box.top - view.top);
  if (delta <= 0) return;
  const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = reduce ? "instant" : "smooth";
  if (typeof scroller.scrollBy === "function") scroller.scrollBy({ top: delta, behavior });
  else scroller.scrollTop += delta;
};

/**
 * The open card of one place (an answer block, a sources list item, a step's
 * chips), as a controlled Radix popover anchored to the element that opened
 * it. Only the place that owns `openId` mounts it, so a long chat holds one
 * popover, not one per marker. The anchor is looked up by id each time Radix
 * reads it, so a marker remounted by a streaming re-render keeps the card in
 * place. From md up the content goes to a portal on the dialog layer (z-50),
 * flips and shifts inside the chat scroller and clear of the composer, and
 * hides while its marker is scrolled out of the chat; on a phone it sits in
 * place under the line and the chat scrolls it into view above the composer.
 * Escape closes it only from inside the card or from its marker; a click
 * outside closes it, a press on another opener is not outside, so the card
 * swaps in one render. Focus goes back to the opener on Escape, on a second
 * click and on a click outside that lands on nothing focusable.
 */
export const CardPopover = ({ id, entries }: { id: string; entries: readonly Citation[] }) => {
  const citations = useCitations();
  const skipRestore = useRef(false);
  const desktop = citations?.desktop ?? true;
  const cardDomId = citations ? citations.cardId(id) : null;
  // Under md, on open and on every swap, bring the card above the composer.
  useEffect(() => {
    if (desktop || !cardDomId) return;
    const card = document.getElementById(cardDomId);
    if (card) revealCard(card);
  }, [desktop, cardDomId]);
  if (!citations || entries.length === 0) return null;
  // Read by Radix after commit: the live opener, never a node kept from the click.
  const anchor = {
    get current() {
      return citations.openerOf(id);
    },
  };
  const opener = citations.openerOf(id);
  const boundary = desktop && opener ? scrollerOf(opener) : null;
  const Portal = desktop ? Popover.Portal : Fragment;
  const inCardOrOpener = (target: EventTarget | null) => {
    if (!(target instanceof Node)) return false;
    const card = cardDomId ? document.getElementById(cardDomId) : null;
    return Boolean(card?.contains(target) || citations.openerOf(id)?.contains(target));
  };
  return (
    <Popover.Root
      open
      onOpenChange={(next) => {
        if (!next && citations.openIdRef.current === id) citations.close();
      }}
    >
      <Popover.Anchor virtualRef={anchor as { current: HTMLElement }} />
      <div className={desktop ? "contents" : "mt-2 mb-1 [&>[data-radix-popper-content-wrapper]]:static! [&>[data-radix-popper-content-wrapper]]:min-w-0! [&>[data-radix-popper-content-wrapper]]:transform-none!"}>
        <Portal>
          <Popover.Content
            asChild
            side="bottom"
            align="start"
            sideOffset={4}
            avoidCollisions={desktop}
            collisionBoundary={boundary}
            collisionPadding={desktop ? collisionPadding(boundary) : 0}
            hideWhenDetached={desktop}
            onOpenAutoFocus={(event) => {
              // Focus stays on the opener; Tab from it moves into the card.
              event.preventDefault();
              skipRestore.current = false;
            }}
            onEscapeKeyDown={(event) => {
              // Escape in the composer or the sidebar is theirs, not the card's.
              if (!inCardOrOpener(event.target)) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              const target = event.target as Element | null;
              if (target?.closest?.(`[${OPENER_ATTR}]`)) {
                event.preventDefault();
                return;
              }
              skipRestore.current = Boolean(target?.closest?.(FOCUSABLE + ", input, textarea, select"));
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const swapped = citations.openIdRef.current !== null;
              if (!swapped && !skipRestore.current) citations.focusOpener(id);
              skipRestore.current = false;
            }}
          >
            <SourceCard id={id} entries={entries} className={desktop ? "z-50" : undefined} />
          </Popover.Content>
        </Portal>
      </div>
    </Popover.Root>
  );
};

type MarkerButtonProps = {
  id: string;
  ns: readonly number[];
  label: string;
  own?: boolean;
  className?: string;
  testId?: string;
};

/**
 * The number chip a reader clicks: a 16 px fill with no edge inside the 24 px
 * line (the hit area grows to 24 px through a pseudo element), 3 px apart.
 * Enter, Space and click toggle; Tab from an open marker moves into its card;
 * Escape is the card's (from the marker or inside the card).
 */
export const MarkerButton = ({ id, ns, label, own = false, className, testId = "citation-marker" }: MarkerButtonProps) => {
  const citations = useCitations();
  const open = citations?.openId === id;
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!citations) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      citations.toggle(id);
    } else if (event.key === "Tab" && !event.shiftKey && open) {
      if (citations.focusCard()) event.preventDefault();
    }
  };
  return (
    <button
      type="button"
      data-testid={testId}
      data-n={ns.join(" ")}
      {...{ [OPENER_ATTR]: citations?.openerKey(id) ?? "" }}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open && citations ? citations.cardId(id) : undefined}
      onClick={() => citations?.toggle(id)}
      onKeyDown={onKeyDown}
      className={cn(
        "relative ml-[3px] inline-flex h-4 min-w-4 cursor-pointer items-center justify-center rounded-[4px] bg-primary-500 px-1 text-[11px] leading-[14px] font-normal whitespace-nowrap tabular-nums text-natural-50 not-italic outline-none select-none hover:bg-highlight",
        "before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus aria-expanded:outline-2 aria-expanded:outline-offset-1 aria-expanded:outline-focus",
        own && "text-trace-agent",
        className,
      )}
    >
      {ns.length >= 3 ? `${ns[0]} to ${ns[ns.length - 1]}` : ns[0]}
    </button>
  );
};
