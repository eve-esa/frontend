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
import type { MessageType, ChaMessageType } from "@/types";
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

  const handleLike = () => {
    if (!isThumbsUp) {
      setIsThumbsUp(true);
      setIsThumbsDown(false);
      sendFeedback({
        messageId: message?.id,
        conversationId,
        feedback: FeedbackEnum.GOOD,
      });
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
    }
  };

  const [hallucinationRaw, setHallucinationRaw] = useState<string>(
    message?.metadata?.hallucination?.final_answer ??
      message?.metadata?.hallucination?.reason ??
      ""
  );
  const [isHallucinationStreaming, setIsHallucinationStreaming] =
    useState(false);

  const hallucinationDisplay = useSmoothStream(
    hallucinationRaw,
    isHallucinationStreaming,
    { ratePerSecond: 100, chunkSize: 1 },
    `${conversationId ?? ""}:${message?.id ?? ""}:hallucination`
  );

  const hasHallucinationAnswer = (hallucinationRaw ?? "").trim().length > 0;

  const handleHallucinationDetect = async () => {
    if (!conversationId || !message?.id) return;
    setHallucinationRaw("");
    setIsHallucinationStreaming(true);
    try {
      await postStream({
        url: `/conversations/${conversationId}/messages/${message.id}/stream-hallucination`,
        payload: {},
        onEvent: (evt: StreamEvent) => {
          const anyEvt = evt as any;
          // Stream tokens
          if (anyEvt?.type === "token" && typeof anyEvt.content === "string") {
            setHallucinationRaw((prev) => prev + anyEvt.content);
            return;
          }

          if (anyEvt?.type === "final" && anyEvt?.answer) {
            const finalText = String(anyEvt.answer);
            setHallucinationRaw(finalText);

            // Persist final answer into the cache as hallucination result
            queryClient.setQueryData<ChaMessageType>(
              [QUERY_KEYS.conversation, conversationId],
              (old) => {
                if (!old || !old.messages?.length) return old;
                const newMessages = old.messages.map((m) => {
                  if (m.id !== message?.id) return m as MessageType;
                  const existingMeta = (m.metadata || ({} as any)) as any;
                  const updatedMeta = {
                    ...existingMeta,
                    hallucination: {
                      ...(existingMeta.hallucination || {}),
                      final_answer: finalText,
                      label: 1,
                    },
                  } as any;
                  return {
                    ...(m as MessageType),
                    metadata: updatedMeta,
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
          }}
        />
      </div>
      {(isHallucinationStreaming || hallucinationRaw) && (
        <div className="pl-0">
          <h3 className="font-['NotesESA'] mb-2 font-bold">
            Hallucination Detection:
          </h3>
          <SmartText text={hallucinationDisplay} />
        </div>
      )}
    </div>
  );
};
