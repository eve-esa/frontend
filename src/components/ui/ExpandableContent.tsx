import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ExpandableContentProps = {
  children: ReactNode;
  /** Height in px shown while collapsed. */
  collapsedHeight?: number;
  /** Gradient start colour of the fade, matching the background behind it. */
  fadeClassName?: string;
  className?: string;
};

/**
 * Clamps rich content (markdown, say) to a fixed height with a Show more
 * toggle, the counterpart of ExpandablePlainText for anything that is not a
 * plain string. The toggle only appears when the content actually overflows,
 * measured rather than guessed from a character count.
 */
export const ExpandableContent = ({
  children,
  collapsedHeight = 160,
  fadeClassName = "from-primary-200",
  className,
}: ExpandableContentProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const regionId = useId();

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const measure = () => setContentHeight(element.scrollHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A few px of slack so a line that barely overflows is not hidden behind
  // a toggle that reveals almost nothing.
  const canExpand = contentHeight > collapsedHeight + 8;
  const isClamped = canExpand && !isExpanded;

  return (
    <div className={className}>
      <div
        id={regionId}
        className="relative overflow-hidden"
        style={{ maxHeight: isClamped ? `${collapsedHeight}px` : undefined }}
      >
        <div ref={contentRef}>{children}</div>
        {isClamped && (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t to-transparent",
              fadeClassName,
            )}
          />
        )}
      </div>
      {canExpand && (
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={regionId}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="mt-1 w-full cursor-pointer text-end text-xs text-natural-200 transition-colors hover:text-natural-50 hover:underline"
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
};
