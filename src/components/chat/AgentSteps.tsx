import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBook,
  faCheck,
  faChevronDown,
  faCode,
  faLock,
  faPlug,
  faRightLeft,
  faScroll,
  faSitemap,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import {
  faCircle,
  faCircleStop,
  faCircleXmark,
} from "@fortawesome/free-regular-svg-icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import { ArtifactDownloadChip } from "@/components/ui/ArtifactDownloadChip";
import { StepSourceChips } from "./citations/StepSourceChips";
import { CopyButton } from "@/components/ui/CopyButton";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import type { AgenticTraceStep, ToolActivityEntry } from "@/types";
import {
  artifactLinks,
  currentActivity,
  latestRunningRow,
  searchedCollections,
  isKnowledgeBaseTool,
  isSandboxStep,
  sourceChips,
  resultText,
  sandboxCode,
  stepServerAndTool,
  displayModel,
  buildStepsFromActivity,
  buildStepsFromTrace,
  formatClock,
  inputLines,
  summaryParts,
  type CollectionCatalog,
  type AgentStepRow,
  type AgentStepStatus,
  type AgentStepsView,
} from "@/utilities/agentSteps";
import { truncateForDisplay } from "@/utilities/agentTrace";
import {
  highlightJson,
  sandboxStreams,
  splitExitCode,
  tokenizePython,
  type CodeTokenKind,
  type JsonTokenKind,
} from "@/utilities/codeTokens";
import {
  stepLine,
  stepSentence,
  type StepTarget,
} from "@/utilities/stepLabels";
import { formatTokens } from "./trace/TraceStepCard";

// Every colour is a token of index.css, with the values of the A1 preview
// (evidence/A1/3-done-expanded.html). Dark from @theme, light from the
// BRAND.md rows behind the light overrides: natural-50 Text, primary-300
// Secondary text, primary-400 Card edge (the rail), primary-500 Chips and
// code fills, primary-600 the code box (ESA white in light), success-200 and
// success-100 Link text and success, danger-300 Danger, focus Focus ring.
const MUTED = "text-primary-300";
const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary-50 in-data-[theme=light]:focus-visible:ring-focus";
/** The turn card under a rail icon, so the rail line stops at the icon: the
 * card surface of Message (primary-600 dark, natural-900 light: ESA white). */
const ON_GROUND = "bg-primary-600 in-data-[theme=light]:bg-natural-900";
/** The preview's `.code` box in mono 12/18, capped at 256px (shadcn Code
 * Block `max-h-64`) with a bottom alpha mask while more is below (FadeBox): on the dark card the chat ground
 * natural-900 `#12181A` (the card itself is primary-600), in light ESA white
 * with the Card edge, as the preview. */
const CODE_BOX =
  "max-h-64 overflow-auto whitespace-pre-wrap border border-primary-400/40 bg-natural-900 px-2.5 py-1.5 font-mono text-[12px] leading-[18px] text-natural-100 [overflow-wrap:anywhere] in-data-[theme=light]:border-primary-400";
/**
 * The preview's `.list`: a 1px rail 7px in, rows 14px past it. The list draws
 * no border: each row paints its own segment of the rail (RAIL_SEGMENT), so
 * the line can stop where the last icon stops.
 */
const RAIL = "ml-[7px] flex list-none flex-col pl-[calc(0.875rem+1px)]";
/** One row's segment of the rail: a 1px line at the list's left edge (the
 * list's padding and the 1px of its old border to the left of the row), the
 * full height of the row, so the segments of a list meet into the rail of the
 * preview. Colour primary-400 (light: Card edge). */
const RAIL_SEGMENT =
  "before:absolute before:inset-y-0 before:left-[calc(-0.875rem-1px)] before:w-px before:bg-primary-400";
/** A row with a mark on the rail (RailMark, the swap mark) centres it 14px
 * below the row top: as the first row its segment starts there, as the last
 * row it ends there, so the rail runs between icons and never past one. A
 * row without a mark (done) keeps its segment for its whole height. */
const RAIL_SEGMENT_MARKED = "first:before:top-[14px] last:before:bottom-[calc(100%-14px)]";
/** Whether a row of this status carries a mark on the rail: every status but done. */
const hasRailMark = (status: AgentStepStatus): boolean => status !== "done";

/** Collection labels and run facts shared by the rows of one block. */
type BlockContext = {
  catalog: CollectionCatalog | null;
  /** The app's label of the model that answered, for raw endpoint names. */
  modelLabel: string | null;
};
const BlockContextValue = createContext<BlockContext>({ catalog: null, modelLabel: null });

const toCopyText = (value: unknown): string =>
  typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? "");

/** What a screen reader hears for a step status (the icons are decorative). */
export const STATUS_TEXT: Record<AgentStepStatus, string> = {
  running: "running",
  done: "done",
  error: "failed",
  stopped: "stopped",
  not_run: "not run",
};

/** The status as text for assistive tech, inside the row's toggle. */
const StatusText = ({ status }: { status: AgentStepStatus }) => (
  <span data-testid="agent-step-status-text" className="sr-only">
    , {STATUS_TEXT[status]}
  </span>
);

/**
 * The status mark on the rail, 14px, decorative (StatusText carries it), only
 * where the row needs one (decision 0003, shadcn Trace: a line with no status
 * is done): the Spinner while running, the outline cross in Danger, the
 * outline stop and an empty circle in Secondary text. A done row has none.
 */
