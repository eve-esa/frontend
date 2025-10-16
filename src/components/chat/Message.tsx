import { useState, useEffect, useRef } from "react";
import SmartText from "@/components/ui/SmartText";
import { MessageFooter } from "./MessageFooter";
import type { MessageType } from "@/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMessageAtTop } from "@/hooks/useMessageAtTop";
import { cn } from "@/lib/utils";
import { useSmoothStream } from "@/hooks/useSmoothStream";

type MessageProps = {
  message: MessageType;
  isSending: boolean;
  isLastMessage: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  messageIndex?: number;
};

export const Message = ({
  message,
  isSending,
  isLastMessage,
  scrollContainerRef,
  messageIndex,
}: MessageProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const messageRef = useRef<HTMLDivElement | null>(null);

  // Use custom hook for scroll detection
  const isOnTop = useMessageAtTop({
    messageRef,
    scrollContainerRef,
    messageId: message.id,
    isLastMessage,
    isExpanded,
  });

  const textRef = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);

  const showLoading = isSending && isLastMessage && !message?.output;

  const isStreamingTarget = isSending && isLastMessage;
  const persistKey = `${message.conversation_id ?? ""}:${String(
    messageIndex ?? (isLastMessage ? "last" : "")
  )}`;
  const smoothed = useSmoothStream(message.output || "", isStreamingTarget, {
    ratePerSecond: 100,
    chunkSize: 1,
  }, persistKey);
  const effectiveOutput = smoothed.length >= (message.output?.length || 0)
    ? message.output
    : smoothed;

  // Check if text overflows
  useEffect(() => {
    if (textRef.current) {
      const hasOverflow =
        textRef.current.scrollHeight > textRef.current.clientHeight;
      setIsOverflowing(hasOverflow);
    }
  }, [message.input]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className="bg-natural-900 rounded-tl-[20px] rounded-br-[20px] pb-4 pt-0 relative"
      ref={messageRef}
    >
      {/* REQUEST SECTION */}
      <div
        ref={(el) => {
          stickyRef.current = el;
        }}
        className={cn(
          "flex flex-col gap-2 bg-natural-900 md:py-6 py-4 border-b border-primary-50 z-10",
          !isExpanded && "sticky top-0"
        )}
      >
        <div
          ref={(el) => {
            textRef.current = el;
          }}
          className={`md:text-xl text-lg 3xl:text-[36px] overflow-hidden !leading-tight ${
            isOnTop
              ? "line-clamp-1"
              : isExpanded
              ? "line-clamp-none"
              : "line-clamp-3"
          }`}
        >
          {message.input}
        </div>
        {isOverflowing && !isExpanded && !isOnTop && (
          <div
            onClick={toggleExpanded}
            className="flex items-center justify-start w-fit leading-none cursor-pointer text-sm text-natural-200 text-center select-none hover:bg-primary-500 px-2 py-1 rounded-md transition-colors"
          >
            Show more
          </div>
        )}
        {isExpanded && !isOnTop && (
          <div
            onClick={toggleExpanded}
            className="flex items-center justify-start w-fit leading-none cursor-pointer text-sm text-natural-200 text-center select-none hover:bg-primary-500 px-2 py-1 rounded-md transition-colors"
          >
            Show less
          </div>
        )}
      </div>

      {/* ANSWER SECTION */}
      <div className="md:pt-8 pt-4 px-[1px]">
        {effectiveOutput ? (
          <SmartText text={effectiveOutput} />
        ) : showLoading ? (
          <div className="flex flex-col gap-2 text-natural-600">
            <Skeleton className="w-full h-2 max-w-[98%]" />
            <Skeleton className="w-full h-2 max-w-[100%]" />
            <Skeleton className="w-full h-2 max-w-[97%]" />
            <Skeleton className="w-full max-w-[87%] h-2" />
            <Skeleton className="w-full max-w-[40%] h-2" />
          </div>
        ) : (
          <p className="text-danger-400">
            Something went wrong! Retry please your request.
          </p>
        )}
      </div>

      {/* FOOTER SECTION */}
      <div className="pt-8">
        {!showLoading && <MessageFooter message={message} />}
      </div>
    </div>
  );
};
