import { useMemo, type ReactNode, type Ref } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faCircleCheck,
  faCircleXmark,
} from "@fortawesome/free-solid-svg-icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import { CopyButton } from "@/components/ui/CopyButton";
import { ExpandableContent } from "@/components/ui/ExpandableContent";
import { ExpandablePlainText } from "@/components/ui/ExpandablePlainText";
import { JsonTree } from "@/components/ui/JsonTree";
import SmartText from "@/components/ui/SmartText";
import { cn } from "@/lib/utils";
import {
  DISPLAY_TEXT_LIMIT,
  formatDuration,
  formatTokenCount,
  truncateForDisplay,
  truncateText,
  type AgentStepView,
  type AnswerStepView,
  type OtherStepView,
  type ToolStatus,
  type ToolStepView,
  type TraceStepView,
} from "@/utilities/agentTrace";
import { TRACE_KIND_CLASSES } from "./traceKindClasses";

const isContainer = (value: unknown): value is object =>
  typeof value === "object" && value !== null;

const toCopyText = (value: unknown): string =>
  typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? "");

const Muted = ({ children }: { children: ReactNode }) => (
  <p className="text-xs italic text-primary-300">{children}</p>
);

const CodeBox = ({ children }: { children: ReactNode }) => (
  <div className="rounded-md border border-primary-400/40 bg-primary-600 px-2.5 py-2">
    {children}
  </div>
);

type TraceSectionProps = {
  title: string;
  copyText?: string;
  copyLabel?: string;
  children: ReactNode;
};

const TraceSection = ({
  title,
  copyText,
  copyLabel,
  children,
}: TraceSectionProps) => (
  <section className="flex flex-col gap-1">
    <div className="flex min-h-6 items-center justify-between gap-2">
      <h4 className="text-xs text-primary-300">{title}</h4>
      {copyText !== undefined && copyLabel && (
        <CopyButton
          value={copyText}
          label={copyLabel}
          className="p-1 has-[>svg]:p-1"
        />
      )}
    </div>
    {children}
  </section>
);

