import { useState, useRef, useEffect } from "react";
import { type Document } from "@/types";
import SmartText from "@/components/ui/SmartText";

export const SourceContent = ({ source }: { source: Document }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const text = source?.payload?.content ?? source?.text ?? "No text";

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [text]);

  return (
    <div className="!text-[13px] 3xl:text-xl text-natural-200 bg-primary-200 border-l border-neutral-200">
      <div
        className="relative text-sm leading-6  py-1 px-2 pr-1 rounded-tr-md rounded-br-md  overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? `${contentHeight + 60}px` : "8rem",
        }}
      >
        <div ref={contentRef}>
          <SmartText text={text} className="block !text-sm 3xl:!text-xl" />
        </div>

        {!isExpanded && text.length > 150 && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-primary-200 to-transparent pointer-events-none transition-opacity duration-300" />
        )}
      </div>
      {text.length > 150 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs hover:underline cursor-pointer px-2 w-full text-natural-200 hover:text-natural-50 mb-2 text-end transition-colors duration-200"
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
};
