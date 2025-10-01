import { useDeleteConversation } from "@/services/useDeleteConversation";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { useNavigate, useParams } from "react-router-dom";
import { routes } from "@/utilities/routes";

type DeleteConversationDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
};

export const DeleteConversationDialog = ({
  isOpen,
  onOpenChange,
  conversationId,
}: DeleteConversationDialogProps) => {
  const { conversationId: currentConversationId } = useParams();
  const navigate = useNavigate();

  const onSuccess = () => {
    onOpenChange(false);
    if (currentConversationId === conversationId) {
      void navigate(routes.EMPTY_CHAT.path);
    }
  };

  const { mutate: deleteConversation, isPending } =
    useDeleteConversation(onSuccess);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Are you sure you want to delete this conversation?
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>This action cannot be undone.</DialogDescription>
        <div className="flex gap-2 justify-end">
          <Button
            tabIndex={-1}
            variant="ghost"
            size="md"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={isPending}
            tabIndex={-1}
            variant="destructive"
            size="md"
            onClick={() => deleteConversation(conversationId)}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
