import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { DeleteCustomModelDialog } from "@/components/chat/DeleteCustomModelDialog";
import { useListModels } from "@/services/useListModels";
import {
  useCreateCustomModel,
  useUpdateCustomModel,
} from "@/services/useCustomModels";
import {
  buildUpdatePayload,
  emptyCustomModelForm,
  type CustomModelFormState,
} from "@/utilities/customModelForm";
import type { CustomModel, ProviderCatalog } from "@/types";
import { SettingsPanel, SettingsSection } from "./SettingsSection";

const LABEL_CLASS = "font-['NotesESA'] text-sm";

// Styled like the Input fields beside it, as in the custom models dialog.
const SELECT_TRIGGER_CLASS =
  "h-12 bg-primary-200 border border-control shadow-xs in-data-[theme=light]:shadow-none text-natural-100 data-[placeholder]:text-natural-200 in-data-[theme=light]:bg-primary-200 in-data-[theme=light]:[--color-placeholder:inherit]";

type ModelFormProps = {
  /** The model being edited, or null to add one. */
  editing: CustomModel | null;
  providers: ProviderCatalog[];
  onDone: () => void;
  onSelectOpenChange: (open: boolean) => void;
};

/**
 * The fields of the add and edit dialog: same fields, same request bodies and same provider
 * catalogue as the custom models dialog. Mounted only while the dialog is open, so every open
 * starts from a clean form.
 */
const ModelForm = ({
  editing,
  providers,
  onDone,
  onSelectOpenChange,
}: ModelFormProps) => {
  const [form, setForm] = useState<CustomModelFormState>(() =>
    editing
      ? {
          display_name: editing.display_name,
          provider_id: editing.provider_id,
          catalog_model_id: editing.catalog_model_id,
          api_key: "",
        }
      : emptyCustomModelForm()
  );
  const [providerOpen, setProviderOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === form.provider_id),
    [providers, form.provider_id]
  );

  // Adding: start on the first provider and its first model.
  useEffect(() => {
    if (!form.provider_id && providers.length > 0 && !editing) {
      const first = providers[0];
      setForm((prev) => ({
        ...prev,
        provider_id: first.id,
        catalog_model_id: first.models[0]?.id ?? "",
      }));
    }
  }, [providers, form.provider_id, editing]);

  useEffect(() => {
    onSelectOpenChange(providerOpen || catalogOpen);
  }, [providerOpen, catalogOpen, onSelectOpenChange]);

  const { mutate: createModel, isPending: isCreating } =
    useCreateCustomModel(onDone);
  const { mutate: updateModel, isPending: isUpdating } =
    useUpdateCustomModel(onDone);
  const isPending = isCreating || isUpdating;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (editing) {
      updateModel(buildUpdatePayload(editing.id, form));
      return;
    }
    createModel(form);
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="settings-models-form"
      className="mt-2 flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="settings-models-name" className={LABEL_CLASS}>
          Display name
        </label>
        <Input
          id="settings-models-name"
          data-testid="settings-models-name"
          name="eve-custom-model-name"
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          value={form.display_name}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, display_name: e.target.value }))
          }
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="settings-models-provider" className={LABEL_CLASS}>
          Provider
        </label>
        <Select
          open={providerOpen}
          onOpenChange={setProviderOpen}
          value={form.provider_id}
          onValueChange={(providerId) => {
            // Radix's hidden native select emits "" on remount; no item
            // carries that value, so persisting it would blank the field.
            if (!providerId) return;
            const provider = providers.find((item) => item.id === providerId);
            setForm((prev) => ({
              ...prev,
              provider_id: providerId,
              catalog_model_id: provider?.models[0]?.id ?? "",
            }));
          }}
          disabled={Boolean(editing)}
        >
          <SelectTrigger
            id="settings-models-provider"
            data-testid="settings-models-provider"
            className={SELECT_TRIGGER_CLASS}
          >
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent portalled={false}>
            {providers.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                {provider.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="settings-models-catalog" className={LABEL_CLASS}>
          Model
        </label>
        <Select
          open={catalogOpen}
          onOpenChange={setCatalogOpen}
          value={form.catalog_model_id}
          onValueChange={(catalogModelId) => {
            // Same guard: an empty value would send a catalog_model_id the
            // backend rejects.
            if (!catalogModelId) return;
            setForm((prev) => ({ ...prev, catalog_model_id: catalogModelId }));
          }}
        >
          <SelectTrigger
            id="settings-models-catalog"
            data-testid="settings-models-catalog"
            className={SELECT_TRIGGER_CLASS}
          >
            <SelectValue placeholder="Model" />
          </SelectTrigger>
          <SelectContent portalled={false}>
            {(selectedProvider?.models ?? []).map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="settings-models-api-key" className={LABEL_CLASS}>
          API key
        </label>
        <Input
          id="settings-models-api-key"
          data-testid="settings-models-api-key"
          type="password"
          name="eve-custom-model-api-key"
          autoComplete="new-password"
          data-1p-ignore="true"
          data-lpignore="true"
          aria-describedby="settings-models-api-key-hint"
          value={form.api_key}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, api_key: e.target.value }))
          }
          required={!editing}
        />
        <p id="settings-models-api-key-hint" className="text-sm text-natural-200">
          {editing
            ? "Leave blank to keep the saved key."
            : "Stored securely. You cannot view it again after saving."}
        </p>
      </div>

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
  // undefined: closed, null: adding, a model: editing it.
  const [formTarget, setFormTarget] = useState<CustomModel | null | undefined>(
    undefined
  );
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
                onClick={() => setFormTarget(null)}
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
                        onClick={() => setFormTarget(model)}
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
        open={formTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) setFormTarget(undefined);
        }}
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
          {formTarget !== undefined && (
            <ModelForm
              editing={formTarget}
              providers={providers}
              onDone={() => setFormTarget(undefined)}
              onSelectOpenChange={setSelectOpen}
            />
          )}
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
