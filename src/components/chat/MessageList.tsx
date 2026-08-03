import type { MessageType } from "@/types";
import { ErrorMessage } from "./ErrorMessage";
import { Message } from "./Message";

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
          />
        );
      })}
      {isError && (
        <div className="mt-4 md:mt-8">
          <ErrorMessage onRetry={onRetry} />
        </div>
      )}
    </div>
  );
};
