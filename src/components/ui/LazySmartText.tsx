import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";

// The markdown and KaTeX stack (react-markdown, remark, rehype, parse5, katex)
// is the heaviest part of the bundle and is only needed once a chat renders.
// Loading it on demand keeps it out of the entry chunk, which every first visit
// downloads before the OIDC redirect.
const loadSmartText = () => import("./SmartText");

const SmartText = lazy(loadSmartText);

// Starts the download ahead of the first message, so a chat rarely shows the
// fallback. Safe to call more than once: the module promise is cached.
export const preloadSmartText = () => {
  void loadSmartText();
};

type LazySmartTextProps = {
  text: string;
  className?: string;
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

const LazySmartText = (props: LazySmartTextProps) => (
  <Suspense fallback={<SmartTextFallback {...props} />}>
    <SmartText {...props} />
  </Suspense>
);

export default LazySmartText;
