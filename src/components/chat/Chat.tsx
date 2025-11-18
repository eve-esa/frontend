import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ChatHeader } from "./ChatHeader";
import { useEffect, useRef, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { useGetConversation } from "@/services/useGetConversation";
import { useSendRequest } from "@/services/useSendRequest";
import { useNavigate, useParams } from "react-router-dom";
import {
  LOCAL_STORAGE_SETTINGS,
  LOCAL_STORAGE_DRAFT_NEW_CONVERSATION,
} from "@/utilities/localStorage";
import { useScrollToBottom } from "@/hooks/useScrollToBottom";
import { useNavigationBlocker } from "@/hooks/useNavigationBlocker";
import { MessageSkeleton } from "./MessageSkeleton";
import { routes } from "@/utilities/routes";
import { adaptSettingsForRequest } from "@/utilities/helpers";
import { LOCAL_STORAGE_LLM_TYPE } from "@/utilities/localStorage";
import { LLMType } from "@/types";
import { StopRequestWarningDialog } from "./StopRequestWarningDialog";
import { useSidebar } from "./DynamicSidebarProvider";
import { useIsMutating } from "@tanstack/react-query";
import { MUTATION_KEYS } from "@/services/keys";
import { useRetry } from "@/services/useRetry";

export const Chat = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const firstMessageSent = useRef(false);
  const { setPendingConversation, removePendingConversation } = useSidebar();
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  const isMutating = Boolean(
    useIsMutating({
      mutationKey: [MUTATION_KEYS.sendRequest, conversationId],
    })
  );

  const { mutate: sendRequest } = useSendRequest(conversationId);

  const { isModalOpen, handleConfirm, handleCancel } =
    useNavigationBlocker(isMutating);

  const {
    data,
    isLoading: isLoadingMessages,
    isFetching: isFetchingMessages,
    error,
    isError,
  } = useGetConversation({
    conversationId,
    enabled: !draftMessage || firstMessageSent.current,
  });

  const messages = data?.messages || [];

  useEffect(() => {
    if (isError) {
      navigate(routes.EMPTY_CHAT.path);
    }
  }, [isError, error]);

  const {
    scrollContainerRef,
    scrollButtonRef,
    messagesEndRef,
    scrollToBottom,
  } = useScrollToBottom(!!messages.length || isMutating, !isMutating);

  useEffect(() => {
    if (!isMutating && conversationId) {
      removePendingConversation(conversationId);
    }

    return () => {
      if (conversationId && isMutating) {
        setPendingConversation(conversationId);
      }
    };
  }, [
    isMutating,
    conversationId,
    removePendingConversation,
    setPendingConversation,
  ]);

  useEffect(() => {
    firstMessageSent.current = false;

    // Scroll to bottom instantly when switching conversations
    scrollToBottom("auto");
    const draft = localStorage.getItem(LOCAL_STORAGE_DRAFT_NEW_CONVERSATION);
    if (draft) {
      setDraftMessage(draft);
    }
  }, [conversationId, messages.length]);

  const handleSendRequest = useCallback(
    (input: string) => {
      if (!conversationId) return;

      const settings = JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_SETTINGS) ?? "{}"
      );
      const llm_type =
        (localStorage.getItem(LOCAL_STORAGE_LLM_TYPE) as LLMType) ||
        LLMType.Mistral;

      sendRequest({
        query: input,
        conversationId,
        settings: { ...adaptSettingsForRequest(settings) },
        llm_type,
      });
    },
    [sendRequest, conversationId]
  );

  useEffect(() => {
    if (draftMessage && !firstMessageSent.current && !isMutating) {
      firstMessageSent.current = true;
      localStorage.removeItem(LOCAL_STORAGE_DRAFT_NEW_CONVERSATION);
      setDraftMessage(null);
      handleSendRequest(draftMessage);
    }
  }, [draftMessage, isMutating, handleSendRequest]);

  const { mutate: retryRequest } = useRetry({
    message_id: messages?.[messages.length - 1]?.id,
    conversationId,
  });

  const lastMessage = messages?.[messages.length - 1];
  const isStopped = Boolean(data?.stopped || lastMessage?.stopped);
  const isRetry = !lastMessage?.output && !isStopped;
  const isLoading = isMutating || isLoadingMessages || isFetchingMessages;

  return (
    <div className="flex h-full w-full flex-col bg-natural-900 relative">
      <div className="flex-none">
        <ChatHeader />
      </div>

      {/* Scroll container - always present */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-[2cqw] @sm:px-[3cqw] @md:px-[10cqw] @lg:px-[10cqw] @xl:px-[15cqw] @5xl:px-[14cqw] @7xl:px-[12cqw] @8xl:px-[15cqw] @9xl:px-[18cqw] @10xl:px-[20cqw] pt-4 @md:pt-8 pb-4 @md:pb-8"
      >
        {isLoadingMessages && !firstMessageSent.current ? (
          <MessageSkeleton />
        ) : (
          <div>
            <MessageList
              messages={messages || []}
              isSending={isMutating}
              isError={isRetry && !isMutating && !isLoading}
              scrollContainerRef={scrollContainerRef}
              onRetry={() => {
                if (isRetry) {
                  retryRequest({
                    message_id: messages?.[messages.length - 1]?.id,
                    conversationId,
                  });
                }
              }}
            />
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="flex-none p-4 @md:p-8 px-[2cqw] @sm:px-[3cqw] @md:px-[10cqw] @lg:px-[10cqw] @xl:px-[15cqw] @5xl:px-[14cqw] @7xl:px-[12cqw] @8xl:px-[15cqw] @9xl:px-[18cqw] @10xl:px-[20cqw] relative w-full">
        <div
          ref={scrollButtonRef}
          onClick={() => scrollToBottom()}
          className="absolute top-[-50px] left-1/2 transform -translate-x-1/2 cursor-pointer w-10 h-10 bg-primary-500 hover:bg-primary-900 text-natural-200 hover:text-natural-50 rounded-full shadow-lg border-[1px] border-primary-400 transition-all duration-200 ease-in-out z-10 flex items-center justify-center opacity-0 pointer-events-none data-[show-scroll-button=true]:opacity-100 data-[show-scroll-button=true]:pointer-events-auto"
          data-show-scroll-button="false"
        >
          <FontAwesomeIcon icon={faChevronDown} className="size-4" />
        </div>
        <MessageInput
          sendRequest={handleSendRequest}
          isLoading={isLoading}
          disabled={isLoading || isRetry}
        />
      </div>

      <StopRequestWarningDialog
        isModalOpen={isModalOpen}
        onOpenChange={handleCancel}
        handleConfirm={handleConfirm}
      />
    </div>
  );
};
