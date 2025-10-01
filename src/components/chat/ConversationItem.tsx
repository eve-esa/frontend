import type { SingleConversation } from "@/services/useGetConversationsList";
import { RenameConversationInput } from "./RenameConversationInput";
import { ConversationMenubar } from "./ConversationMenubar";
import { cn } from "@/lib/utils";
import { useIsMutating } from "@tanstack/react-query";
import { MUTATION_KEYS } from "@/services/keys";
import { Spinner } from "../ui/Spinner";

interface ConversationItemProps {
  conversation: SingleConversation;
  isOpen: boolean;
  isActive: boolean;
  isEditing: boolean;
  isPending?: boolean;
  onSelect: (conversationId: string) => void;
  onRename: (conversation: SingleConversation) => void;
  onRenameSave: (conversationId: string, newName: string) => void;
  onRenameCancel: () => void;
  onDelete: (conversation: SingleConversation) => void;
  conversationName: string;
}

export const ConversationItem = ({
  conversation,
  isOpen,
  isActive,
  isEditing,
  isPending = false,
  onSelect,
  onRename,
  onRenameSave,
  onRenameCancel,
  onDelete,
  conversationName,
}: ConversationItemProps) => {
  const handleClick = () => {
    if (!isEditing) {
      onSelect(conversation.id);
    }
  };

  const handleDoubleClick = () => {
    if (!isEditing) {
      onRename(conversation);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleClick();
    }
  };

  // This needs to be updated when the conversation id changes to show the correct spinner
  const isMutatingForKey = Boolean(
    useIsMutating({
      mutationKey: [MUTATION_KEYS.sendRequest, conversation.id],
    })
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Select conversation: ${conversation.name}`}
      aria-pressed={isActive}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "group grid items-center rounded-lg cursor-pointer relative",
        isActive
          ? "bg-primary-600/60 hover:bg-primary-500"
          : "hover:bg-primary-500",
        isOpen
          ? isEditing
            ? "grid-cols-[1fr]"
            : "grid-cols-[auto_1fr_auto]"
          : "grid-cols-[auto]"
      )}
    >
      {isOpen && (
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isEditing ? (
            <RenameConversationInput
              conversationId={conversation.id}
              initialName={conversationName}
              onSave={onRenameSave}
              onCancel={onRenameCancel}
            />
          ) : (
            <span className="truncate px-2 py-2 font-medium text-natural-100">
              {conversationName}
            </span>
          )}
        </div>
      )}

      {/* Show circle when pending request in another conversation */}
      {!isActive && isPending && (
        <div className="flex items-center justify-end justify-self-end gap-2 flex-1 group-hover:hidden">
          {isMutatingForKey ? (
            <Spinner size="xs" />
          ) : (
            <div className={cn(" h-2 w-2 rounded-full bg-primary-100")} />
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pr-2">
        {isOpen && !isEditing && (
          <ConversationMenubar
            conversation={conversation}
            isRenameActive={isEditing}
            onRename={onRename}
            onDelete={onDelete}
          />
        )}
      </div>
    </div>
  );
};
