import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useRef, useState } from "react";
import { useListModels } from "@/services/useListModels";
import { CustomModelFields } from "./CustomModelFields";
import { DeleteCustomModelDialog } from "./DeleteCustomModelDialog";
import { useCustomModelForm } from "./useCustomModelForm";
import type { CustomModel } from "@/types";

type CustomModelsDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export const CustomModelsDialog = ({
  isOpen,
  onOpenChange,
}: CustomModelsDialogProps) => {
  const { data: models } = useListModels();
  const [pendingDelete, setPendingDelete] = useState<CustomModel | null>(null);
  // After a delete the row and its trigger are gone: focus goes to the name
  // field instead of falling back to the dialog container.
  const nameInputRef = useRef<HTMLInputElement>(null);

  const modelForm = useCustomModelForm({ providers: models?.providers ?? [] });
  const { editing, isPending, isSelectOpen, reset: resetForm } = modelForm;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) resetForm();
        onOpenChange(open);
      }}
    >
      <DialogContent
        className="max-w-2xl"
        onPointerDownOutside={(event) => {
          if (isSelectOpen) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (isSelectOpen) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Custom models</DialogTitle>
          <DialogDescription>
            Connect a supported provider with your API key. Keys are stored
            securely and cannot be viewed again after saving.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          {(models?.custom ?? []).length > 0 ? (
            <div className="flex flex-col gap-2">
              {models?.custom.map((model) => (
                <div
                  key={model.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-primary-400/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{model.display_name}</p>
                    <p className="text-sm text-natural-400 truncate">
                      {model.provider_display_name}: {model.model_display_name}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Edit ${model.display_name}`}
                      onClick={() => modelForm.startEdit(model)}
                      disabled={isPending}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="custom-model-delete"
                      aria-label={`Delete ${model.display_name}`}
                      onClick={() => setPendingDelete(model)}
                      disabled={isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-natural-400">No custom models yet.</p>
          )}

          <form onSubmit={modelForm.submit} className="flex flex-col gap-3">
            <p className="text-sm font-medium">
              {editing ? "Edit model" : "Add model"}
            </p>
            <CustomModelFields model={modelForm} nameRef={nameInputRef} />
            <div className="flex gap-2 justify-end">
              {editing ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel edit
                </Button>
              ) : null}
              <Button type="submit" disabled={isPending}>
                {editing ? "Save changes" : "Add model"}
              </Button>
            </div>
          </form>
        </div>

        <DeleteCustomModelDialog
          model={pendingDelete}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          onDeletedFocus={() => nameInputRef.current?.focus()}
        />
      </DialogContent>
    </Dialog>
  );
};
