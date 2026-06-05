import { useEffect, useRef, useState } from "react";

const DEFAULT_MIN_LENGTH = 150;

type ExpandablePlainTextProps = {
  text: string;
  minLength?: number;
};

export const ExpandablePlainText = ({
  text,
  minLength = DEFAULT_MIN_LENGTH,
}: ExpandablePlainTextProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [text]);

  const canExpand = text.length > minLength;

  return (
    <div className="text-xs 3xl:text-xl text-natural-200 bg-primary-200 border-l border-neutral-200">
      <div
        className="relative text-sm leading-6 py-1 px-2 pr-1 rounded-tr-md rounded-br-md overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? `${contentHeight + 60}px` : "8rem",
        }}
      >
        <div ref={contentRef}>
          <p className="block !text-sm 3xl:!text-xl whitespace-pre-wrap">{text}</p>
        </div>
        {!isExpanded && canExpand && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-primary-200 to-transparent pointer-events-none transition-opacity duration-300" />
        )}
      </div>
      {canExpand && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs hover:underline cursor-pointer px-2 w-full text-natural-200 hover:text-natural-50 mb-2 text-end transition-colors duration-200"
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
};