const StatusMark = ({ status }: { status: AgentStepStatus }) => {
  if (status === "done") return null;
  if (status === "running") {
    return (
      <span data-testid="agent-step-mark" data-mark="running" aria-hidden className="contents">
        <Spinner size="xs" variant="white" />
      </span>
    );
  }
  const icon = status === "error" ? faCircleXmark : status === "stopped" ? faCircleStop : faCircle;
  return (
    <FontAwesomeIcon
      icon={icon}
      data-testid="agent-step-mark"
      data-mark={status}
      aria-hidden
      className={cn("size-3.5", status === "error" ? "text-danger-300" : MUTED)}
    />
  );
};

/** The status mark placed on the rail of the list it sits in; none when done. */
const RailMark = ({ status }: { status: AgentStepStatus }) =>
  !hasRailMark(status) ? null : (
    <span className={cn("absolute top-[7px] -left-[21px] grid size-3.5 place-items-center", ON_GROUND)}>
      <StatusMark status={status} />
    </span>
  );

/**
 * One muted icon per kind (research section 7, Font Awesome Solid, 14px glyph
 * in a 16px slot): book for the knowledge base, code for the sandbox, a plug
 * for MCP (the crossed screwdriver and wrench read like the error cross at
 * 14px), a tree for a subagent, a scroll for a skill; nothing elsewhere.
 * Secondary text: dark primary-300, light Deep Space -1 `#335E6F`.
 */
const KIND_ICONS: Record<string, IconDefinition> = {
  "knowledge-base": faBook,
  code: faCode,
  mcp: faPlug,
  subagent: faSitemap,
  skill: faScroll,
};
const iconKindOf = (row: AgentStepRow): string | null => {
  if (isKnowledgeBaseTool(row.tool, row.server)) return "knowledge-base";
  if (isSandboxStep(row)) return "code";
  if (row.kind === "mcp") return "mcp";
  if (row.kind === "subagent") return "subagent";
  if (row.kind === "skill") return "skill";
  return null;
};
const KindIcon = ({ row }: { row: AgentStepRow }) => {
  const kind = iconKindOf(row.kind === "group" && row.children[0] ? row.children[0] : row);
  if (!kind) return null;
  return (
    <span aria-hidden className="grid h-5 w-4 shrink-0 place-items-center">
      <FontAwesomeIcon
        icon={KIND_ICONS[kind]}
        data-testid="agent-step-kind-icon"
        data-icon-kind={kind}
        className={cn("size-3.5", MUTED)}
      />
    </span>
  );
};

/**
 * A target (collection, server, tool, skill, subagent): a square mono chip
 * with the chip fill and no border (research 3.5, assistant-ui ToolTimeline):
 * primary-500, light Chips and code fills `#E0E4E7`; text natural-50, light
 * Deep Space, 10.6 on the fill.
 */
export const TargetChip = ({ target }: { target: StepTarget }) => (
  <span
    data-testid="agent-step-target"
    data-target-kind={target.kind}
    data-internal={target.internal ? "true" : undefined}
    className="mr-1.5 inline-flex max-w-full items-center gap-1 bg-primary-500 px-1 align-baseline font-mono text-[12px] leading-[18px] font-normal text-natural-50 [overflow-wrap:anywhere]"
  >
    {target.label}
    {target.internal && (
      <>
        <FontAwesomeIcon
          icon={faLock}
          aria-hidden
          className="size-2 text-success-200 in-data-[theme=light]:text-success-100"
        />
        <span className="sr-only">, your documents</span>
      </>
    )}
  </span>
);

