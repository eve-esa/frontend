import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { CustomModelFields } from "@/components/chat/CustomModelFields";
import { DeleteCustomModelDialog } from "@/components/chat/DeleteCustomModelDialog";
import { useCustomModelForm } from "@/components/chat/useCustomModelForm";
import { useListModels } from "@/services/useListModels";
import type { CustomModel, ProviderCatalog } from "@/types";
import { SettingsPanel, SettingsSection } from "./SettingsSection";

type ModelFormProps = {
  /** The model being edited, or null to add one. */
  editing: CustomModel | null;
  providers: ProviderCatalog[];
  onDone: () => void;
  onSelectOpenChange: (open: boolean) => void;
};

/**
 * The form of the add and edit dialog: the same fields, request bodies and provider catalogue as
 * the custom models dialog, through the shared hook. Mounted only while the dialog is open, so
 * every open starts from a clean form.
 */
const ModelForm = ({
  editing,
  providers,
  onDone,
  onSelectOpenChange,
}: ModelFormProps) => {
  const modelForm = useCustomModelForm({
    providers,
    initialEditing: editing,
    onDone,
  });
  const { isSelectOpen, isPending } = modelForm;

  useEffect(() => {
    onSelectOpenChange(isSelectOpen);
  }, [isSelectOpen, onSelectOpenChange]);

  return (
    <form
      onSubmit={modelForm.submit}
      data-testid="settings-models-form"
      className="mt-2 flex flex-col gap-5"
    >
      <CustomModelFields model={modelForm} idPrefix="settings-models" />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="md"
          data-testid="settings-models-cancel"
          onClick={onDone}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="md"
          data-testid="settings-models-save"
          disabled={isPending}
        >
          {editing ? "Save changes" : "Add model"}
        </Button>
      </div>
    </form>
  );
};

/**
 * Bring your own model and key, as a page section: the list of the user's custom models with
 * Add, Edit and Delete. Same hooks and requests as the custom models dialog; the form lives in
 * a dialog with its own Save, and Delete asks first, naming the model.
 */
export const ModelsSection = () => {
  const { data: models, isLoading } = useListModels();
  // The model the dialog is for (null: adding). Kept while the dialog closes, so the title and
  // the form do not change during the exit animation; open says whether it shows.
  const [formTarget, setFormTarget] = useState<CustomModel | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CustomModel | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);
  // After a delete the row and its button are gone: focus goes to Add.
  const addRef = useRef<HTMLButtonElement>(null);

  const custom = models?.custom ?? [];
  const providers = models?.providers ?? [];

  return (
    <SettingsSection
      id="models"
      title="Models"
      lead="Connect a supported provider with your own API key. Keys are stored securely and cannot be viewed again after saving."
    >
      <SettingsPanel>
        {isLoading ? (
          <Skeleton className="h-[120px] w-full" />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p
                data-testid="settings-models-count"
                className="text-sm text-natural-200"
              >
                {custom.length === 0
                  ? "No custom models yet."
                  : custom.length === 1
                    ? "1 custom model"
                    : `${custom.length} custom models`}
              </p>
              <Button
                ref={addRef}
                type="button"
                size="md"
                data-testid="settings-models-add"
                onClick={() => {
                  setFormTarget(null);
                  setFormOpen(true);
                }}
              >
                Add model
              </Button>
            </div>

            {custom.length > 0 && (
              <ul className="flex flex-col gap-2">
                {custom.map((model) => (
                  <li
                    key={model.id}
                    data-testid={`settings-models-row-${model.id}`}
                    className="flex items-start justify-between gap-3 rounded-md border border-primary-400/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{model.display_name}</p>
                      <p className="truncate text-sm text-natural-200">
                        {model.provider_display_name}: {model.model_display_name}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={`settings-models-edit-${model.id}`}
                        aria-label={`Edit ${model.display_name}`}
                        onClick={() => {
                          setFormTarget(model);
                          setFormOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={`settings-models-delete-${model.id}`}
                        aria-label={`Delete ${model.display_name}`}
                        onClick={() => setPendingDelete(model)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-sm text-natural-200">
              The model picker and the temperature stay in the conversation,
              next to the composer.
            </p>
          </div>
        )}
      </SettingsPanel>

      <Dialog
        open={formOpen}
        onOpenChange={setFormOpen}
      >
        <DialogContent
          data-testid="settings-models-dialog"
          className="max-w-lg"
          onPointerDownOutside={(event) => {
            if (selectOpen) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (selectOpen) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{formTarget ? "Edit model" : "Add model"}</DialogTitle>
            <DialogDescription>
              Connect a supported provider with your API key.
            </DialogDescription>
          </DialogHeader>
          <ModelForm
            editing={formTarget}
            providers={providers}
            onDone={() => setFormOpen(false)}
            onSelectOpenChange={setSelectOpen}
          />
        </DialogContent>
      </Dialog>

      <DeleteCustomModelDialog
        model={pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onDeletedFocus={() => addRef.current?.focus()}
      />
    </SettingsSection>
  );
};
