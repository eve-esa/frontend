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
import { useEffect, useMemo, useState } from "react";
import { useListModels } from "@/services/useListModels";
import {
  useCreateCustomModel,
  useDeleteCustomModel,
  useUpdateCustomModel,
} from "@/services/useCustomModels";
import {
  buildUpdatePayload,
  emptyCustomModelForm,
  type CustomModelFormState,
} from "@/utilities/customModelForm";
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
  const [editing, setEditing] = useState<CustomModel | null>(null);
  const [form, setForm] = useState<CustomModelFormState>(emptyCustomModelForm);
  const [providerSelectOpen, setProviderSelectOpen] = useState(false);
  const [catalogSelectOpen, setCatalogSelectOpen] = useState(false);
  const isSelectOpen = providerSelectOpen || catalogSelectOpen;

  const providers = models?.providers ?? [];

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === form.provider_id),
    [providers, form.provider_id],
  );

  useEffect(() => {
    if (!form.provider_id && providers.length > 0 && !editing) {
      const firstProvider = providers[0];
      setForm((prev) => ({
        ...prev,
        provider_id: firstProvider.id,
        catalog_model_id: firstProvider.models[0]?.id ?? "",
      }));
    }
  }, [providers, form.provider_id, editing]);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyCustomModelForm());
  };

  const { mutate: createModel, isPending: isCreating } = useCreateCustomModel(
    resetForm,
  );
  const { mutate: updateModel, isPending: isUpdating } = useUpdateCustomModel(
    resetForm,
  );
  const { mutate: deleteModel, isPending: isDeleting } = useDeleteCustomModel();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (editing) {
      updateModel(buildUpdatePayload(editing.id, form));
      return;
    }
    createModel(form);
  };

  const startEdit = (model: CustomModel) => {
    setEditing(model);
    setForm({
      display_name: model.display_name,
      provider_id: model.provider_id,
      catalog_model_id: model.catalog_model_id,
      api_key: "",
    });
  };

  const isPending = isCreating || isUpdating || isDeleting;

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
                      {model.provider_display_name} · {model.model_display_name}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(model)}
                      disabled={isPending}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => deleteModel(model.id)}
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="text-sm font-medium">
              {editing ? "Edit model" : "Add model"}
            </p>
            <Input
              name="eve-custom-model-name"
              autoComplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              className="placeholder:text-natural-200"
              placeholder="Display name"
              value={form.display_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, display_name: e.target.value }))
              }
              required
            />
            <Select
              open={providerSelectOpen}
              onOpenChange={setProviderSelectOpen}
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
              <SelectTrigger className="h-12 bg-primary-200 border border-primary-400 shadow-xs text-natural-100 data-[placeholder]:text-natural-200">
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
            <Select
              open={catalogSelectOpen}
              onOpenChange={setCatalogSelectOpen}
              value={form.catalog_model_id}
              onValueChange={(catalogModelId) => {
                // Radix's hidden native select emits "" on remount; ignoring it
                // keeps the current model instead of blanking the dropdown and
                // sending an empty catalog_model_id the backend rejects.
                if (!catalogModelId) return;
                setForm((prev) => ({
                  ...prev,
                  catalog_model_id: catalogModelId,
                }));
              }}
            >
              <SelectTrigger className="h-12 bg-primary-200 border border-primary-400 shadow-xs text-natural-100 data-[placeholder]:text-natural-200">
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
            <Input
              type="password"
              name="eve-custom-model-api-key"
              autoComplete="new-password"
              data-1p-ignore="true"
              data-lpignore="true"
              className="placeholder:text-natural-200"
              placeholder={
                editing
                  ? "New API key (leave blank to keep current)"
                  : "API key"
              }
              value={form.api_key}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, api_key: e.target.value }))
              }
              required={!editing}
            />
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
      </DialogContent>
    </Dialog>
  );
};
