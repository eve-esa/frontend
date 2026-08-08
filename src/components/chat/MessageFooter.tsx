import {
  faBullseye,
  faCheck,
  faListUl,
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
import {
  LLMType,
  LLMTypeLabel,
  type ApiError,
  type ChaMessageType,
  type Document,
  type MessageType,
  type ModelListResponse,
} from "@/types";
import { useSidebar, type SidebarContent } from "./DynamicSidebarProvider";
import { useClipboard } from "@/hooks/useClipboard";
import { useState } from "react";
import { FeedbackEnum, useSendFeedback } from "@/services/useSendFeedback";
import { postStream, type StreamEvent } from "@/services/streaming";
import { useSmoothStream } from "@/hooks/useSmoothStream";
import { useParams } from "react-router-dom";
import { SendFeedbackDialog } from "./SendFeedbackDialog";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/services/keys";
import { toast } from "sonner";
import { handleApiError } from "@/utilities/helpers";
import { useListModels } from "@/services/useListModels";
import { resolveCustomModelDisplayName } from "@/utilities/modelSelection";

type Hallucination = NonNullable<MessageType["hallucination"]>;

const LLM_TYPE_TO_LABEL: Record<string, string> = {
  [LLMType.Main]: LLMTypeLabel.Main,
  [LLMType.Mistral]: LLMTypeLabel.Mistral,
  [LLMType.Satcom_Small]: LLMTypeLabel.Satcom_Small,
  [LLMType.Satcom_Large]: LLMTypeLabel.Satcom_Large,
  [LLMType.EVE_JSC]: LLMTypeLabel.EVE_JSC,
  fallback: "Fallback",
};

function resolveLlmTypeLabel(
  llmType: string,
  models?: ModelListResponse,
): string {
  const platformModel = models?.platform.find((model) => model.llm_type === llmType);
  return platformModel?.display_name || LLM_TYPE_TO_LABEL[llmType] || llmType;
}

function getSelectedModelLabel(
  message: MessageType,
  models?: ModelListResponse,
): string | null {
  if (message.request_input?.custom_model_id) {
    return (
      message.metadata?.prompts?.custom_model_display_name ||
      resolveCustomModelDisplayName(
        message.request_input.custom_model_id,
        models,
      )
    );
  }
  if (message.request_input?.llm_type) {
    return resolveLlmTypeLabel(message.request_input.llm_type, models);
  }
  return null;
}

function getFallbackModelLabel(
  message: MessageType,
  models?: ModelListResponse,
): string {
  const resolved = message.metadata?.prompts?.agentic_llm_resolved;
  if (resolved) {
    return resolveLlmTypeLabel(resolved, models);
  }
  return (
    models?.platform.find((model) => model.llm_type === "fallback")
      ?.display_name ||
    message.metadata?.generated_model_name ||
    "Fallback"
  );
}

function getAnsweredByLabel(
  message: MessageType,
  models?: ModelListResponse,
): string | null {
  const usedFallback = message.metadata?.prompts?.used_fallback_llm;

  if (usedFallback === true) {
    return getFallbackModelLabel(message, models);
  }

  const selected = getSelectedModelLabel(message, models);
  if (usedFallback === false) {
    return selected;
  }

  if (
    message.metadata?.latencies?.fallback_latency &&
    !message.metadata?.latencies?.base_generation_latency
  ) {
    return getFallbackModelLabel(message, models);
  }

  return selected;
}

type MessageFooterProps = {
  message: MessageType;
};

export const MessageFooter = ({ message }: MessageFooterProps) => {
  const { conversationId } = useParams();
  const queryClient = useQueryClient();
  const { data: models } = useListModels();
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
    message?.feedback === FeedbackEnum.GOOD,
  );
  const [isThumbsDown, setIsThumbsDown] = useState(
    message?.feedback === FeedbackEnum.BAD,
  );

  const [isSendFeedbackDialogOpen, setIsSendFeedbackDialogOpen] =
    useState(false);

  const { mutate: sendFeedback } = useSendFeedback();

  // Hallucination feedback local state
  const [hallucWasCopied, setHallucWasCopied] = useState(
    message?.hallucination?.was_copied,
  );
  const [hallucIsThumbsUp, setHallucIsThumbsUp] = useState(
    message?.hallucination?.feedback === FeedbackEnum.GOOD,
  );
  const [hallucIsThumbsDown, setHallucIsThumbsDown] = useState(
    message?.hallucination?.feedback === FeedbackEnum.BAD,
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
          },
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
          },
        );
      }
    }
  };

  const [hallucinationRaw, setHallucinationRaw] = useState<string>(
    message?.hallucination?.reason ?? "",
  );
  const [isHallucinationStreaming, setIsHallucinationStreaming] =
    useState(false);
  const [hallucinationStatus, setHallucinationStatus] = useState<string>("");
  const [hallucinationSources, setHallucinationSources] = useState<Document[]>(
    message?.hallucination?.top_k_retrieved_docs ?? [],
  );
  const [hallucinationLabel, setHallucinationLabel] = useState<number | null>(
    typeof message?.hallucination?.label === "number"
      ? message?.hallucination?.label
      : null,
  );
  const [rewrittenQuery, setRewrittenQuery] = useState<string>(
    message?.hallucination?.rewritten_question ?? "",
  );
  const [alternativeRaw, setAlternativeRaw] = useState<string>(
    message?.hallucination?.final_answer ?? "",
  );

  const hallucinationDisplay = useSmoothStream(
    hallucinationRaw,
    isHallucinationStreaming,
    { ratePerSecond: 100, chunkSize: 1 },
    `${conversationId ?? ""}:${message?.id ?? ""}:hallucination`,
  );
  const alternativeDisplay = useSmoothStream(
    alternativeRaw,
    isHallucinationStreaming,
    { ratePerSecond: 100, chunkSize: 1 },
    `${conversationId ?? ""}:${message?.id ?? ""}:hallucination:alt`,
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
          const streamEvt = evt as {
            type?: string;
            content?: unknown;
            answer?: unknown;
            documents?: unknown;
            label?: unknown;
            reason?: unknown;
            rewritten_query?: unknown;
            rewritten_question?: unknown;
            top_k_retrieved_docs?: unknown;
          };
          // Stream tokens
          if (streamEvt?.type === "token" && typeof streamEvt.content === "string") {
            // Alternative answer streams as tokens
            setAlternativeRaw((prev) => prev + streamEvt.content);
            return;
          }

          if (streamEvt?.type === "status" && typeof streamEvt.content === "string") {
            // Replace current status with the latest one
            setHallucinationStatus(streamEvt.content);
            return;
          }

          if (streamEvt?.type === "label" && streamEvt?.content !== undefined) {
            const parsed =
              typeof streamEvt.content === "number"
                ? streamEvt.content
                : Number(streamEvt.content);
            if (!Number.isNaN(parsed)) {
              setHallucinationLabel(parsed);
            }
            return;
          }

          if (streamEvt?.type === "reason" && typeof streamEvt.content === "string") {
            setHallucinationRaw(streamEvt.content);
            return;
          }

          if (
            streamEvt?.type === "rewritten_question" &&
            typeof streamEvt.content === "string"
          ) {
            setRewrittenQuery(streamEvt.content);
            return;
          }

          if (streamEvt?.type === "final") {
            const finalText =
              typeof streamEvt?.answer === "string" ? streamEvt.answer : "";
            setHallucinationStatus("");
            const docs: Document[] = Array.isArray(streamEvt?.top_k_retrieved_docs)
              ? (streamEvt.top_k_retrieved_docs as Document[])
              : Array.isArray(streamEvt?.documents)
                ? (streamEvt.documents as Document[])
                : [];
            if (docs.length > 0) {
              setHallucinationSources(docs);
            }
            const rewritten =
              (streamEvt?.rewritten_question as string) ||
              (streamEvt?.rewritten_query as string) ||
              "";
            if (rewritten) {
              setRewrittenQuery(rewritten);
            }
            if (typeof streamEvt?.reason === "string" && streamEvt.reason.length) {
              setHallucinationRaw(streamEvt.reason);
            }
            if (typeof streamEvt?.label === "number") {
              setHallucinationLabel(streamEvt.label);
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
                    (m as MessageType).hallucination || ({} as Hallucination);
                  const updatedHallucination = {
                    ...existingHallucination,
                    final_answer: finalText || null,
                    reason:
                      typeof streamEvt?.reason === "string" && streamEvt.reason.length
                        ? streamEvt.reason
                        : ((m as MessageType).hallucination?.reason ??
                          (hallucinationRaw || null)),
                    rewritten_question: rewritten || null,
                    label:
                      typeof streamEvt?.label === "number"
                        ? streamEvt.label
                        : typeof hallucinationLabel === "number"
                          ? hallucinationLabel
                          : (existingHallucination?.label ?? null),
                    top_k_retrieved_docs:
                      docs.length > 0
                        ? docs
                        : (existingHallucination?.top_k_retrieved_docs ?? null),
                  } as Hallucination;
                  return {
                    ...(m as MessageType),
                    hallucination: updatedHallucination,
                  } as MessageType;
                });
                return { ...old, messages: newMessages };
              },
            );
          }
        },
      });
    } catch (e) {
      console.error("hallucination stream error", e);
      const errorMessage = handleApiError(e as ApiError);
      toast.error(errorMessage);
    } finally {
      setIsHallucinationStreaming(false);
    }
  };

  const hasSources = message?.documents?.length;
  const hasTrace = message?.trace?.length;

  const toggleMessageSidebar = (
    panelType: Extract<SidebarContent["type"], "sources" | "trace">,
    props: SidebarContent["props"],
  ) => {
    const isOpen =
      isOpenDynamicSidebar &&
      content?.type === panelType &&
      content?.props?.messageId === message?.id;

    if (isOpen) {
      closeDynamicSidebar();
      return;
    }

    openDynamicSidebar({ type: panelType, props });
  };

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
                onClick={() =>
                  toggleMessageSidebar("sources", {
                    sources: message?.documents || [],
                    messageId: message?.id,
                  })
                }
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
            {hasTrace ? (
              <Button
                variant="primary"
                onClick={() =>
                  toggleMessageSidebar("trace", {
                    trace: message?.trace || [],
                    messageId: message?.id,
                  })
                }
              >
                <FontAwesomeIcon icon={faListUl} className="size-4" />
                <span className="font-['NotesESA']">Trace</span>
                <span className="font-['NotesESA']">
                  ({message?.trace?.length})
                </span>
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={handleHallucinationDetect}
              disabled={isHallucinationStreaming}
            >
              <span className="font-['NotesESA']">Hallucination Detector</span>
            </Button>
            <div className="text-sm text-natural-500">
              Answered by:{" "}
              {getAnsweredByLabel(message, models) || "EVE-Instruct"}
              {message?.metadata?.generated_model_name &&
                ` (${message.metadata.generated_model_name})`}
              {message?.metadata?.prompts?.custom_model_name &&
                !message?.metadata?.generated_model_name &&
                ` (${message.metadata.prompts.custom_model_name})`}
            </div>
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
                },
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
                                (m as MessageType).hallucination || ({} as Hallucination);
                              return {
                                ...(m as MessageType),
                                hallucination: {
                                  ...existingHalluc,
                                  feedback: FeedbackEnum.GOOD,
                                  feedback_reason: null,
                                } as Hallucination,
                              } as MessageType;
                            });
                            return { ...old, messages: newMessages };
                          },
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
                                (m as MessageType).hallucination || ({} as Hallucination);
                              return {
                                ...(m as MessageType),
                                hallucination: {
                                  ...existingHalluc,
                                  was_copied: true,
                                } as Hallucination,
                              } as MessageType;
                            });
                            return { ...old, messages: newMessages };
                          },
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
                        (m as MessageType).hallucination || ({} as Hallucination);
                      return {
                        ...(m as MessageType),
                        hallucination: {
                          ...existingHalluc,
                          feedback: FeedbackEnum.BAD,
                          feedback_reason: feedbackText,
                        } as Hallucination,
                      } as MessageType;
                    });
                    return { ...old, messages: newMessages };
                  },
                );
              }
            }}
          />
        </div>
      )}
    </div>
  );
};
