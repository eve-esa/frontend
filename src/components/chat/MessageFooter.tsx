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
import type { MessageType } from "@/types";
import { useSidebar } from "./DynamicSidebarProvider";
import { useClipboard } from "@/hooks/useClipboard";
import { useState } from "react";
import { FeedbackEnum, useSendFeedback } from "@/services/useSendFeedback";
import { useParams } from "react-router-dom";
import { SendFeedbackDialog } from "./SendFeedbackDialog";

type MessageFooterProps = {
  message: MessageType;
};

export const MessageFooter = ({ message }: MessageFooterProps) => {
  const { conversationId } = useParams();
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

  const hasSources = message?.documents?.length;

  return (
    <div
      className={`flex ${
        !hasSources && "flex-col"
      } md:flex-row md:items-center justify-between gap-2`}
    >
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
  );
};
