import type { AgenticTraceStep } from "@/types";

const TRACE_BODY_FIELDS = ["content", "preview", "output", "text"] as const;

const readStringField = (step: AgenticTraceStep, field: string): string | null => {
  const value = step[field];
  return typeof value === "string" && value.trim() ? value : null;
};

export const formatAgenticTraceStepLabel = (step: AgenticTraceStep): string => {
  const type = readStringField(step, "type") ?? "step";
  const name =
    readStringField(step, "name") ??
    readStringField(step, "tool") ??
    readStringField(step, "tool_name");

  return name ? `${type}: ${name}` : type;
};

export const formatAgenticTraceStepBody = (step: AgenticTraceStep): string => {
  for (const field of TRACE_BODY_FIELDS) {
    const value = readStringField(step, field);
    if (value) return value;
  }

  return JSON.stringify(step, null, 2);
};
