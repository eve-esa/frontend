import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useDeleteCustomModel } from "@/services/useCustomModels";
import type { CustomModel } from "@/types";

type DeleteCustomModelDialogProps = {
  model: CustomModel | null;
  onOpenChange: (open: boolean) => void;
  /**
   * Called instead of returning focus to the row's Delete button when the
   * dialog closes after a delete: that button is gone with its row.
   */
  onDeletedFocus?: () => void;
};

/**
 * Asks before a custom model and its stored API key are deleted, naming the
 * model. Same shape as DeleteConversationDialog; rendered inside the custom
 * models dialog so Radix stacks it as a nested layer.
 */
export const DeleteCustomModelDialog = ({
  model,
  onOpenChange,
  onDeletedFocus,
}: DeleteCustomModelDialogProps) => {
  const { mutate: deleteModel, isPending } = useDeleteCustomModel();

  // The model on screen. Kept while the dialog closes, so the exit animation
  // does not read "Delete ?" once the parent clears its selection.
  const [shown, setShown] = useState<CustomModel | null>(model);
  if (model !== null && model !== shown) setShown(model);

  // The model the dialog is open for right now. A delete that finishes after
  // the user cancelled and opened another model must not close that one.
  const openIdRef = useRef<string | null>(model?.id ?? null);
  useEffect(() => {
    openIdRef.current = model?.id ?? null;
  }, [model]);

  const deletedRef = useRef(false);

  return (
    <Dialog open={model !== null} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="custom-model-delete-dialog"
        onCloseAutoFocus={(event) => {
          if (deletedRef.current && onDeletedFocus) {
            event.preventDefault();
            onDeletedFocus();
          }
          deletedRef.current = false;
        }}
      >
        <DialogHeader>
          <DialogTitle>Delete {shown?.display_name}?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          The model and its stored API key are removed. This action cannot be
          undone.
        </DialogDescription>
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="md"
            data-testid="custom-model-delete-cancel"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            data-testid="custom-model-delete-confirm"
            disabled={isPending || model === null}
            variant="destructive"
            size="md"
            onClick={() => {
              if (!model) return;
              const id = model.id;
              deleteModel(id, {
                onSuccess: () => {
                  if (openIdRef.current !== id) return;
                  deletedRef.current = true;
                  onOpenChange(false);
                },
              });
            }}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
