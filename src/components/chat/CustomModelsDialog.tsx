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
import type { CustomModel } from "@/types";

type CustomModelsDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

type FormState = {
  display_name: string;
  provider_id: string;
  catalog_model_id: string;
  api_key: string;
};

const emptyForm = (): FormState => ({
  display_name: "",
  provider_id: "",
  catalog_model_id: "",
  api_key: "",
});

export const CustomModelsDialog = ({
  isOpen,
  onOpenChange,
}: CustomModelsDialogProps) => {
  const { data: models } = useListModels();
  const [editing, setEditing] = useState<CustomModel | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

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
    setForm(emptyForm());
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
      updateModel({
        id: editing.id,
        display_name: form.display_name,
        catalog_model_id: form.catalog_model_id,
        ...(form.api_key ? { api_key: form.api_key } : {}),
      });
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
      <DialogContent className="max-w-2xl">
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
              placeholder="Display name"
              value={form.display_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, display_name: e.target.value }))
              }
              required
            />
            <Select
              value={form.provider_id}
              onValueChange={(providerId) => {
                const provider = providers.find((item) => item.id === providerId);
                setForm((prev) => ({
                  ...prev,
                  provider_id: providerId,
                  catalog_model_id: provider?.models[0]?.id ?? "",
                }));
              }}
              disabled={Boolean(editing)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={form.catalog_model_id}
              onValueChange={(catalogModelId) =>
                setForm((prev) => ({
                  ...prev,
                  catalog_model_id: catalogModelId,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                {(selectedProvider?.models ?? []).map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="password"
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
