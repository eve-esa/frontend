import { useState, useEffect, useRef } from "react";
import SmartText from "@/components/ui/SmartText";
import { MessageFooter } from "./MessageFooter";
import type { MessageType } from "@/types";
import { Skeleton } from "@/components/ui/Skeleton";
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
  const textRef = useRef<HTMLDivElement | null>(null);

  const showLoading = isSending && isLastMessage && !message?.output;

  const isStreamingTarget = isSending && isLastMessage;
  const persistKey = `${message.conversation_id ?? ""}:${String(
    messageIndex ?? (isLastMessage ? "last" : "")
  )}`;
  const smoothed = useSmoothStream(
    message.output || "",
    isStreamingTarget,
    {
      ratePerSecond: 100,
      chunkSize: 1,
    },
    persistKey
  );
  const effectiveOutput =
    smoothed.length >= (message.output?.length || 0)
      ? message.output
      : smoothed;

  // Track whether the user is near the bottom of the scroll container
  const [isUserNearBottom, setIsUserNearBottom] = useState(true);

  useEffect(() => {
    if (!isLastMessage) return; // only one listener for the list
    const container = scrollContainerRef?.current;
    if (!container) return;

    const threshold = 20; // px buffer from bottom to still consider "near bottom"
    const handleScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - (container.scrollTop + container.clientHeight);
      setIsUserNearBottom(distanceFromBottom <= threshold);
    };

    // Initialize state immediately in case we're already scrolled
    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll as EventListener);
    };
  }, [scrollContainerRef, isLastMessage]);

  // Autoscroll while streaming so the newest tokens remain visible
  useEffect(() => {
    if (!isStreamingTarget) return;
    const container = scrollContainerRef?.current;
    if (!container) return;

    // Only auto-scroll if user hasn't scrolled away from the bottom area
    if (isUserNearBottom) {
      container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
    }
  }, [
    effectiveOutput,
    scrollContainerRef,
    isUserNearBottom,
    isStreamingTarget,
  ]);

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

  const isRequery = message.metadata?.prompts?.rag_decision_result?.use_rag;
  const requery = `**Searched for: ${
    message.metadata?.prompts?.rag_decision_result?.requery || message.input
  }**\n\n`;

  return (
    <div className="flex flex-col gap-3" ref={messageRef}>
      {/* USER BUBBLE */}
      <div className="flex justify-end">
        <div className="max-w-[min(1200px,90%)] bg-primary-900 border-2 border-primary-400 text-natural-50 rounded-2xl rounded-br-sm px-4 py-3 shadow-sm">
          <div
            ref={(el) => {
              textRef.current = el;
            }}
            className={cn(
              "md:text-base text-sm 3xl:text-2xl whitespace-pre-wrap break-words overflow-hidden",
              isExpanded ? "line-clamp-none" : "line-clamp-6"
            )}
          >
            {message.input}
          </div>
          {isOverflowing && !isExpanded && (
            <div
              onClick={toggleExpanded}
              className="mt-2 w-fit leading-none cursor-pointer text-xs text-primary-200 select-none hover:text-primary-100"
            >
              Show more
            </div>
          )}
          {isExpanded && (
            <div
              onClick={toggleExpanded}
              className="mt-2 w-fit leading-none cursor-pointer text-xs text-primary-200 select-none hover:text-primary-100"
            >
              Show less
            </div>
          )}
        </div>
      </div>

      {/* ASSISTANT BUBBLE */}
      <div className="bg-natural-900 rounded-tl-[20px] rounded-br-[20px] pb-4 pt-0 relative">
        <div className="md:pt-8 pt-4 px-[1px]">
          {effectiveOutput ? (
            <SmartText text={`${isRequery ? requery : ""}${effectiveOutput}`} />
          ) : showLoading ? (
            <div className="flex flex-col gap-2 text-natural-600">
              {Array.isArray(message.pre_answer_notices) &&
                message.pre_answer_notices.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {message.pre_answer_notices.map((notice, idx) => (
                      <div
                        key={idx}
                        className="text-base font-bold text-natural-50 animate-pulse"
                      >
                        {notice}
                      </div>
                    ))}
                  </div>
                )}
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
    </div>
  );
};
