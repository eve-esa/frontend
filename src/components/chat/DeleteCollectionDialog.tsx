import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { useDeleteCollection } from "@/services/useDeleteCollection";
import { Spinner } from "../ui/Spinner";

type DeleteCollectionDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string | null;
  onDeleteSuccess: () => void;
};

export const DeleteCollectionDialog = ({
  isOpen,
  onOpenChange,
  collectionId,
  onDeleteSuccess,
}: DeleteCollectionDialogProps) => {
  const { mutate: deleteCollection, isPending } =
    useDeleteCollection(onDeleteSuccess);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Are you sure you want to delete this collection?
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
            onClick={() => deleteCollection(collectionId)}
            className="min-w-[100px]"
          >
            {isPending ? <Spinner size="sm" /> : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
