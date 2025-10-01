import { useState, useEffect } from "react";
import { DeleteConversationDialog } from "./DeleteConversationDialog";
import { ConversationItem } from "./ConversationItem";
import { cn } from "@/lib/utils";
import { generatePath, useNavigate, useParams } from "react-router-dom";
import { routes } from "@/utilities/routes";
import useInfinityLoading from "@/hooks/useInfinityLoading";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSidebar } from "./DynamicSidebarProvider";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRenameConversation } from "@/services/useRenameConversation";
import type { SingleConversation } from "@/services/useGetConversationsList";
import { useTour } from "@/components/onboarding/TourContext";

type ConversationsProps = {
  isOpen: boolean;
  conversations: SingleConversation[];
  fetchNextPage: () => void;
  hasNextPage: boolean;
};

export const Conversations = ({
  isOpen,
  conversations,
  fetchNextPage,
  hasNextPage,
}: ConversationsProps) => {
  const { isRunning } = useTour();
  const [conversationsEndRef] = useInfinityLoading({
    fetchFunction: fetchNextPage,
    dependencies: [hasNextPage],
  });

  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { conversationId: activeConversationId } = useParams();
  const {
    toggleConversationsSidebar,
    closeDynamicSidebar,
    content,
    isOpenDynamicSidebar,
    isConversationPending,
  } = useSidebar();

  const [isDeleteConversationDialogOpen, setIsDeleteConversationDialogOpen] =
    useState(false);
  const [editingConversationId, setEditingConversationId] = useState<
    string | null
  >(null);

  const [localConversationNames, setLocalConversationNames] = useState<
    Record<string, string>
  >({});

  const { mutate: renameConversation } = useRenameConversation(() => {
    setEditingConversationId(null);
  });

  useEffect(() => {
    const newNames: Record<string, string> = {};
    conversations?.forEach((conversation) => {
      newNames[conversation.id] = conversation.name;
    });
    setLocalConversationNames((prev) => ({ ...prev, ...newNames }));
  }, [conversations]);

  const handleConversationSelect = (conversationId: string) => {
    if (editingConversationId !== conversationId) {
      if (isOpenDynamicSidebar && content?.type === "sources") {
        closeDynamicSidebar();
      }

      navigate(generatePath(routes.CHAT.path, { conversationId }));

      if (isMobile) {
        toggleConversationsSidebar();
      }
    }
  };

  const handleRename = (conversation: SingleConversation) => {
    setEditingConversationId(conversation.id);
  };

  const handleRenameSave = (conversationId: string, newName: string) => {
    setLocalConversationNames((prev) => ({
      ...prev,
      [conversationId]: newName,
    }));
    renameConversation({ id: conversationId, newName });
  };

  const handleRenameCancel = () => {
    setEditingConversationId(null);
  };

  const handleDelete = (conversation: SingleConversation) => {
    setEditingConversationId(conversation.id);
    setIsDeleteConversationDialogOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteConversationDialogOpen(false);
    setEditingConversationId(null);
  };

  return (
    <>
      <div
        className={cn("flex w-full flex-col gap-2", !isOpen && "items-center")}
      >
        {conversations?.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            isOpen={isOpen}
            isActive={activeConversationId === conversation.id}
            isEditing={
              editingConversationId === conversation.id &&
              !isDeleteConversationDialogOpen
            }
            isPending={isConversationPending(conversation.id)}
            onSelect={handleConversationSelect}
            onRename={handleRename}
            onRenameSave={handleRenameSave}
            onRenameCancel={handleRenameCancel}
            onDelete={handleDelete}
            conversationName={
              localConversationNames[conversation.id] || conversation.name
            }
          />
        ))}

        {hasNextPage && <div ref={conversationsEndRef} />}
        {hasNextPage && !!conversations.length && !isRunning && (
          <div className="flex flex-col gap-1.5">
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} className="h-[22px] my-2" />
            ))}
          </div>
        )}
      </div>

      <DeleteConversationDialog
        isOpen={isDeleteConversationDialogOpen}
        onOpenChange={handleCloseDeleteModal}
        conversationId={editingConversationId ?? null}
      />
    </>
  );
};
