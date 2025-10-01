import { useRef, useEffect, useCallback } from "react";
import { useScrollDetection } from "./useScrollDetection";

export const useScrollToBottom = (
  hasMessages: boolean,
  isInitialLoad: boolean
) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { scrollButtonRef } = useScrollDetection(scrollContainerRef);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  useEffect(() => {
    if (hasMessages) {
      if (isInitialLoad) {
        // Initial load - scroll immediately without animation
        scrollToBottom("auto");
      } else {
        // New message - scroll smoothly
        scrollToBottom("smooth");
      }
    }
  }, [hasMessages, isInitialLoad]);

  return {
    scrollContainerRef,
    scrollButtonRef,
    messagesEndRef,
    scrollToBottom,
  };
};
