import { useState, useEffect, type RefObject } from "react";

interface UseMessageAtTopProps {
  messageRef: RefObject<HTMLDivElement | null>;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  messageId: string;
  isLastMessage: boolean;
  isExpanded: boolean;
}

export const useMessageAtTop = ({
  messageRef,
  scrollContainerRef,
  messageId,
  isLastMessage,
  isExpanded,
}: UseMessageAtTopProps) => {
  const [isOnTop, setIsOnTop] = useState(false);

  useEffect(() => {
    if (!scrollContainerRef?.current || isLastMessage || isExpanded) return;

    const scrollContainer = scrollContainerRef.current;

    const handleScroll = () => {
      if (!messageRef.current || !scrollContainerRef.current) return;

      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      const messageRect = messageRef.current.getBoundingClientRect();

      const relativeTop = messageRect.top - containerRect.top;
      const relativeBottom = messageRect.bottom - containerRect.top;
      const messageHeight = messageRect.height;

      const messageCompletelyAboveContainer = relativeBottom <= 0;
      const messageNearOrAtTop = relativeTop >= -20 && relativeTop <= 50;
      const messagePartiallyVisible = relativeTop < 0 && relativeBottom > 0;

      const isAtTop =
        // If message is completely above container, it's no longer at top
        !messageCompletelyAboveContainer &&
        // Message is near or at the top
        (messageNearOrAtTop ||
          // Message is partially above but still significantly visible
          (messagePartiallyVisible && relativeBottom > 60) ||
          // Large message that dominates the view
          (relativeTop < 0 && messageHeight > 200 && relativeBottom > 100));

      setIsOnTop((prev) => (prev !== isAtTop ? isAtTop : prev));
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [scrollContainerRef, messageRef, messageId, isLastMessage, isExpanded]);

  return isOnTop;
};
