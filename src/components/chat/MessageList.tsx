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
            key={message.id}
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
