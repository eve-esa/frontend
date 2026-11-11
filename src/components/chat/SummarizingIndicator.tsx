import { Spinner } from "@/components/ui/Spinner";

// Shown on the in-progress assistant message while the deep agent compresses
// older history. Not part of the answer: copy and export read `message.output`.
export const SummarizingIndicator = () => (
  <div
    role="status"
    aria-live="polite"
    data-testid="summarizing-indicator"
    className="flex items-center gap-2 text-sm text-natural-500"
  >
    <span aria-hidden="true">
      <Spinner size="xs" />
    </span>
    Summarizing earlier messages…
  </div>
);