const MetaList = ({ items }: { items: [string, string | null][] }) => {
  const shown = items.filter((item): item is [string, string] => Boolean(item[1]));
  if (shown.length === 0) return null;
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-4">
      {shown.map(([label, value]) => (
        <div key={label} className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 text-primary-300">{label}</dt>
          <dd className="min-w-0 text-natural-200 tabular-nums [overflow-wrap:anywhere]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
};

const formatTokens = (step: AgentStepView): string | null => {
  const parts = [
    step.inputTokens !== null ? `${formatTokenCount(step.inputTokens)} in` : null,
    step.outputTokens !== null ? `${formatTokenCount(step.outputTokens)} out` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
};

const AgentBody = ({ step }: { step: AgentStepView }) => (
  <>
    {step.toolCalls.length > 0 && (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-primary-300">Requested</span>
        {step.toolCalls.map((call, index) => (
          <code
            key={`${call.id ?? call.name}-${index}`}
            className="rounded-sm border border-primary-400/60 bg-primary-500 px-1.5 font-mono text-[12px] leading-5 text-natural-100 [overflow-wrap:anywhere]"
          >
            {call.name}
          </code>
        ))}
      </div>
    )}
    <MetaList
      items={[
        ["Model", step.model],
        ["Tokens", formatTokens(step)],
        ["Finish reason", step.finishReason],
      ]}
    />
    {step.content.trim() !== "" && (
      <SmartText text={step.content} className="text-sm" />
    )}
  </>
);

const ToolOutputView = ({ step }: { step: ToolStepView }) => {
  const { output } = step;
  const displayValue = useMemo(
    () => (output.kind === "json" ? truncateForDisplay(output.value) : null),
    [output],
  );

  if (output.kind === "empty") return <Muted>No output</Muted>;
  if (output.kind === "text") {
    return (
      <ExpandablePlainText
        text={truncateText(output.text, DISPLAY_TEXT_LIMIT)}
        textClassName="font-mono !text-[12px] leading-5"
      />
    );
  }
  return (
    <CodeBox>
      <JsonTree data={displayValue as object} expand="top" label="Tool output" />
    </CodeBox>
  );
};

const ToolBody = ({ step }: { step: ToolStepView }) => {
  const { input, inputRecorded, output } = step;
  const isEmptyInput =
    isContainer(input) && Object.keys(input).length === 0;

  return (
    <>
      <TraceSection
        title="Input"
        copyText={
          !inputRecorded || isEmptyInput ? undefined : toCopyText(input)
        }
        copyLabel="Copy input"
      >
        {!inputRecorded ? (
          <Muted>Not recorded for this answer</Muted>
        ) : isEmptyInput ? (
          <Muted>No arguments</Muted>
        ) : isContainer(input) ? (
          <CodeBox>
            <JsonTree data={input} expand="all" label="Tool input" />
          </CodeBox>
        ) : (
          <CodeBox>
            <pre className="whitespace-pre-wrap font-mono text-[12px] leading-5 text-natural-100 [overflow-wrap:anywhere]">
              {String(input)}
            </pre>
          </CodeBox>
        )}
      </TraceSection>
      <TraceSection
        title="Output"
        copyText={output.kind === "empty" ? undefined : output.copyText}
        copyLabel="Copy output"
      >
        <ToolOutputView step={step} />
      </TraceSection>
    </>
  );
};

const AnswerBody = ({ step }: { step: AnswerStepView }) =>
  step.content.trim() === "" ? (
    <Muted>No content</Muted>
  ) : (
    <ExpandableContent collapsedHeight={180} fadeClassName="from-primary-200">
      <SmartText text={step.content} className="text-sm" />
    </ExpandableContent>
  );

const OtherBody = ({ step }: { step: OtherStepView }) => {
  const displayValue = useMemo(() => truncateForDisplay(step.raw), [step.raw]);
  return (
    <TraceSection
      title="Data"
      copyText={toCopyText(step.raw)}
      copyLabel="Copy step data"
    >
      <CodeBox>
        <JsonTree data={displayValue as object} expand="top" label="Step data" />
      </CodeBox>
    </TraceSection>
  );
};

const ToolStatusLabel = ({ status }: { status: ToolStatus }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 text-xs",
      status === "error" ? "text-danger-300" : "text-success-200",
    )}
  >
    <FontAwesomeIcon
      icon={status === "error" ? faCircleXmark : faCircleCheck}
      className="size-3"
      aria-hidden
    />
    {status === "error" ? "Error" : "Success"}
  </span>
);

const StepBody = ({ step }: { step: TraceStepView }) => {
  switch (step.kind) {
    case "agent":
      return <AgentBody step={step} />;
    case "tool":
      return <ToolBody step={step} />;
    case "answer":
      return <AnswerBody step={step} />;
    default:
      return <OtherBody step={step} />;
  }
};

type TraceStepCardProps = {
  step: TraceStepView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardRef?: Ref<HTMLLIElement>;
  triggerRef?: Ref<HTMLButtonElement>;
};

/**
 * One step of the agent trace, as a collapsible card: a header that stays
 * visible (step number, kind, title, tool status, duration) and a body laid
 * out per kind. Structure after prompt-kit's Steps and Tool components.
 */
export const TraceStepCard = ({
  step,
  open,
  onOpenChange,
  cardRef,
  triggerRef,
}: TraceStepCardProps) => {
  const classes = TRACE_KIND_CLASSES[step.kind];

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} asChild>
      <li
        ref={cardRef}
        data-testid="trace-step"
        data-kind={step.kind}
        className={cn(
          "scroll-mt-3 rounded-md border border-l-2 border-primary-400/50 bg-primary-200",
          classes.accent,
        )}
      >
        <CollapsibleTrigger
          ref={triggerRef}
          className="group flex w-full cursor-pointer flex-col gap-1 rounded-md px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-50"
        >
          <span className="flex w-full items-center gap-2">
            <span className="text-xs text-primary-300">Step {step.number}</span>
            <span
              className={cn(
                "rounded-sm px-1.5 text-xs leading-[18px]",
                classes.badge,
              )}
            >
              {step.kindLabel}
            </span>
            {step.kind === "tool" && step.status && (
              <ToolStatusLabel status={step.status} />
            )}
            <span className="ml-auto flex items-center gap-2">
              {step.durationS !== null && (
                <span className="text-xs tabular-nums text-natural-200">
                  {formatDuration(step.durationS)}
                </span>
              )}
              <FontAwesomeIcon
                icon={faChevronDown}
                aria-hidden
                className="size-3 text-primary-300 transition-transform group-hover:text-natural-50 group-data-[state=open]:rotate-180"
              />
            </span>
          </span>
          <span
            className={cn(
              "block text-sm leading-5 text-natural-50 [overflow-wrap:anywhere]",
              step.kind === "tool" && "font-mono",
            )}
          >
            {step.title}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-3 border-t border-primary-400/30 px-3 py-3">
            <StepBody step={step} />
          </div>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
};