const PlanChecklist = ({ row }: { row: AgentStepRow }) => {
  const items = row.plan ?? [];
  return (
    <div data-testid="agent-steps-plan" className="flex flex-col gap-1">
      <span className="text-[13px] leading-5 text-natural-50">Plan</span>
      <ul className="flex list-none flex-col gap-0.5">
        {items.map((item, idx) => (
          <li
            key={idx}
            data-testid="agent-steps-plan-item"
            data-status={item.status}
            className={cn(
              "flex items-center gap-2 text-[13px] leading-5",
              item.status === "done" ? MUTED : "text-natural-50",
            )}
          >
            <span aria-hidden className="grid size-3 shrink-0 place-items-center border border-primary-400">
              {item.status === "done" && (
                <FontAwesomeIcon
                  icon={faCheck}
                  className="size-2 text-success-200 in-data-[theme=light]:text-success-100"
                />
              )}
              {item.status === "running" && <Spinner size="xs" />}
            </span>
            <span>{item.text}</span>
            {item.status !== "todo" && (
              <span className="sr-only">, {item.status === "done" ? "done" : "running"}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * A `pre` code box capped at 256px. When its content runs past the cap it
 * becomes a named, focusable region (Tab then the arrow keys scroll it in
 * every browser, WCAG 2.1.1) and fades at the bottom with Tailwind's alpha
 * mask, until the reader reaches the end. Measured again on resize.
 */
export const FadeBox = ({ testId, label, children }: { testId?: string; label: string; children: ReactNode }) => {
  const ref = useRef<HTMLPreElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
    setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }, []);
  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children, measure]);
  return (
    <pre
      ref={ref}
      data-testid={testId}
      onScroll={measure}
      {...(overflowing ? { tabIndex: 0, role: "region", "aria-label": label } : {})}
      className={cn(CODE_BOX, FOCUS, overflowing && !atEnd && "mask-b-from-[calc(100%-24px)]")}
    >
      {children}
    </pre>
  );
};

/** A code box with its copy button inside the border, top right. */
export const CopyableBlock = ({
  value,
  label,
  testId,
  children,
}: {
  value: string | null | undefined;
  label: string;
  testId: string;
  children: ReactNode;
}) => (
  // The direct child is the bordered box: room on its right for the button.
  <div data-testid={`${testId}-block`} className="relative [&>*]:pr-8">
    {children}
    {value ? (
      <CopyButton
        value={value}
        label={label}
        testId={testId}
        className="absolute top-1 right-1 bg-natural-900 p-1 has-[>svg]:p-1"
      />
    ) : null}
  </div>
);

/**
 * Token colours of code and JSON, the trace panel's JSON tokens (light values
 * on the white code box, BRAND.md rows): key Trace agent step `#00619E` 6.6,
 * string Trusty Azure +2 `#1E3378` 11.7, number Pure Teal +2 `#006762` 6.7,
 * boolean and keywords Energise Purple `#90278E` 7.3, null and comments Deep
 * Space -1 `#335E6F` 7.1. Dark: the shipped `--color-json-*` values.
 */
const CODE_TOKEN_CLASSES: Record<CodeTokenKind, string> = {
  keyword: "text-json-boolean",
  string: "text-json-string",
  number: "text-json-number",
  comment: "italic text-json-null",
  plain: "",
};
const JSON_TOKEN_CLASSES: Record<JsonTokenKind, string> = {
  key: "text-json-key",
  string: "text-json-string",
  number: "text-json-number",
  boolean: "text-json-boolean",
  null: "text-json-null",
  plain: "",
};

export const HighlightedCode = ({ code }: { code: string }) => (
  <>
    {tokenizePython(code).map((token, idx) =>
      token.kind === "plain" ? (
        token.text
      ) : (
        <span key={idx} data-token={token.kind} className={CODE_TOKEN_CLASSES[token.kind]}>
          {token.text}
        </span>
      ),
    )}
  </>
);

/** Compact JSON as the preview prints it: `{ "query": "…", "k": 10 }`. */
const compactJson = (value: unknown): string =>
  (JSON.stringify(truncateForDisplay(value), null, 1) ?? "").replace(/\n\s*/g, " ");

export const HighlightedJson = ({ text }: { text: string }) => (
  <>
    {highlightJson(text).map((token, idx) =>
      token.kind === "plain" ? (
        token.text
      ) : (
        <span key={idx} data-token={token.kind} className={JSON_TOKEN_CLASSES[token.kind]}>
          {token.text}
        </span>
      ),
    )}
  </>
);

/**
 * The sandbox exit code, only when it failed (research section 4): `exit N`
 * in mono, Danger (danger-300, light `#CF1D39` 5.4 on white; dark `#F1666A`).
 */
export const ExitBadge = ({ code }: { code: number }) =>
  code === 0 ? null : (
    <span
      data-testid="agent-step-exit"
      data-exit-code={code}
      className="w-fit font-mono text-[12px] leading-[18px] text-danger-300"
    >
      exit {code}
    </span>
  );

const attemptError = (row: AgentStepRow): string =>
  row.errorCode === "timeout"
    ? "Timed out"
    : (row.preview ?? "").trim().slice(0, 280) || row.errorCode?.replace(/_/g, " ") || "Failed";

const MAX_LIST_ITEMS = 3;
const MAX_TEXT_LINES = 6;

/** The "N more" line under a cut list, muted. */
const More = ({ count, unit = "" }: { count: number; unit?: string }) =>
  count > 0 ? <span className={MUTED}>{`${count} more${unit}`}</span> : null;

/** The documents a knowledge base step found, numbered, three then "N more". */
const DocumentList = ({ row }: { row: AgentStepRow }) => {
  const { catalog } = useContext(BlockContextValue);
  const chips = sourceChips(row, catalog);
  if (chips.length === 0) return null;
  const shown = chips.slice(0, MAX_LIST_ITEMS);
  // Lines in the pre box: newlines, so a copy keeps them. No leading numbers
  // (decision 0007): the only numbers in a turn are citation numbers.
  const text = shown.map((chip) => `${chip.title}${chip.year !== null ? ` (${chip.year})` : ""}`).join("\n");
  return (
    <>
      <span data-testid="agent-step-output-documents" className={MUTED}>
        {text}
      </span>
      {chips.length > shown.length && "\n"}
      <More count={chips.length - shown.length} />
    </>
  );
};

/** A step result in the Output box: documents, a list, JSON or text, cut short. */
const OutputBody = ({ row }: { row: AgentStepRow }) => {
  const { catalog } = useContext(BlockContextValue);
  if (isKnowledgeBaseTool(row.tool, row.server) && sourceChips(row, catalog).length > 0) {
    return <DocumentList row={row} />;
  }
  if (row.output?.kind === "json") {
    const value = row.output.value;
    if (Array.isArray(value) && value.length > MAX_LIST_ITEMS) {
      return (
        <>
          {value.slice(0, MAX_LIST_ITEMS).map((item, idx) => (
            <span key={idx}>
              <HighlightedJson text={compactJson(item)} />
              {"\n"}
            </span>
          ))}
          <More count={value.length - MAX_LIST_ITEMS} />
        </>
      );
    }
    return <HighlightedJson text={compactJson(value)} />;
  }
  const text = resultText(row);
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <>
      {lines.slice(0, MAX_TEXT_LINES).join("\n")}
      {lines.length > MAX_TEXT_LINES && (
        <>
          {"\n"}
          <More count={lines.length - MAX_TEXT_LINES} unit=" lines" />
        </>
      )}
    </>
  );
};

/** Saved files a result names, as download chips (relative `/artifacts/<id>` only). */
const ArtifactChips = ({ row }: { row: AgentStepRow }) => {
  const links = artifactLinks(resultText(row));
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <span key={link.href} data-testid="agent-step-artifact" data-href={link.href}>
          <ArtifactDownloadChip href={link.href} filename={link.filename} />
        </span>
      ))}
    </div>
  );
};

