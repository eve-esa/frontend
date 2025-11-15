import {
  faBullseye,
  faCheck,
  faThumbsDown as faThumbsDownSolid,
  faThumbsUp as faThumbsUpSolid,
} from "@fortawesome/free-solid-svg-icons";
import {
  faThumbsDown,
  faThumbsUp,
  faCopy,
} from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@/components/ui/Button";
import SmartText from "@/components/ui/SmartText";
import type { MessageType, ChaMessageType, Document } from "@/types";
import { useSidebar } from "./DynamicSidebarProvider";
import { useClipboard } from "@/hooks/useClipboard";
import { useState } from "react";
import { FeedbackEnum, useSendFeedback } from "@/services/useSendFeedback";
import { postStream, type StreamEvent } from "@/services/streaming";
import { useSmoothStream } from "@/hooks/useSmoothStream";
import { useParams } from "react-router-dom";
import { SendFeedbackDialog } from "./SendFeedbackDialog";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/services/keys";
const IS_STAGING = (import.meta.env.VITE_IS_STAGING ?? "false") === "true";

type MessageFooterProps = {
  message: MessageType;
};

export const MessageFooter = ({ message }: MessageFooterProps) => {
  const { conversationId } = useParams();
  const queryClient = useQueryClient();
  const { copyToClipboard, isCopied } = useClipboard();
  const {
    copyToClipboard: copyToClipboardHallucination,
    isCopied: isHallucCopied,
  } = useClipboard();
  const {
    openDynamicSidebar,
    closeDynamicSidebar,
    isOpenDynamicSidebar,
    content,
  } = useSidebar();
  const [wasCopied, setWasCopied] = useState(message?.was_copied);

  const [isThumbsUp, setIsThumbsUp] = useState(
    message?.feedback === FeedbackEnum.GOOD
  );
  const [isThumbsDown, setIsThumbsDown] = useState(
    message?.feedback === FeedbackEnum.BAD
  );

  const [isSendFeedbackDialogOpen, setIsSendFeedbackDialogOpen] =
    useState(false);

  const { mutate: sendFeedback } = useSendFeedback();

  // Hallucination feedback local state
  const [hallucWasCopied, setHallucWasCopied] = useState(
    message?.hallucination?.was_copied
  );
  const [hallucIsThumbsUp, setHallucIsThumbsUp] = useState(
    message?.hallucination?.feedback === FeedbackEnum.GOOD
  );
  const [hallucIsThumbsDown, setHallucIsThumbsDown] = useState(
    message?.hallucination?.feedback === FeedbackEnum.BAD
  );
  const [isHallucSendFeedbackDialogOpen, setIsHallucSendFeedbackDialogOpen] =
    useState(false);

  const handleLike = () => {
    if (!isThumbsUp) {
      setIsThumbsUp(true);
      setIsThumbsDown(false);
      sendFeedback({
        messageId: message?.id,
        conversationId,
        feedback: FeedbackEnum.GOOD,
      });
      if (conversationId && message?.id) {
        queryClient.setQueryData<ChaMessageType>(
          [QUERY_KEYS.conversation, conversationId],
          (old) => {
            if (!old || !old.messages?.length) return old;
            const newMessages = old.messages.map((m) => {
              if (m.id !== message.id) return m as MessageType;
              return {
                ...(m as MessageType),
                feedback: FeedbackEnum.GOOD,
                feedback_reason: null,
              } as MessageType;
            });
            return { ...old, messages: newMessages };
          }
        );
      }
    }
  };

  const handleDislike = () => {
    if (!isThumbsDown) {
      setIsSendFeedbackDialogOpen(true);
    }
  };

  const handleCopy = () => {
    copyToClipboard(message.output);

    if (!wasCopied) {
      sendFeedback({
        messageId: message?.id,
        conversationId,
        was_copied: true,
      });
      setWasCopied(true);
      if (conversationId && message?.id) {
        queryClient.setQueryData<ChaMessageType>(
          [QUERY_KEYS.conversation, conversationId],
          (old) => {
            if (!old || !old.messages?.length) return old;
            const newMessages = old.messages.map((m) => {
              if (m.id !== message.id) return m as MessageType;
              return {
                ...(m as MessageType),
                was_copied: true,
              } as MessageType;
            });
            return { ...old, messages: newMessages };
          }
        );
      }
    }
  };

  const [hallucinationRaw, setHallucinationRaw] = useState<string>(
    message?.hallucination?.reason ?? ""
  );
  const [isHallucinationStreaming, setIsHallucinationStreaming] =
    useState(false);
  const [hallucinationStatus, setHallucinationStatus] = useState<string>("");
  const [hallucinationSources, setHallucinationSources] = useState<Document[]>(
    message?.hallucination?.top_k_retrieved_docs ?? []
  );
  const [hallucinationLabel, setHallucinationLabel] = useState<number | null>(
    typeof message?.hallucination?.label === "number"
      ? message?.hallucination?.label
      : null
  );
  const [rewrittenQuery, setRewrittenQuery] = useState<string>(
    message?.hallucination?.rewritten_question ?? ""
  );
  const [alternativeRaw, setAlternativeRaw] = useState<string>(
    message?.hallucination?.final_answer ?? ""
  );

  const hallucinationDisplay = useSmoothStream(
    hallucinationRaw,
    isHallucinationStreaming,
    { ratePerSecond: 100, chunkSize: 1 },
    `${conversationId ?? ""}:${message?.id ?? ""}:hallucination`
  );
  const alternativeDisplay = useSmoothStream(
    alternativeRaw,
    isHallucinationStreaming,
    { ratePerSecond: 100, chunkSize: 1 },
    `${conversationId ?? ""}:${message?.id ?? ""}:hallucination:alt`
  );

  const handleHallucinationDetect = async () => {
    if (!conversationId || !message?.id) return;
    setHallucinationRaw("");
    setHallucinationStatus("");
    setHallucinationLabel(null);
    setRewrittenQuery("");
    setAlternativeRaw("");
    setIsHallucinationStreaming(true);
    try {
      await postStream({
        url: `/conversations/${conversationId}/messages/${message.id}/stream-hallucination`,
        payload: {},
        onEvent: (evt: StreamEvent) => {
          const anyEvt = evt as any;
          // Stream tokens
          if (anyEvt?.type === "token" && typeof anyEvt.content === "string") {
            // Alternative answer streams as tokens
            setAlternativeRaw((prev) => prev + anyEvt.content);
            return;
          }

          if (anyEvt?.type === "status" && typeof anyEvt.content === "string") {
            // Replace current status with the latest one
            setHallucinationStatus(anyEvt.content);
            return;
          }

          if (anyEvt?.type === "label" && anyEvt?.content !== undefined) {
            const parsed =
              typeof anyEvt.content === "number"
                ? anyEvt.content
                : Number(anyEvt.content);
            if (!Number.isNaN(parsed)) {
              setHallucinationLabel(parsed);
            }
            return;
          }

          if (anyEvt?.type === "reason" && typeof anyEvt.content === "string") {
            setHallucinationRaw(anyEvt.content);
            return;
          }

          if (
            anyEvt?.type === "rewritten_question" &&
            typeof anyEvt.content === "string"
          ) {
            setRewrittenQuery(anyEvt.content);
            return;
          }

          if (anyEvt?.type === "final") {
            const finalText =
              typeof anyEvt?.answer === "string" ? anyEvt.answer : "";
            setHallucinationStatus("");
            const docs: Document[] = Array.isArray(anyEvt?.top_k_retrieved_docs)
              ? (anyEvt.top_k_retrieved_docs as Document[])
              : Array.isArray(anyEvt?.documents)
              ? (anyEvt.documents as Document[])
              : [];
            if (docs.length > 0) {
              setHallucinationSources(docs);
            }
            const rewritten =
              (anyEvt?.rewritten_question as string) ||
              (anyEvt?.rewritten_query as string) ||
              "";
            if (rewritten) {
              setRewrittenQuery(rewritten);
            }
            if (typeof anyEvt?.reason === "string" && anyEvt.reason.length) {
              setHallucinationRaw(anyEvt.reason);
            }
            if (typeof anyEvt?.label === "number") {
              setHallucinationLabel(anyEvt.label);
            }
            if (finalText) {
              setAlternativeRaw(finalText);
            }

            // Persist final answer into the cache as hallucination result
            queryClient.setQueryData<ChaMessageType>(
              [QUERY_KEYS.conversation, conversationId],
              (old) => {
                if (!old || !old.messages?.length) return old;
                const newMessages = old.messages.map((m) => {
                  if (m.id !== message?.id) return m as MessageType;
                  const existingHallucination =
                    (m as MessageType).hallucination || ({} as any);
                  const updatedHallucination = {
                    ...existingHallucination,
                    final_answer: finalText || null,
                    reason:
                      typeof anyEvt?.reason === "string" && anyEvt.reason.length
                        ? anyEvt.reason
                        : (m as MessageType).hallucination?.reason ??
                          (hallucinationRaw || null),
                    rewritten_question: rewritten || null,
                    label:
                      typeof anyEvt?.label === "number"
                        ? anyEvt.label
                        : typeof hallucinationLabel === "number"
                        ? hallucinationLabel
                        : existingHallucination?.label ?? null,
                    top_k_retrieved_docs:
                      docs.length > 0
                        ? docs
                        : existingHallucination?.top_k_retrieved_docs ?? null,
                  } as any;
                  return {
                    ...(m as MessageType),
                    hallucination: updatedHallucination,
                  } as MessageType;
                });
                return { ...old, messages: newMessages };
              }
            );
          }
        },
      });
    } catch (e) {
      console.error("hallucination stream error", e);
    } finally {
      setIsHallucinationStreaming(false);
    }
  };

  const hasSources = message?.documents?.length;

  return (
    <div>
      <div
        className={`flex ${
          !hasSources && "flex-col"
        } md:flex-row md:items-center justify-between gap-2 mb-4`}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {hasSources ? (
              <Button
                variant="primary"
                onClick={() => {
                  const isSourcesOpen =
                    isOpenDynamicSidebar && content?.type === "sources";
                  const currentMessageId = content?.props?.messageId;

                  if (isSourcesOpen && currentMessageId === message?.id) {
                    closeDynamicSidebar();
                  } else {
                    openDynamicSidebar({
                      type: "sources",
                      props: {
                        sources: message?.documents || [],
                        messageId: message?.id,
                      },
                    });
                  }
                }}
              >
                <FontAwesomeIcon icon={faBullseye} className="size-4" />
                <span className="font-['NotesESA']">Sources</span>
                <span className="font-['NotesESA']">
                  ({message?.documents?.length})
                </span>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faBullseye} className="size-3" />
                <span className="font-['NotesESA'] text-sm">
                  The message was generated without using sources
                </span>
              </div>
            )}
            {IS_STAGING && (
              <Button
                variant="outline"
                onClick={handleHallucinationDetect}
                disabled={isHallucinationStreaming}
              >
                <span className="font-['NotesESA']">
                  Hallucination Detector
                </span>
              </Button>
            )}
          </div>
        </div>
        <div className="self-end cursor-pointer flex items-center">
          <Button variant="icon" onClick={handleLike}>
            <FontAwesomeIcon
              icon={isThumbsUp ? faThumbsUpSolid : faThumbsUp}
              className="size-4 hover:text-natural-200 transition-colors duration-200 cursor-pointer"
            />
          </Button>

          <Button variant="icon" onClick={handleDislike}>
            <FontAwesomeIcon
              onClick={handleDislike}
              icon={isThumbsDown ? faThumbsDownSolid : faThumbsDown}
              className="size-4 hover:text-natural-200 transition-colors duration-200 cursor-pointer"
            />
          </Button>

          <Button variant="icon" onClick={handleCopy}>
            {isCopied ? (
              <FontAwesomeIcon
                icon={faCheck}
                className="size-4 text-natural-50"
              />
            ) : (
              <FontAwesomeIcon
                onClick={handleCopy}
                icon={faCopy}
                className="size-4 hover:text-natural-200 transition-colors duration-200 cursor-pointer"
              />
            )}
          </Button>
        </div>
        <SendFeedbackDialog
          isOpen={isSendFeedbackDialogOpen}
          onOpenChange={setIsSendFeedbackDialogOpen}
          onSendFeedback={(feedbackText) => {
            setIsThumbsDown(true);
            setIsThumbsUp(false);
            sendFeedback({
              messageId: message?.id,
              conversationId,
              feedback: FeedbackEnum.BAD,
              feedback_reason: feedbackText,
            });
            if (conversationId && message?.id) {
              queryClient.setQueryData<ChaMessageType>(
                [QUERY_KEYS.conversation, conversationId],
                (old) => {
                  if (!old || !old.messages?.length) return old;
                  const newMessages = old.messages.map((m) => {
                    if (m.id !== message.id) return m as MessageType;
                    return {
                      ...(m as MessageType),
                      feedback: FeedbackEnum.BAD,
                      feedback_reason: feedbackText,
                    } as MessageType;
                  });
                  return { ...old, messages: newMessages };
                }
              );
            }
          }}
        />
      </div>
      {(isHallucinationStreaming || hallucinationRaw || alternativeRaw) && (
        <div className="pl-0">
          {hallucinationStatus && (
            <div className="mb-2 text-sm font-bold text-natural-50 animate-pulse">
              {hallucinationStatus}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <h3 className="font-['NotesESA'] mb-1 font-bold">
                Possible hallucination detected:
              </h3>
              <div className="text-sm md:text-base">
                <span className="font-bold">
                  {hallucinationLabel === 1
                    ? "Yes"
                    : hallucinationLabel === 0
                    ? "No"
                    : ""}
                </span>
                {Boolean(hallucinationDisplay) && (
                  <>
                    <span>
                      {hallucinationLabel === 1 || hallucinationLabel === 0
                        ? " — "
                        : ""}
                    </span>
                    <SmartText text={hallucinationDisplay} />
                  </>
                )}
              </div>
            </div>
            {Boolean(rewrittenQuery) && (
              <div>
                <span className="font-['NotesESA'] font-bold">
                  Searched for:{" "}
                </span>
                <span className="whitespace-pre-wrap break-words">
                  {rewrittenQuery}
                </span>
              </div>
            )}
            {Number(hallucinationLabel) === 1 && Boolean(alternativeRaw) && (
              <div>
                <h3 className="font-['NotesESA'] mb-2 font-bold">
                  Alternative answer:
                </h3>
                <SmartText text={alternativeDisplay} />
              </div>
            )}
          </div>
          {!isHallucinationStreaming && (
            <div className="mt-3 flex items-center justify-between">
              {hallucinationSources?.length > 0 ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    const isSourcesOpen =
                      isOpenDynamicSidebar && content?.type === "sources";
                    const currentMessageId = content?.props?.messageId;
                    if (isSourcesOpen && currentMessageId === message?.id) {
                      closeDynamicSidebar();
                    } else {
                      openDynamicSidebar({
                        type: "sources",
                        props: {
                          sources: hallucinationSources,
                          messageId: message?.id,
                        },
                      });
                    }
                  }}
                >
                  <FontAwesomeIcon icon={faBullseye} className="size-4" />
                  <span className="font-['NotesESA']">Sources</span>
                  <span className="font-['NotesESA']">
                    ({hallucinationSources.length})
                  </span>
                </Button>
              ) : (
                <div />
              )}
              <div className="self-end cursor-pointer flex items-center">
                <Button
                  variant="icon"
                  onClick={() => {
                    if (!hallucIsThumbsUp) {
                      setHallucIsThumbsUp(true);
                      setHallucIsThumbsDown(false);
                      sendFeedback({
                        messageId: message?.id,
                        conversationId,
                        hallucination_feedback: FeedbackEnum.GOOD,
                      });
                      if (conversationId && message?.id) {
                        queryClient.setQueryData<ChaMessageType>(
                          [QUERY_KEYS.conversation, conversationId],
                          (old) => {
                            if (!old || !old.messages?.length) return old;
                            const newMessages = old.messages.map((m) => {
                              if (m.id !== message.id) return m as MessageType;
                              const existingHalluc =
                                (m as MessageType).hallucination || ({} as any);
                              return {
                                ...(m as MessageType),
                                hallucination: {
                                  ...(existingHalluc as any),
                                  feedback: FeedbackEnum.GOOD,
                                  feedback_reason: null,
                                } as any,
                              } as MessageType;
                            });
                            return { ...old, messages: newMessages };
                          }
                        );
                      }
                    }
                  }}
                >
                  <FontAwesomeIcon
                    icon={hallucIsThumbsUp ? faThumbsUpSolid : faThumbsUp}
                    className="size-4 hover:text-natural-200 transition-colors duration-200 cursor-pointer"
                  />
                </Button>

                <Button
                  variant="icon"
                  onClick={() => {
                    if (!hallucIsThumbsDown) {
                      setIsHallucSendFeedbackDialogOpen(true);
                    }
                  }}
                >
                  <FontAwesomeIcon
                    icon={hallucIsThumbsDown ? faThumbsDownSolid : faThumbsDown}
                    className="size-4 hover:text-natural-200 transition-colors duration-200 cursor-pointer"
                  />
                </Button>

                <Button
                  variant="icon"
                  onClick={() => {
                    const textToCopy = alternativeRaw || "";
                    copyToClipboardHallucination(textToCopy);
                    if (!hallucWasCopied) {
                      sendFeedback({
                        messageId: message?.id,
                        conversationId,
                        hallucination_was_copied: true,
                      });
                      setHallucWasCopied(true);
                      if (conversationId && message?.id) {
                        queryClient.setQueryData<ChaMessageType>(
                          [QUERY_KEYS.conversation, conversationId],
                          (old) => {
                            if (!old || !old.messages?.length) return old;
                            const newMessages = old.messages.map((m) => {
                              if (m.id !== message.id) return m as MessageType;
                              const existingHalluc =
                                (m as MessageType).hallucination || ({} as any);
                              return {
                                ...(m as MessageType),
                                hallucination: {
                                  ...(existingHalluc as any),
                                  was_copied: true,
                                } as any,
                              } as MessageType;
                            });
                            return { ...old, messages: newMessages };
                          }
                        );
                      }
                    }
                  }}
                >
                  {isHallucCopied ? (
                    <FontAwesomeIcon
                      icon={faCheck}
                      className="size-4 text-natural-50"
                    />
                  ) : (
                    <FontAwesomeIcon
                      icon={faCopy}
                      className="size-4 hover:text-natural-200 transition-colors duration-200 cursor-pointer"
                    />
                  )}
                </Button>
              </div>
            </div>
          )}
          <SendFeedbackDialog
            isOpen={isHallucSendFeedbackDialogOpen}
            onOpenChange={setIsHallucSendFeedbackDialogOpen}
            onSendFeedback={(feedbackText) => {
              setHallucIsThumbsDown(true);
              setHallucIsThumbsUp(false);
              sendFeedback({
                messageId: message?.id,
                conversationId,
                hallucination_feedback: FeedbackEnum.BAD,
                hallucination_feedback_reason: feedbackText,
              });
              if (conversationId && message?.id) {
                queryClient.setQueryData<ChaMessageType>(
                  [QUERY_KEYS.conversation, conversationId],
                  (old) => {
                    if (!old || !old.messages?.length) return old;
                    const newMessages = old.messages.map((m) => {
                      if (m.id !== message.id) return m as MessageType;
                      const existingHalluc =
                        (m as MessageType).hallucination || ({} as any);
                      return {
                        ...(m as MessageType),
                        hallucination: {
                          ...(existingHalluc as any),
                          feedback: FeedbackEnum.BAD,
                          feedback_reason: feedbackText,
                        } as any,
                      } as MessageType;
                    });
                    return { ...old, messages: newMessages };
                  }
                );
              }
            }}
          />
        </div>
      )}
    </div>
  );
};
