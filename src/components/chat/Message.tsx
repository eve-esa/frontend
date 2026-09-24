import { useState, useEffect, useRef } from "react";
import SmartText from "@/components/ui/SmartText";
import { MessageFooter } from "./MessageFooter";
import type { MessageType } from "@/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useSmoothStream } from "@/hooks/useSmoothStream";
import { AuthenticatedImage } from "@/components/ui/AuthenticatedImage";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { ArtifactDownloadChip } from "@/components/ui/ArtifactDownloadChip";
import { toImageAttachment } from "@/utilities/attachments";
import { stripIncompleteImage } from "@/utilities/stripIncompleteImage";
import { createAutoFollow } from "@/utilities/autoFollow";
import {
  monotonicStreamingOutput,
  selectStreamingCandidate,
} from "@/utilities/streamingOutput";
import { ToolActivityBar } from "./ToolActivityBar";

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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);

  const attachments = (message.attachments ?? []).map(toImageAttachment);
  // Only images join the thumbnail grid + lightbox; other uploads (pdf, csv,
  // ...) render as download chips. The lightbox indexes the image list only.
  const imageAttachments = attachments.filter((a) =>
    (a.content_type ?? "").startsWith("image/"),
  );
  const fileAttachments = attachments.filter(
    (a) => !(a.content_type ?? "").startsWith("image/"),
  );

  const isStreamingTarget = isSending && isLastMessage;

  // Tool activity only renders on the active streaming target: once the turn
  // is persisted the bar disappears (the trace footer takes over from there).
  const toolActivity = message.tool_activity ?? [];
  const showToolActivity = isStreamingTarget && toolActivity.length > 0;

  const awaitingOutput = isLastMessage && !message?.output;
  const showLoading =
    awaitingOutput &&
    (isSending ||
      Boolean(message.pre_answer_notices?.length) ||
      showToolActivity);
  const persistKey = `${message.conversation_id ?? ""}:${String(
    messageIndex ?? (isLastMessage ? "last" : ""),
  )}`;
  const smoothed = useSmoothStream(
    message.output || "",
    isStreamingTarget,
    {
      ratePerSecond: 100,
      chunkSize: 1,
      stopImmediately: Boolean(message.stopped),
    },
    persistKey,
  );
  // The rendered length must never go backward. When the smooth-stream queue
  // momentarily empties the candidate below flips from the full `output` to a
  // shorter `smoothed` prefix; showing that made the tail characters appear,
  // vanish, and re-type. Hold the high-water mark in a ref and slice the fuller
  // source so the answer only ever grows. Reset it when this slot switches to a
  // different message (persistKey changes) so a new turn types from the start.
  const shownLengthRef = useRef(0);
  const lastPersistKeyRef = useRef(persistKey);
  if (lastPersistKeyRef.current !== persistKey) {
    lastPersistKeyRef.current = persistKey;
    shownLengthRef.current = 0;
  }
  const candidateOutput = selectStreamingCandidate(
    smoothed,
    message.output || "",
    isStreamingTarget,
  );
  const { text: effectiveOutput, shownLength } = monotonicStreamingOutput(
    candidateOutput,
    message.output || "",
    shownLengthRef.current,
  );
  shownLengthRef.current = shownLength;

  // While this message is the active streaming target, drop a trailing
  // half-typed image token so no raw markdown flashes and no partial URL is
  // fetched. Persisted/complete messages are rendered verbatim.
  const displayOutput =
    isStreamingTarget && effectiveOutput
      ? stripIncompleteImage(effectiveOutput)
      : effectiveOutput;

  // Whether autoscroll should keep the view pinned to the bottom. A closure
  // behind a ref, not state: the autoscroll effect below runs on every
  // smooth-stream frame and needs the current value synchronously, while a
  // state read is one render stale and its own scrollTo re-latched it, which
  // is what made scroll-up during streaming snap back (20 = px buffer from
  // the bottom that still counts as "near bottom").
  const autoFollowRef = useRef(createAutoFollow(20));
  // Coalesces autoscroll to one scrollTo per animation frame (see the effect
  // below); holds the pending frame id, or null when none is queued.
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isLastMessage) return; // only one listener for the list
    const container = scrollContainerRef?.current;
    if (!container) return;

    const handleScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - (container.scrollTop + container.clientHeight);
      autoFollowRef.current.onScroll(distanceFromBottom);
    };
    const handleWheel = (e: WheelEvent) => {
      autoFollowRef.current.onWheel(e.deltaY);
    };

    // Initialize immediately in case we're already scrolled: no
    // markProgrammatic has run yet, so this just measures.
    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll as EventListener);
      container.removeEventListener("wheel", handleWheel as EventListener);
    };
  }, [scrollContainerRef, isLastMessage]);

  // Autoscroll while streaming so the newest tokens remain visible, coalesced
  // to one scrollTo per animation frame. effectiveOutput can change up to
  // ~100x/second; a synchronous scrollTo on each change thrashed layout on the
  // streaming hot path. The guard drops extra changes within the same frame,
  // and the queued frame scrolls once to the latest bottom.
  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) return;
    if (scrollRafRef.current !== null) return; // a scroll is already queued
    if (!autoFollowRef.current.shouldFollow()) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = scrollContainerRef?.current;
      if (!el) return;
      // Re-check: the user may have scrolled up between scheduling and now.
      if (!autoFollowRef.current.shouldFollow()) return;
      // This scrollTo fires the scroll handler above; arming the one-shot flag
      // keeps that programmatic event from re-engaging follow over a scroll-up.
      autoFollowRef.current.markProgrammatic();
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    });
  }, [effectiveOutput, scrollContainerRef]);

  // Cancel any queued autoscroll frame on unmount.
  useEffect(
    () => () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    },
    [],
  );

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
          {imageAttachments.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {imageAttachments.map((attachment, index) => (
                <AuthenticatedImage
                  key={attachment.id || `${attachment.url}-${index}`}
                  src={attachment.url}
                  alt={attachment.filename}
                  onClick={() => setLightboxIndex(index)}
                  data-testid="message-attachment-image"
                  className="h-28 w-full rounded-lg object-cover cursor-zoom-in"
                />
              ))}
            </div>
          )}
          {fileAttachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {fileAttachments.map((attachment, index) => (
                <ArtifactDownloadChip
                  key={attachment.id || `${attachment.url}-${index}`}
                  href={attachment.url}
                  filename={attachment.filename}
                />
              ))}
            </div>
          )}
          <div
            ref={(el) => {
              textRef.current = el;
            }}
            className={cn(
              "md:text-base text-sm 3xl:text-2xl whitespace-pre-wrap break-words overflow-hidden",
              isExpanded ? "line-clamp-none" : "line-clamp-6",
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
            <>
              {/* Above the answer so the chips stay visible while tokens
                  stream, instead of vanishing at the first token. */}
              {showToolActivity && (
                <div className="mb-3">
                  <ToolActivityBar activity={toolActivity} />
                </div>
              )}
              <SmartText text={`${isRequery ? requery : ""}${displayOutput}`} />
              {message.stopped && (
                <p className="mt-2 text-sm text-natural-500 italic">
                  Generation stopped
                </p>
              )}
            </>
          ) : showLoading ? (
            <div className="flex flex-col gap-2 text-natural-600">
              {message.pre_answer_notices?.length ? (
                <div className="mb-2 space-y-1">
                  {message.pre_answer_notices.map((notice, idx) => (
                    <div
                      key={`notice-${idx}`}
                      className="text-base font-bold text-natural-50 animate-pulse"
                    >
                      {notice}
                    </div>
                  ))}
                </div>
              ) : null}
              {showToolActivity && <ToolActivityBar activity={toolActivity} />}
              {!message.pre_answer_notices?.length && !showToolActivity && (
                <>
                  <Skeleton className="w-full h-2 max-w-[98%]" />
                  <Skeleton className="w-full h-2 max-w-[100%]" />
                  <Skeleton className="w-full h-2 max-w-[97%]" />
                  <Skeleton className="w-full max-w-[87%] h-2" />
                  <Skeleton className="w-full max-w-[40%] h-2" />
                </>
              )}
            </div>
          ) : message.stopped ? (
            <p className="text-sm text-natural-500 italic">
              Generation stopped
            </p>
          ) : !message.output &&
            !isSending &&
            (isLastMessage
              ? !message.pre_answer_notices?.length
              : // A failed turn the user moved past would otherwise render as
                // a blank bubble with no trace of what happened.
                Boolean(message.metadata?.error)) ? (
            <p className="text-danger-400">
              {message.metadata?.error?.code === "timeout"
                ? "The model did not answer in time. It may be warming up: retry in a moment."
                : message.metadata?.error?.code === "empty_answer"
                  ? "The model returned an empty answer. Retry in a moment."
                  : "Something went wrong! Retry please your request."}
            </p>
          ) : null}
        </div>

        {/* FOOTER SECTION */}
        {/* A turn that produced no output has nothing to attribute or
            hallucination-check: no footer, and no padding for it either. The
            spacer used to render unconditionally, leaving 2rem of nothing
            under a stopped or failed message. */}
        {!showLoading && Boolean(message.output) && (
          <div className="pt-8">
            <MessageFooter message={message} />
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={imageAttachments.map((attachment) => ({
            src: attachment.url,
            alt: attachment.filename,
          }))}
          initialIndex={lightboxIndex}
          open={lightboxIndex !== null}
          onOpenChange={(open) => !open && setLightboxIndex(null)}
        />
      )}
    </div>
  );
};