const DetailHeading = ({ children }: { children: ReactNode }) => (
  <h4 className={cn("text-[12px] leading-[18px] font-normal", MUTED)}>{children}</h4>
);

/**
 * The input as the clean preview reads it: `key: value` lines, the key
 * muted, three at most then "N more"; code as highlighted code; anything
 * else as compact JSON.
 */
const InputBody = ({ input, code }: { input: unknown; code: string | null }) => {
  if (code) return <HighlightedCode code={code} />;
  if (typeof input === "string") return <>{input}</>;
  const readable = inputLines(input);
  if (!readable) return <HighlightedJson text={compactJson(input)} />;
  return (
    <>
      {readable.lines.map(([key, value], idx) => (
        <span key={key}>
          {idx > 0 && "\n"}
          <span data-testid="agent-step-input-key" className={MUTED}>{`${key}:`}</span> {value}
        </span>
      ))}
      {readable.more > 0 && (
        <>
          {"\n"}
          <More count={readable.more} />
        </>
      )}
    </>
  );
};

/**
 * The opened step, the clean preview's `.detail`: Input as `key: value`
 * lines and Output in code boxes with copy, lists cut with "N more"; then a
 * folded Details with the meta line (Server, Tool, Result, the model facts
 * when the trace has them) and the raw input JSON. No Code and Output tabs.
 */
