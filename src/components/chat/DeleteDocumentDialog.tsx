import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { useDeleteDocument } from "@/services/useDeleteDocument";
import { Spinner } from "../ui/Spinner";

type DeleteDocumentDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string | null;
  documentId: string | null;
};

export const DeleteDocumentDialog = ({
  isOpen,
  onOpenChange,
  collectionId,
  documentId,
}: DeleteDocumentDialogProps) => {
  const onSuccess = () => {
    onOpenChange(false);
  };
  const { mutate: deleteDocument, isPending } = useDeleteDocument(onSuccess);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Are you sure you want to delete this document?
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
            className="min-w-[100px]"
            onClick={() => deleteDocument({ collectionId, documentId })}
          >
            {isPending ? <Spinner size="xs" /> : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
