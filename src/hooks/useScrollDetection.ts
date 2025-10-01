import { useEffect, useRef, useCallback } from "react";

export const useScrollDetection = (
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
) => {
  const scrollButtonRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current && scrollButtonRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        scrollContainerRef.current;

      const hasScrollableContent = scrollHeight > clientHeight;
      const isScrolledUp =
        hasScrollableContent && scrollTop < scrollHeight - clientHeight - 50;

      scrollButtonRef.current.setAttribute(
        "data-show-scroll-button",
        isScrolledUp ? "true" : "false"
      );
    }
  }, [scrollContainerRef]);

  // Setup scroll event listener with throttling
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [scrollContainerRef, handleScroll]);

  return { scrollButtonRef };
};
