import type { TraceStepKind } from "@/utilities/agentTrace";

// Written out in full so Tailwind sees every class. The colours are the
// --color-trace-* tokens in index.css.
export const TRACE_KIND_CLASSES: Record<
  TraceStepKind,
  { accent: string; badge: string; fill: string }
> = {
  agent: {
    accent: "border-l-trace-agent",
    badge: "bg-trace-agent/15 text-trace-agent",
    fill: "bg-trace-agent",
  },
  tool: {
    accent: "border-l-trace-tool",
    badge: "bg-trace-tool/15 text-trace-tool",
    fill: "bg-trace-tool",
  },
  answer: {
    accent: "border-l-trace-answer",
    badge: "bg-trace-answer/15 text-trace-answer",
    fill: "bg-trace-answer",
  },
  other: {
    accent: "border-l-primary-300",
    badge: "bg-primary-300/15 text-primary-300",
    fill: "bg-primary-300",
  },
};
