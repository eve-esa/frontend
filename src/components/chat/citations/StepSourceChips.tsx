import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import {
  citedSources,
  externalHref,
  isUserFile,
  locatorValue,
  markerLabel,
  metaValue,
  sourceTitle,
  truncateMiddle,
  type CitationSource,
} from "@/utilities/citations";
import { OPENER_ATTR, useCitations } from "./CitationsContext";
import { CardPopover, NewTabNote } from "./SourceCard";
import { ProviderSlug } from "./SourceLook";

/**
 * The sources one step produced, under its row in the steps block (spec 4.9,
 * decision 0002): the cited ones first, as chips with their marker number
 * that open the same card as the marker, the title first and the provider
 * slug after it in the chip meta tier (decision 0007); the uncited rest behind one muted
 * `N more retrieved` link that opens a plain list, `Retrieved, not cited`,
 * title and slug on one line, no fill and no number. Rendered only inside a
 * turn with citations. Colours: chip fill primary-500 ("Chips and code
 * fills"), number on the surface primary-600, chip meta natural-200 (`#D2DADC`
 * dark, Deep Space -1 light), muted primary-300 ("Secondary text"), hover
 * highlight.
 */

const CHIP =
  "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[4px] bg-primary-500 py-[3px] pr-2 pl-1 text-xs leading-[18px] text-natural-50 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const chipMeta = (source: CitationSource): string | null => {
  if (source.kind === "stac_item") {
    const date = locatorValue(source, "datetime")?.slice(0, 10) ?? null;
    const cloud = source.meta?.cloud_cover;
    return [date, typeof cloud === "number" ? `cloud ${Math.round(cloud)} %` : null].filter(Boolean).join(", ") || null;
  }
  if (isUserFile(source)) {
    const page = locatorValue(source, "page");
    return page ? `p. ${page}` : null;
  }
  if (source.kind === "web_page") return "web page";
  return metaValue(source, "year");
};

const ChipBody = ({ source }: { source: CitationSource }) => {
  const own = isUserFile(source);
  const title = sourceTitle(source);
  const meta = chipMeta(source);
  return (
    <>
      <span className="max-w-[180px] min-w-0 truncate md:max-w-[240px]">{own ? truncateMiddle(title, 30) : title}</span>
      <ProviderSlug source={source} small meta />
      {meta && <span className="whitespace-nowrap tabular-nums text-natural-200">{meta}</span>}
    </>
  );
};

const MUTED_LINK =
  "cursor-pointer text-xs leading-[18px] text-primary-300 underline-offset-2 hover:text-natural-50 hover:underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** One uncited source: title and slug on one line, muted, linking out when it can. */
const UncitedItem = ({ source }: { source: CitationSource }) => {
  const href = externalHref(source);
  const title = sourceTitle(source);
  const body = (
    <>
      <span className="min-w-0 truncate">{isUserFile(source) ? truncateMiddle(title, 40) : title}</span>
      <ProviderSlug source={source} small muted />
    </>
  );
  return (
    <li data-testid="agent-step-source-uncited" className="flex min-w-0 text-xs leading-[18px] text-primary-300">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={title}
          className="inline-flex max-w-full min-w-0 items-baseline gap-2 text-primary-300 no-underline hover:text-natural-50 hover:underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {body}
          <NewTabNote />
        </a>
      ) : (
        <span title={title} className="inline-flex max-w-full min-w-0 items-baseline gap-2">
          {body}
        </span>
      )}
    </li>
  );
};

export const StepSourceChips = ({ toolCallId }: { toolCallId: string }) => {
  const citations = useCitations();
  const [showUncited, setShowUncited] = useState(false);
  const listId = useId();
  if (!citations || !toolCallId) return null;
  const cited = citedSources(citations.citations.filter((c) => c.tool_call_id === toolCallId));
  const uncited = citations.retrieved.filter((s) => s.tool_call_id === toolCallId);
  if (cited.length + uncited.length === 0) return null;
  const openItem = cited.find((item) => citations.openId === `c${toolCallId}:${item.n}`);
  return (
    <>
      <div data-testid="agent-step-sources" className="mt-1.5 mb-0.5 flex flex-wrap items-center gap-1.5">
        {cited.map((item) => {
          const id = `c${toolCallId}:${item.n}`;
          const source = item.entries[0];
          const open = citations.openId === id;
          return (
            <button
              key={id}
              type="button"
              data-testid="agent-step-source-chip"
              {...{ [OPENER_ATTR]: citations.openerKey(id) }}
              data-n={item.n}
              data-kind={source.kind}
              title={sourceTitle(source)}
              aria-label={markerLabel(source)}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={open ? citations.cardId(id) : undefined}
              onClick={() => citations.toggle(id)}
              onKeyDown={(event) => {
                if (event.key === "Tab" && !event.shiftKey && open && citations.focusCard()) event.preventDefault();
              }}
              className={cn(CHIP, "cursor-pointer hover:bg-highlight aria-expanded:outline-2 aria-expanded:outline-focus")}
            >
              <span
                aria-hidden="true"
                className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-[3px] bg-primary-600 px-1 tabular-nums text-natural-50"
              >
                {item.n}
              </span>
              <ChipBody source={source} />
            </button>
          );
        })}
        {uncited.length > 0 && (
          <button
            type="button"
            data-testid="agent-step-source-chip-more"
            aria-expanded={showUncited}
            aria-controls={showUncited ? listId : undefined}
            onClick={() => setShowUncited((value) => !value)}
            className={cn(MUTED_LINK, cited.length > 0 && "ml-1")}
          >
            {uncited.length} more retrieved
          </button>
        )}
      </div>
      {showUncited && uncited.length > 0 && (
        <div
          id={listId}
          role="group"
          aria-label="Retrieved, not cited"
          data-testid="agent-step-sources-uncited"
          className="mt-1 mb-0.5"
        >
          <p className="m-0 text-xs leading-[18px] text-primary-300">Retrieved, not cited</p>
          <ul className="m-0 mt-0.5 flex list-none flex-col gap-0.5 p-0">
            {uncited.map((source) => (
              <UncitedItem key={source.id} source={source} />
            ))}
          </ul>
        </div>
      )}
      {openItem && <CardPopover id={`c${toolCallId}:${openItem.n}`} entries={openItem.entries} />}
    </>
  );
};
