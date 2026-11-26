import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { useClipboard } from "@/hooks/useClipboard";
import {
  copyWithSources,
  externalHref,
  groupCitedSources,
  isUserFile,
  itemProviderMarker,
  locatorValue,
  markerLabel,
  metaValue,
  MY_COLLECTIONS_SOURCES_LABEL,
  SHARED_COLLECTIONS_LABEL,
  sourceTitle,
  sourcesSummary,
  type Citation,
  type CitationSource,
  type CitedSource,
  type RetrievedSource,
} from "@/utilities/citations";
import { useCitations } from "./CitationsContext";
import { CardPopover, FileName, MarkerButton, NewTabNote } from "./SourceCard";
import { ChevronIcon, CopyIcon } from "./SourceLook";

/**
 * The sources list under an answer that carries citations (spec 4.8): one
 * line by default, `Sources: 5 cited from Shared collections and My collections`;
 * open, two sections: Shared collections (Wiley and the other providers stay
 * as a marker on the item; `oa` does not) and My collections. Then
 * `Also retrieved: N` folded last, with no numbers. Colours as the
 * card: edge primary-400, text natural-50, secondary primary-300, hover
 * highlight ("Active and hover item").
 */

const MUTED = "text-primary-300";
const TOGGLE =
  "inline-flex min-h-6 cursor-pointer items-center gap-2 text-[13px] text-primary-300 hover:text-natural-50 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** One meta line: venue, year and page; the host of a page; the item id of a scene; where a file lives. */
const itemMeta = (source: CitationSource): { text: string; mono?: boolean } | null => {
  const page = locatorValue(source, "page");
  if (source.kind === "stac_item") {
    const item = locatorValue(source, "stac_item_id");
    return item ? { text: item, mono: true } : null;
  }
  if (isUserFile(source)) {
    const where = [source.provider_label, page ? `page ${page}` : null].filter(Boolean).join(", ");
    return where ? { text: where } : null;
  }
  const venue = [metaValue(source, "venue"), metaValue(source, "year"), page ? `page ${page}` : null]
    .filter(Boolean)
    .join(", ");
  if (venue) return { text: venue };
  const href = externalHref(source);
  if (href) {
    try {
      return { text: new URL(href).host };
    } catch {
      return null;
    }
  }
  return null;
};

const ItemTitle = ({ source }: { source: CitationSource }) => {
  const own = isUserFile(source);
  const title = own ? <FileName source={source} max={44} /> : sourceTitle(source);
  const href = own ? null : externalHref(source);
  if (!href) {
    return (
      <span data-testid="source-item-title" className="line-clamp-2 break-words text-natural-50">
        {title}
      </span>
    );
  }
  return (
    <a
      data-testid="source-item-title"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="line-clamp-2 break-words text-natural-50 no-underline hover:underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {title}
      <NewTabNote />
    </a>
  );
};

const ItemBody = ({ source }: { source: CitationSource }) => {
  const meta = itemMeta(source);
  const marker = itemProviderMarker(source);
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <ItemTitle source={source} />
      {marker && (
        <span data-testid="source-item-provider" className={cn("font-mono text-xs lowercase", MUTED)}>
          {marker}
        </span>
      )}
      {meta && (
        <span className={cn("text-xs break-words", MUTED, meta.mono && "font-mono break-all")}>{meta.text}</span>
      )}
    </span>
  );
};

const CitedItem = ({ item }: { item: CitedSource }) => {
  const citations = useCitations();
  const id = `l${item.n}`;
  const source = item.entries[0];
  return (
    <li data-testid="source-item" data-kind={source.kind} className="flex flex-col">
      <div className="-mx-1.5 flex items-baseline gap-2.5 px-1.5 py-1 hover:bg-highlight">
        <span className="inline-flex min-w-[22px] flex-none">
          <MarkerButton id={id} ns={[item.n]} label={markerLabel(source)} own={isUserFile(source)} className="ml-0" />
        </span>
        <ItemBody source={source} />
      </div>
      {citations?.openId === id && <CardPopover id={id} entries={item.entries} />}
    </li>
  );
};

