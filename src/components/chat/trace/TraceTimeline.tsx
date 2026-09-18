import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  type Timeline,
  type TraceStepKind,
} from "@/utilities/agentTrace";
import { TRACE_KIND_CLASSES } from "./traceKindClasses";

const LEGEND_ORDER: TraceStepKind[] = ["agent", "tool", "answer", "other"];

// A step that took next to nothing still gets a sliver the pointer can find.
const MIN_SEGMENT_WIDTH_PX = 4;

type TraceTimelineProps = {
  timeline: Timeline;
  onSelectStep: (index: number) => void;
};

/**
 * One bar for the whole generation: each step is a segment placed where it
 * started and as wide as it lasted. Segments are buttons, so they can be
 * reached with the keyboard; activating one jumps to its card.
 */
export const TraceTimeline = ({ timeline, onSelectStep }: TraceTimelineProps) => {
  const kinds = LEGEND_ORDER.filter((kind) =>
    timeline.segments.some((segment) => segment.kind === kind),
  );
  const legendLabels = new Map(
    timeline.segments.map((segment) => [segment.kind, segment.kindLabel]),
  );

  return (
    <div data-testid="trace-timeline" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="text-xs text-primary-300">Timeline</h3>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-natural-200">
          {kinds.map((kind) => (
            <li key={kind} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  TRACE_KIND_CLASSES[kind].fill,
                )}
              />
              {kind === "other" ? "Other" : legendLabels.get(kind)}
            </li>
          ))}
        </ul>
      </div>

      <div
        role="group"
        aria-label={`Timeline, ${formatDuration(timeline.totalS)} in total`}
        className="relative h-2.5 w-full rounded-sm bg-primary-600"
      >
        {timeline.segments.map((segment) => {
          const label = `Step ${segment.number}, ${segment.kindLabel}, ${segment.title}, ${formatDuration(segment.durationS)}`;
          return (
            <Tooltip
              key={segment.index}
              disableClick
              content={
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm [overflow-wrap:anywhere]">
                    {segment.title}
                  </span>
                  <span className="text-xs text-primary-300 tabular-nums">
                    Step {segment.number}, {formatDuration(segment.durationS)}
                  </span>
                </span>
              }
            >
              <button
                type="button"
                aria-label={label}
                onClick={() => onSelectStep(segment.index)}
                className={cn(
                  "absolute inset-y-0 cursor-pointer rounded-sm ring-1 ring-primary-600 transition-[filter] hover:brightness-125 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-natural-50",
                  TRACE_KIND_CLASSES[segment.kind].fill,
                )}
                style={{
                  left: `${segment.leftPct}%`,
                  width: `${segment.widthPct}%`,
                  minWidth: MIN_SEGMENT_WIDTH_PX,
                }}
              />
            </Tooltip>
          );
        })}
      </div>

      <div
        aria-hidden
        className="flex justify-between text-xs tabular-nums text-primary-300"
      >
        <span>0 s</span>
        <span>{formatDuration(timeline.totalS)}</span>
      </div>
    </div>
  );
};
