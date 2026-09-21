import { useCallback, useMemo, useRef, useState } from "react";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { AgenticTraceStep } from "@/types";
import {
  buildTimeline,
  formatDuration,
  normalizeTrace,
} from "@/utilities/agentTrace";
import { TraceStepCard } from "./trace/TraceStepCard";
import { TraceTimeline } from "./trace/TraceTimeline";

type AgenticTraceProps = {
  onToggle: () => void;
  trace: AgenticTraceStep[];
  // The user message this trace answered, shown above the steps.
  question?: string;
};

export const AgenticTrace = ({ onToggle, trace, question }: AgenticTraceProps) => {
  const view = useMemo(() => normalizeTrace(trace), [trace]);
  const timeline = useMemo(() => buildTimeline(view), [view]);
  const [openSteps, setOpenSteps] = useState<ReadonlySet<number>>(
    () => new Set(view.steps.map((step) => step.index)),
  );
  const cardRefs = useRef(new Map<number, HTMLLIElement>());
  const triggerRefs = useRef(new Map<number, HTMLButtonElement>());

  const allOpen = view.steps.every((step) => openSteps.has(step.index));

  const setStepOpen = useCallback((index: number, open: boolean) => {
    setOpenSteps((current) => {
      const next = new Set(current);
      if (open) next.add(index);
      else next.delete(index);
      return next;
    });
  }, []);

  const toggleAll = () =>
    setOpenSteps(
      allOpen ? new Set() : new Set(view.steps.map((step) => step.index)),
    );

  const selectStep = (index: number) => {
    setStepOpen(index, true);
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cardRefs.current
      .get(index)
      ?.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    triggerRefs.current.get(index)?.focus({ preventScroll: true });
  };

  const questionText = question?.trim();

  return (
    <div data-testid="agent-trace" className="flex h-full flex-col gap-5 py-6">
      <div className="flex flex-none flex-col gap-4 px-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg 3xl:text-3xl text-natural-50">Agent trace</h2>
          <div className="flex items-center gap-3">
            {view.totalS !== null && (
              <span className="text-xs text-natural-200 tabular-nums">
                <span className="text-primary-300">Total </span>
                {formatDuration(view.totalS)}
              </span>
            )}
            <button
              type="button"
              onClick={onToggle}
              aria-label="Close"
              className="cursor-pointer rounded-md text-primary-50 outline-none transition-colors hover:text-natural-200 focus-visible:ring-2 focus-visible:ring-primary-50"
            >
              <FontAwesomeIcon icon={faTimes} className="h-6" />
            </button>
          </div>
        </div>

        {questionText && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-primary-300">Question</span>
            <p
              className="line-clamp-3 text-sm leading-5 text-natural-100 [overflow-wrap:anywhere]"
              title={questionText}
            >
              {questionText}
            </p>
          </div>
        )}

        {timeline ? (
          <TraceTimeline timeline={timeline} onSelectStep={selectStep} />
        ) : (
          view.isLegacy &&
          view.steps.length > 0 && (
            <p className="text-xs text-primary-300">
              Step timings were not recorded for this answer.
            </p>
          )
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <div className="flex flex-none items-center justify-between gap-2 px-6">
          <h3 className="text-xs text-primary-300">
            Steps ({view.steps.length})
          </h3>
          {view.steps.length > 1 && (
            <button
              type="button"
              onClick={toggleAll}
              className="cursor-pointer rounded-sm text-xs text-natural-200 outline-none transition-colors hover:text-natural-50 hover:underline focus-visible:ring-2 focus-visible:ring-primary-50"
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
        <ol className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-3 mask-y-from-97% mask-y-to-100%">
          {view.steps.map((step) => (
            <TraceStepCard
              key={step.index}
              step={step}
              open={openSteps.has(step.index)}
              onOpenChange={(open) => setStepOpen(step.index, open)}
              cardRef={(element) => {
                if (element) cardRefs.current.set(step.index, element);
                else cardRefs.current.delete(step.index);
              }}
              triggerRef={(element) => {
                if (element) triggerRefs.current.set(step.index, element);
                else triggerRefs.current.delete(step.index);
              }}
            />
          ))}
        </ol>
      </div>
    </div>
  );
};
