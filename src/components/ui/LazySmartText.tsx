import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { unmarkText, type MarkerInstance } from "@/utilities/citations";
import { STREAMDOWN_ENABLED } from "@/utilities/features";
import SmartTextSkeleton from "./SmartTextSkeleton";

// The markdown and KaTeX stack (react-markdown, remark, rehype, parse5, katex)
// is the heaviest part of the bundle and is only needed once a chat renders.
// Loading it on demand keeps it out of the entry chunk, which every first visit
// downloads before the OIDC redirect.
// FEATURE_STREAMDOWN picks the renderer; off loads exactly the module it always did.
const loadSmartText = () =>
  STREAMDOWN_ENABLED ? import("./StreamdownText") : import("./SmartText");

const SmartText = lazy(loadSmartText);

// Runs once the browser is idle, or after two seconds at the latest.
const whenIdle = (task: () => void) => {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(task, { timeout: 2000 });
  } else {
    setTimeout(task, 1);
  }
};

// Starts the download ahead of the first message, so a chat rarely shows the
// fallback. Safe to call more than once: the module promise is cached. With
// Streamdown the math chunk (remark-math, rehype-katex, katex and its CSS)
// follows as soon as the app is idle, so a formula renders on first paint
// instead of after its own download; Mermaid loads only for an answer that has
// a diagram (StreamdownText).
export const preloadSmartText = () => {
  void loadSmartText();
  if (!STREAMDOWN_ENABLED) return;
  whenIdle(() => {
    void import("./StreamdownText").then(({ loadMathPlugin }) => loadMathPlugin());
  });
};

type LazySmartTextProps = {
  text: string;
  className?: string;
  /** The answer is still arriving: an unclosed formula is held back. */
  isStreaming?: boolean;
  /** Inline citation markers placed in `text` (see SmartText). */
  markers?: readonly MarkerInstance[];
};

// Same wrapper classes as SmartText, raw text with line breaks kept: layout stays
// put while the renderer loads, and short texts show no spinner flash.
const SmartTextFallback = ({ text, className }: LazySmartTextProps) => (
  <div
    className={cn(
      "text-natural-200 leading-6 smarttext whitespace-pre-wrap",
      className,
    )}
  >
    {text}
  </div>
);

// With Streamdown the fallback is a neutral skeleton: the raw text showed the
// markdown source (`**`, `\[`, `\text{}`) until the renderer arrived.
const Fallback = STREAMDOWN_ENABLED ? SmartTextSkeleton : SmartTextFallback;

const LazySmartText = (props: LazySmartTextProps) => (
  <Suspense
    fallback={
      <Fallback
        text={props.markers ? unmarkText(props.text, props.markers) : props.text}
        className={props.className}
      />
    }
  >
    <SmartText {...props} />
  </Suspense>
);

export default LazySmartText;
