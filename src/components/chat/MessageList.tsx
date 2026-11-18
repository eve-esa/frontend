import { useCallback } from "react";
import type { MessageType } from "@/types";
import { ErrorMessage } from "./ErrorMessage";
import { Message } from "./Message";
import { useSidebar } from "./DynamicSidebarProvider";
import { useCollectionCatalog } from "@/services/useCollectionCatalog";
import { useListModels } from "@/services/useListModels";

type MessageListProps = {
  messages: MessageType[];
  isSending: boolean;
  isError: boolean;
  onRetry: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
};

export const MessageList = ({
  messages,
  isSending,
  isError,
  onRetry,
  scrollContainerRef,
}: MessageListProps) => {
  // One read of the cached collection lists for every message: the agent
  // steps name the collections a search covered.
  const collections = useCollectionCatalog();
  // Model labels for the agent steps Details (cached `/models`).
  const { data: models } = useListModels();
  const { openDynamicSidebar } = useSidebar();
  const openMyCollections = useCallback(
    () => openDynamicSidebar({ type: "my-collections" }),
    [openDynamicSidebar],
  );
  const lastMessage = messages?.length
    ? messages[messages.length - 1]
    : undefined;
  return (
    <div className="flex flex-col gap-4 mx-auto">
      {messages?.map((message, index) => {
        const isLastMessage = index === messages.length - 1;

        return (
          <Message
            // Keyed by position, not message.id: the id itself is unstable
            // for the in-flight turn (useSendRequest swaps a "temp-*" id for
            // the server "srv-*"/real id once streaming completes). Keying
            // on id would remount this whole Message — and every image
            // inside it — right at completion, causing a visible flash.
            // Messages only ever append in this list, never reorder, so a
            // positional key is safe.
            key={`${message.conversation_id ?? ""}-${index}`}
            message={message}
            isSending={isSending}
            isLastMessage={isLastMessage}
            scrollContainerRef={scrollContainerRef}
            messageIndex={index}
            collections={collections}
            models={models}
            onOpenMyCollections={openMyCollections}
          />
        );
      })}
      {isError && (
        <div className="mt-4 md:mt-8">
          <ErrorMessage
            onRetry={onRetry}
            reportBugTarget={
              lastMessage && {
                conversationId: lastMessage.conversation_id,
                messageId: lastMessage.id,
                traceId: lastMessage.trace_id,
              }
            }
          />
        </div>
      )}
    </div>
  );
};