const GroupHead = ({ label, count }: { label: string; count: number }) => (
  <div className={cn("flex items-center gap-2 text-xs", MUTED)}>
    <span>{label}</span>
    <span className="tabular-nums">{count}</span>
  </div>
);

/** Marker on an uncited row: `oa` reads as the section, Wiley stays `wiley`. */
const uncitedMarker = (source: CitationSource): string =>
  isUserFile(source) ? MY_COLLECTIONS_SOURCES_LABEL : (itemProviderMarker(source) ?? SHARED_COLLECTIONS_LABEL);

const Uncited = ({ retrieved, anyCited }: { retrieved: readonly RetrievedSource[]; anyCited: boolean }) => {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div className={anyCited ? "mt-3" : undefined}>
      <button
        type="button"
        data-testid="message-sources-uncited-toggle"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={TOGGLE}
      >
        <span>
          {anyCited ? "Also retrieved: " : "Retrieved, not cited: "}
          <span className="tabular-nums">{retrieved.length}</span>
        </span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <ul id={listId} className="m-0 mt-1.5 flex list-none flex-col gap-0.5 p-0">
          {retrieved.map((source) => {
            const marker = uncitedMarker(source);
            const slug =
              marker !== SHARED_COLLECTIONS_LABEL && marker !== MY_COLLECTIONS_SOURCES_LABEL;
            return (
              <li key={source.id} data-testid="source-uncited-item" className="-mx-1.5 flex items-baseline gap-2.5 px-1.5 py-1 hover:bg-highlight">
                <span className="flex min-w-0 flex-1 flex-col">
                  <ItemTitle source={source} />
                  <span className={cn("flex flex-wrap items-baseline gap-x-2 text-xs break-words", MUTED)}>
                    <span className={cn(slug && "font-mono lowercase")}>{marker}</span>
                    {itemMeta(source)?.text}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const CopyWithSources = ({ answer, citations }: { answer: string; citations: readonly Citation[] }) => {
  const { copyToClipboard, isCopied } = useClipboard();
  return (
    <button
      type="button"
      data-testid="message-sources-copy"
      onClick={() => void copyToClipboard(copyWithSources(answer, citations))}
      className="mt-3 inline-flex cursor-pointer items-center gap-1 text-xs text-primary-300 hover:text-natural-50 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <CopyIcon className="size-3" />
      {isCopied ? "Copied" : "Copy answer with sources"}
    </button>
  );
};

export const MessageSources = ({
  citations,
  retrieved,
  answer,
}: {
  citations: readonly Citation[];
  retrieved: readonly RetrievedSource[];
  answer: string;
}) => {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const groups = groupCitedSources(citations);
  if (groups.length === 0 && retrieved.length === 0) return null;
  return (
    <div data-testid="message-sources" className="mt-1 border-t border-primary-400 pt-3">
      {groups.length > 0 ? (
        <>
          <button
            type="button"
            data-testid="message-sources-toggle"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            onClick={() => setOpen((value) => !value)}
            className={TOGGLE}
          >
            <span>{sourcesSummary(groups)}</span>
            <ChevronIcon open={open} />
          </button>
          {open && (
            <div id={listId}>
              <p data-testid="message-sources-cited-label" className="m-0 mt-3 text-xs text-primary-300">
                Cited
              </p>
              {groups.map((group) => (
                <div key={group.key} data-testid="source-group" data-provider={group.key} className="mt-3">
                  <GroupHead label={group.label} count={group.items.length} />
                  <ul className="m-0 mt-1.5 flex list-none flex-col gap-0.5 p-0">
                    {group.items.map((item) => (
                      <CitedItem key={item.n} item={item} />
                    ))}
                  </ul>
                </div>
              ))}
              {retrieved.length > 0 && <Uncited retrieved={retrieved} anyCited />}
              <CopyWithSources answer={answer} citations={citations} />
            </div>
          )}
        </>
      ) : (
        <Uncited retrieved={retrieved} anyCited={false} />
      )}
    </div>
  );
};