export const StepResult = ({ row, detailsOpen = false }: { row: AgentStepRow; detailsOpen?: boolean }) => {
  const { catalog, modelLabel } = useContext(BlockContextValue);
  const { server, tool } = stepServerAndTool(row);
  const by = row.requestedBy;
  const sandbox = isSandboxStep(row);
  const knowledgeBase = isKnowledgeBaseTool(row.tool, row.server);
  const documents = knowledgeBase ? sourceChips(row, catalog).length : 0;
  const collections = knowledgeBase ? searchedCollections(row, catalog).map((c) => c.label) : [];
  const meta: [string, string | null][] = [
    ["Server", server],
    ["Tool", tool],
    ["Collections", collections.length ? collections.join(", ") : null],
    ["Result", documents > 0 ? `${documents} ${documents === 1 ? "document" : "documents"}` : null],
    ["Attempt", row.attempt !== null && row.attempt > 1 ? String(row.attempt) : null],
    ["Model", by ? displayModel(by.model, modelLabel) : null],
    ["Tokens", by ? formatTokens(by) : null],
  ];
  const shown = meta.filter((item): item is [string, string] => Boolean(item[1]));
  const code = sandbox ? sandboxCode(row.input) : null;
  const hasOutput = !sandbox && row.status !== "error" && row.kind !== "plan" && resultText(row) !== null;
  const [full, setFull] = useState(false);
  const [details, setDetails] = useState(detailsOpen);
  const rawInput = row.input !== undefined && typeof row.input !== "string" ? row.input : undefined;
  const hasDetails = shown.length > 0 || rawInput !== undefined;
  return (
    <div data-testid="agent-step-detail-panel" className="mt-1.5 mb-1 flex flex-col gap-2">
      <section className="flex flex-col gap-1.5">
        <DetailHeading>Input</DetailHeading>
        {row.input === undefined ? (
          <p className={cn("text-[12px] italic", MUTED)}>Not recorded for this answer</p>
        ) : (
          <CopyableBlock
            value={code ?? toCopyText(row.input)}
            label={code ? "Copy code" : "Copy input"}
            testId={code ? "agent-step-copy-code" : "agent-step-copy-arguments"}
          >
            <FadeBox testId="agent-step-input" label="Input">
              <InputBody input={row.input} code={code} />
            </FadeBox>
          </CopyableBlock>
        )}
      </section>
      {hasOutput && (
        <section className="flex flex-col gap-1.5">
          <DetailHeading>
            {documents > 0 ? `Output, ${documents} ${documents === 1 ? "document" : "documents"}` : "Output"}
          </DetailHeading>
          <CopyableBlock value={resultText(row)} label="Copy output" testId="agent-step-copy-result">
            <FadeBox testId="agent-step-output" label="Output">
              <span data-testid="agent-step-output-preview" className="contents">
                <OutputBody row={row} />
              </span>
            </FadeBox>
          </CopyableBlock>
        </section>
      )}
      <ArtifactChips row={row} />
      {row.offloaded && row.output && row.output.kind !== "empty" && (
        <>
          <button
            type="button"
            onClick={() => setFull((v) => !v)}
            data-testid="agent-step-open-full"
            className={cn("w-fit cursor-pointer text-[12px] underline", MUTED, FOCUS)}
          >
            {full ? "Hide full result" : "Open full result"}
          </button>
          {full && <FadeBox label="Full result">{row.output.copyText}</FadeBox>}
        </>
      )}
      {hasDetails && (
        <section className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setDetails((v) => !v)}
            aria-expanded={details}
            data-testid="agent-step-details-toggle"
            className={cn("group/details inline-flex w-fit cursor-pointer items-center gap-1.5 text-[12px] leading-[18px]", MUTED, FOCUS)}
          >
            Details
            <FontAwesomeIcon
              icon={faChevronDown}
              aria-hidden
              className={cn("size-2 transition-transform", details && "rotate-180")}
            />
          </button>
          {details && (
            <>
              {shown.length > 0 && (
                <dl data-testid="agent-step-meta" className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] leading-[18px]">
                  {shown.map(([label, value]) => (
                    <div key={label}>
                      <dt className={cn("inline", MUTED)}>{label}</dt>
                      <dd className="ml-1.5 inline text-natural-50">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {rawInput !== undefined && (
                <FadeBox testId="agent-step-input-json" label="Input as JSON">
                  <HighlightedJson text={JSON.stringify(truncateForDisplay(rawInput), null, 2) ?? ""} />
                </FadeBox>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
};

/** Sandbox output under the row, always visible (the preview's level 2):
 * the output box, the exit code only when it failed. A failed command shows
 * its output too: it is the error. */
const SandboxOutput = ({ row }: { row: AgentStepRow }) => {
  const raw = resultText(row);
  if (!raw) return null;
  const { body, exitCode } = splitExitCode(raw);
  const streams = sandboxStreams(body);
  if (streams.length === 0 && exitCode === null) return null;
  return (
    <div data-testid="agent-step-terminal" className="mt-1.5 mb-0.5 flex flex-col gap-1">
      {streams.length > 0 && (
        <CopyableBlock value={body} label="Copy output" testId="agent-step-copy-output">
        <FadeBox testId="agent-step-sandbox-output" label="Command output">
          {streams.map((part, idx) => (
            <span
              key={idx}
              data-testid={part.stream === "stderr" ? "agent-step-stderr" : undefined}
              // stderr in the danger token (light Danger #CF1D39, 5.4 on white;
              // dark #F1666A, 5.8 on the #12181A box).
              className={part.stream === "stderr" ? "text-danger-300" : undefined}
            >
              {idx > 0 ? "\n" : ""}
              {part.text}
            </span>
          ))}
        </FadeBox>
        </CopyableBlock>
      )}
      {exitCode !== null && <ExitBadge code={exitCode} />}
    </div>
  );
};

/** Earlier attempts of a retried step, each with its error. */
const EarlierAttempts = ({ row }: { row: AgentStepRow }) => (
  <ol data-testid="agent-step-attempt-list" className="mt-1 flex list-none flex-col gap-1">
    {row.attempts.map((attempt, idx) => (
      <li key={idx} data-testid="agent-step-attempt" className="flex flex-col text-[12px] leading-[18px]">
        <span className={MUTED}>Attempt {idx + 1}</span>
        <span data-testid="agent-step-attempt-error" className="text-danger-300 [overflow-wrap:anywhere]">
          {attemptError(attempt).replace(/^Timed out$/, "timed out")}
        </span>
      </li>
    ))}
  </ol>
);

/** `model_fallback`: one small muted line with a swap mark on the rail. */
const ModelSwitchRow = ({ row }: { row: AgentStepRow }) => (
  <li
    data-testid="agent-step"
    data-kind="fallback"
    data-status="done"
    data-model-from={row.modelFrom ?? undefined}
    data-model-to={row.modelTo ?? undefined}
    className={cn("relative py-1 text-[12px] leading-5", RAIL_SEGMENT, RAIL_SEGMENT_MARKED, MUTED)}
  >
    <span className={cn("absolute top-[7px] -left-[21px] grid size-3.5 place-items-center", ON_GROUND)}>
      <FontAwesomeIcon icon={faRightLeft} aria-hidden className="size-3" />
    </span>
    <span>{row.title}</span>
  </li>
);

/** A finished subagent's own conclusion: the first line of its answer, one
 * muted truncated line under the row (full text in `title`). */
const SubagentConclusion = ({ row }: { row: AgentStepRow }) => {
  const text = resultText(row);
  const first = text?.split("\n").find((l) => l.trim() !== "")?.trim();
  if (!first) return null;
  return (
    <p
      data-testid="agent-step-conclusion"
      title={first}
      className={cn("truncate pl-6 text-[12px] leading-[18px]", MUTED)}
    >
      {first}
    </p>
  );
};

// Memoised: a row rerenders only when its own row object changes.
const StepRow = memo(function StepRow({ row, nested = false }: { row: AgentStepRow; nested?: boolean }) {
  if (row.kind === "model_switch") return <ModelSwitchRow row={row} />;
  return <ToolStepRow row={row} nested={nested} />;
});

/** The right side of a row: no duration (decision 0003); the one muted word
 * a cut or unrun call keeps, and the failed count of a group (a failed single
 * row says it in its verb). */
const RowEnd = ({ row }: { row: AgentStepRow }) => {
  if (row.kind === "subagent" && row.status === "done" && row.children.length > 0) {
    // A finished subagent folds behind its step count (clean preview, state 3).
    const n = row.children.length;
    return (
      <span
        data-testid="agent-step-children-count"
        className={cn("inline-flex shrink-0 items-center gap-1.5 text-[12px] leading-5", MUTED)}
      >
        {`${n} ${n === 1 ? "step" : "steps"}`}
        <FontAwesomeIcon
          icon={faChevronDown}
          aria-hidden
          className="size-2 transition-transform group-data-[state=open]/row:rotate-180"
        />
      </span>
    );
  }
  if (row.status === "stopped") {
    return (
      <span data-testid="agent-step-stopped" className={cn("shrink-0 text-[12px] leading-5", MUTED)}>
        stopped
      </span>
    );
  }
  if (row.status === "not_run") {
    return (
      <span data-testid="agent-step-not-run" className={cn("shrink-0 text-[12px] leading-5", MUTED)}>
        not run
      </span>
    );
  }
  const failed =
    row.kind === "group" && row.status !== "running" ? row.children.filter((c) => c.status === "error").length : 0;
  if (failed === 0) return null;
  return (
    <span data-testid="agent-step-failed" className="shrink-0 text-[12px] leading-5 text-danger-300">
      {`${failed} failed`}
    </span>
  );
};

/** The row text: the verb (danger on a failure), the target chips, the
 * muted server ("in cdse") and the muted detail. */
const RowTitle = ({ row }: { row: AgentStepRow }) => {
  const { catalog } = useContext(BlockContextValue);
  const line = stepLine(row, catalog);
  const muted = row.status === "stopped" || row.status === "not_run";
  return (
    <span data-testid="agent-step-title" className="min-w-0 flex-1 text-[13px] leading-5 [overflow-wrap:anywhere]">
      {/* Verb and chip never break apart (phone 390); the detail wraps after them. */}
      <span data-testid="agent-step-head" className="inline-block max-w-full whitespace-nowrap">
        <span
          data-testid="agent-step-verb"
          className={cn(line.failed ? "text-danger-300" : muted ? MUTED : "text-natural-50")}
        >
          {line.verb}
        </span>{" "}
        {line.targets.map((target) => (
          <TargetChip key={`${target.kind}:${target.label}`} target={target} />
        ))}
      </span>
      {/* A row with no chip ("Wrote" + a path) has no chip margin to part the
          verb from what follows, so the space is a real one. */}
      {line.targets.length === 0 && (line.secondary || line.detail) ? " " : null}
      {line.secondary && (
        <>
          <span data-testid="agent-step-server" className={MUTED}>
            {line.secondary}
          </span>{" "}
        </>
      )}
      {line.detail && (
        <span data-testid="agent-step-detail" className={MUTED}>
          {line.detail}
        </span>
      )}
      {row.attempts.length > 0 && (
        <span data-testid="agent-step-attempts" data-attempts={row.attempts.length + 1} className={MUTED}>
          {`, ${row.attempts.length + 1} attempts`}
        </span>
      )}
    </span>
  );
};

const ToolStepRow = ({ row, nested = false }: { row: AgentStepRow; nested?: boolean }) => {
  const { catalog } = useContext(BlockContextValue);
  const isPlan = row.kind === "plan";
  const isGroup = row.kind === "group";
  const hasChildren = row.children.length > 0;
  // A subagent is open while it runs and again when it fails, folded once it
  // finished (pattern after the shadcn/ui Subagent and AG-UI Dojo subagents,
  // no code copied); a manual toggle wins until that automatic state changes.
  // Every other row starts folded.
  const autoOpen = row.kind === "subagent" && (row.status === "running" || row.status === "error");
  const [toggle, setToggle] = useState<BlockToggle | null>(null);
  const open = resolveBlockOpen(toggle, autoOpen);
  const children = hasChildren ? (
    <ul data-testid="agent-steps-subagent" className={cn(RAIL, "mt-0.5")}>
      {row.children.map((child) => (
        <StepRow key={child.key} row={child} nested />
      ))}
    </ul>
  ) : null;
  return (
    <Collapsible open={open} onOpenChange={(next) => setToggle({ open: next, autoOpen })} asChild>
      <li
        data-testid="agent-step"
        data-kind={row.kind}
        data-status={row.status}
        data-tool-source={row.kind === "mcp" ? "mcp" : row.kind === "builtin" ? "builtin" : undefined}
        data-tool={row.tool ?? undefined}
        data-nested={nested ? "true" : undefined}
        className={cn("relative py-1", RAIL_SEGMENT, hasRailMark(row.status) && RAIL_SEGMENT_MARKED)}
      >
        <RailMark status={row.status} />
        {isPlan ? (
          <>
            <PlanChecklist row={row} />
            <StatusText status={row.status} />
          </>
        ) : (
          <CollapsibleTrigger
            data-testid="agent-step-toggle"
            aria-label={stepSentence(row, catalog)}
            className={cn(
              "group/row relative flex min-h-6 w-full cursor-pointer items-start gap-2 text-left",
              // 44 px hit area on a phone, the row itself stays 24 px.
              "max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-2.5",
              FOCUS,
            )}
          >
            <KindIcon row={row} />
            <RowTitle row={row} />
            <RowEnd row={row} />
          </CollapsibleTrigger>
        )}
        {row.status === "error" && !(isSandboxStep(row) && resultText(row)) && (
          <p data-testid="agent-step-error" className="mt-0.5 text-[12px] leading-[18px] text-danger-300 [overflow-wrap:anywhere]">
            {attemptError(row)}
          </p>
        )}
        {row.attempts.length > 0 && <EarlierAttempts row={row} />}
        {row.kind === "subagent" && row.status === "done" && <SubagentConclusion row={row} />}
        {/* Inline citations: the sources this step produced (renders nothing without them). */}
        <StepSourceChips toolCallId={row.key} />
        {isSandboxStep(row) && <SandboxOutput row={row} />}
        {!isPlan && (
          <CollapsibleContent>
            {/* A subagent shows its own steps; its Input and Output only on a
                manual open. A group shows its calls. */}
            {row.kind === "subagent" ? (
              <>
                {children}
                {toggle?.open && <StepResult row={row} />}
              </>
            ) : (
              <>
                {!isGroup && <StepResult row={row} />}
                {children}
              </>
            )}
          </CollapsibleContent>
        )}
      </li>
    </Collapsible>
  );
};

type AgentStepsProps = {
  activity?: ToolActivityEntry[] | null;
  trace?: AgenticTraceStep[] | null;
  /** True while this message is the streaming target. */
  live: boolean;
  /** True once answer text exists. */
  answerStarted: boolean;
  stopped?: boolean;
  /** Read by nothing: the block folds on any end of the run. Kept until Message.tsx stops passing it. */
  failed?: boolean;
  /**
   * True on a live agentic turn: the block shows from the first moment
   * ("Working") and is the turn's only status line.
   */
  agentic?: boolean;
  /** The deep agent compresses older history (live region text). */
  summarizing?: boolean;
  /** Collection labels for the knowledge base rows. */
  collections?: CollectionCatalog | null;
  /** Opens the My collections panel (kept for the callers; A7 owns sources). */
  onOpenMyCollections?: () => void;
  /** The app's label of the model that answered ("EVE-Instruct (JSC)"). */
  modelLabel?: string | null;
  /**
   * Epoch ms of the send, when known. The clock counts from it, so a block
   * that mounts or remounts after the send still shows the real turn time.
   */
  startedAt?: number | null;
};

const hasRows = (view: AgentStepsView) => view.rows.length > 0;

/** A header toggle and the automatic state it was made against. */
export type BlockToggle = { open: boolean; autoOpen: boolean };

/**
 * The block's open state: the user's toggle wins only until the automatic
 * state changes, so a peek while the agent works still folds at answer start.
 */
export const resolveBlockOpen = (toggle: BlockToggle | null, autoOpen: boolean): boolean =>
  toggle !== null && toggle.autoOpen === autoOpen ? toggle.open : autoOpen;

/** Wall clock of one run: from the start of the live turn to its first
 * answer token, its Stop or its end. */
type RunClock = { start: number | null; end: number | null };

/**
 * The ticking clock of the header, in its own component so the one second
 * interval rerenders only this text, never the rows. Mounted only while the
 * agent works.
 */
export const LiveClock = ({ start }: { start: number }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    // A hidden tab throttles timers: read the real time as soon as it is seen again.
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return (
    <span data-testid="agent-steps-clock" aria-hidden className={cn("tabular-nums", MUTED)}>
      {formatClock(Math.max(0, now - start) / 1000)}
    </span>
  );
};

/**
 * Inline agent steps: what the agent did for this answer, above the answer,
 * as the A1 preview draws it. Open while the agent works; folds when the
 * final answer starts and at the end of the turn, also after a failure or a
 * Stop, with the failed rows still in sight under the header. Behind
 * FEATURE_AGENT_STEPS.
 */
const AgentStepsBlock = ({
  activity,
  trace,
  live,
  answerStarted,
  stopped = false,
  agentic = false,
  summarizing = false,
  collections = null,
  modelLabel = null,
  startedAt = null,
}: AgentStepsProps) => {
  // The run starts at the send when the caller knows it (a remount mid-turn
  // keeps the real time), else now.
  const runStart = () => Math.min(startedAt ?? Date.now(), Date.now());
  const [run, setRun] = useState<RunClock>(() => ({ start: live ? runStart() : null, end: null }));
  // The user's header toggle, until the next live run.
  const [toggle, setToggle] = useState<boolean | null>(null);
  const wasLive = useRef(live);

  // A new live run in the same slot (Retry, or a send after a Stop that never
  // persisted): fresh clock, fresh open state.
  useEffect(() => {
    const started = live && !wasLive.current;
    wasLive.current = live;
    if (started) {
      setRun({ start: runStart(), end: null });
      setToggle(null);
    }
  }, [live]);

  // The run ends at the first answer token, a Stop or the end of the stream.
  useEffect(() => {
    if (answerStarted || stopped || !live) {
      setRun((current) =>
        current.start !== null && current.end === null ? { ...current, end: Date.now() } : current,
      );
    }
  }, [live, answerStarted, stopped]);

  const runS = run.start !== null && run.end !== null ? (run.end - run.start) / 1000 : null;

  const view = useMemo(() => {
    const fromTrace = buildStepsFromTrace(trace, { stopped });
    if (hasRows(fromTrace)) return fromTrace;
    return buildStepsFromActivity(activity, { stopped, totalS: runS });
  }, [trace, activity, stopped, runS]);

  // Open while the agent works, folded to its header once the work ends (the
  // first answer token, a Stop, a failure or the end of the stream) and on a
  // reload; a toggle the user made wins until the next run (Onyx
  // `userHasToggled`, LibreChat `userOverride`, CopilotKit "turn").
  const autoOpen = live && !answerStarted && !stopped;
  const open = toggle ?? autoOpen;
  // The rows list is mounted until its fold animation ends; the folded copy
  // of the failed rows shows only after that, so a row is never drawn twice.
  const [rowsMounted, setRowsMounted] = useState(open);
  const rowsRef = useCallback((node: HTMLUListElement | null) => setRowsMounted(node !== null), []);

  // The trace total counts the steps only: the turn took at least as long as
  // the wall clock from the send to the end of the work.
  const totalS = view.totalS !== null && runS !== null ? Math.max(view.totalS, runS) : (view.totalS ?? runS);
  const context = useMemo<BlockContext>(
    () => ({ catalog: collections, modelLabel }),
    [collections, modelLabel],
  );

  const working = live && !answerStarted && !stopped;
  // A folded group of calls with a failed call stays in sight too.
  const failedRows = view.rows.filter(
    (row) => row.status === "error" || (row.kind === "group" && row.children.some((c) => c.status === "error")),
  );
  if (!hasRows(view) && !(agentic && working)) return null;

  const headerActivity = working ? currentActivity(view.rows, { summarizing }) : null;
  // Folded while live: the running row's own line (chip, verb), so the
  // header and the row never word the same step two ways.
  const runningRow = headerActivity && !open ? latestRunningRow(view.rows) : null;
  const headerSplit = runningRow ? stepLine(runningRow, collections) : null;
  const label = headerActivity
    ? null
    : summaryParts(view, { stopped, stoppedAfterS: stopped ? totalS : null });
  // The failures of the run in the danger token, apart from the muted counts.
  const failedPart = label ? /, (\d+ failed)$/.exec(`, ${label.rest}`)?.[1] ?? null : null;
  const restPart = label && failedPart ? label.rest.replace(new RegExp(`(, )?${failedPart}$`), "") : label?.rest;
  // One polite region (pattern after assistant-ui RunActivity, no code
  // copied): a step start, a step end, then the settled header; never the
  // timer. The latest running row, else the latest finished one.
  const lastRow = view.rows[view.rows.length - 1];
  const announcedRow = latestRunningRow(view.rows) ?? lastRow ?? null;
  const announcement = working
    ? announcedRow
      ? stepSentence(announcedRow, collections)
      : (headerActivity ?? "")
    : label
      ? `${label.head}, ${label.rest}`
      : "";

  return (
    <BlockContextValue.Provider value={context}>
    <Collapsible open={open} onOpenChange={setToggle}>
      <div data-testid="agent-steps" data-state={open ? "open" : "closed"} className="mb-4">
        {/* The live region sits outside the toggle: a region inside a button
            is announced unreliably, and the button keeps a stable name. */}
        <span
          data-testid="agent-steps-announce"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {announcement}
        </span>
        <CollapsibleTrigger
          data-testid="agent-steps-toggle"
          aria-label={working ? "Agent steps, working" : undefined}
          aria-busy={working}
          className={cn(
            "group relative inline-flex min-h-7 cursor-pointer items-center gap-2 pr-1 text-[13px] leading-5",
            // 44 px hit area on a phone, the header itself stays 28 px.
            "max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-2",
            working ? "text-natural-50" : MUTED,
            FOCUS,
          )}
        >
          {working && (
            <span aria-hidden className="contents">
              <Spinner size="xs" />
            </span>
          )}
          {stopped && !working && (
            <FontAwesomeIcon
              icon={faCircleStop}
              data-testid="agent-steps-stop-icon"
              aria-hidden
              className="size-3.5"
            />
          )}
          <span data-testid="agent-steps-summary" className="tabular-nums">
            {headerActivity && open ? (
              // Open: the rows carry the current action, the header only says
              // the run is going, with the clock muted.
              <>
                <span data-testid="agent-steps-working">Working</span>{" "}
                {run.start !== null && <LiveClock start={run.start} />}
              </>
            ) : headerActivity ? (
              // Folded while live: the one line names the current action.
              <>
                <span data-testid="agent-steps-activity">
                  {headerSplit ? (
                    <>
                      <span className="sr-only">{headerActivity}</span>
                      <span aria-hidden className="inline-flex items-center">
                        <span className="mr-1.5">{headerSplit.verb}</span>
                        {headerSplit.targets.map((target) => (
                          <TargetChip key={`${target.kind}:${target.label}`} target={target} />
                        ))}
                        {headerSplit.secondary && (
                          <span data-testid="agent-steps-activity-server" className={cn("ml-1", MUTED)}>
                            {headerSplit.secondary}
                          </span>
                        )}
                        <span>…</span>
                      </span>
                    </>
                  ) : (
                    headerActivity
                  )}
                </span>{" "}
                {run.start !== null && <LiveClock start={run.start} />}
              </>
            ) : label ? (
              // Head and counts in Secondary text, as the preview: the block
              // reads as secondary next to the answer.
              <>
                <span data-testid="agent-steps-summary-head">{label.head}</span>
                {restPart ? <span>, {restPart}</span> : null}
                {failedPart && (
                  <span>
                    ,{" "}
                    <span data-testid="agent-steps-failed" className="text-danger-300">
                      {failedPart}
                    </span>
                  </span>
                )}
              </>
            ) : null}
          </span>
          <FontAwesomeIcon
            icon={faChevronDown}
            aria-hidden
            className="size-2.5 transition-transform group-data-[state=open]:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=open]:animate-agent-steps-down data-[state=closed]:animate-agent-steps-up">
          {hasRows(view) && (
            <ul ref={rowsRef} className={cn(RAIL, "mt-1")}>
              {view.rows.map((row) => (
                <StepRow key={row.key} row={row} />
              ))}
            </ul>
          )}
        </CollapsibleContent>
        {/* Folded after the turn, failed rows stay in sight under the header
            (AI Elements, assistant-ui Elements). */}
        {!open && !working && !rowsMounted && failedRows.length > 0 && (
          <ul data-testid="agent-steps-failed-rows" className={cn(RAIL, "mt-1")}>
            {failedRows.map((row) => (
              <StepRow key={row.key} row={row} />
            ))}
          </ul>
        )}
      </div>
    </Collapsible>
    </BlockContextValue.Provider>
  );
};

/** Memoised: a streamed answer token rerenders the message, not the block. */
export const AgentSteps = memo(AgentStepsBlock);
