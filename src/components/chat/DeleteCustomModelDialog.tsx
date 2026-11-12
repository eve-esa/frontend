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
};

/**
 * Asks before a custom model and its stored API key are deleted, naming the
 * model. Same shape as DeleteConversationDialog; rendered inside the custom
 * models dialog so Radix stacks it as a nested layer.
 */
export const DeleteCustomModelDialog = ({
  model,
  onOpenChange,
}: DeleteCustomModelDialogProps) => {
  const { mutate: deleteModel, isPending } = useDeleteCustomModel(() =>
    onOpenChange(false),
  );

  return (
    <Dialog open={model !== null} onOpenChange={onOpenChange}>
      <DialogContent data-testid="custom-model-delete-dialog">
        <DialogHeader>
          <DialogTitle>Delete {model?.display_name}?</DialogTitle>
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
              if (model) deleteModel(model.id);
            }}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
