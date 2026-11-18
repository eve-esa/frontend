import { useEffect, useMemo, useState } from "react";
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

type Options = {
  providers: ProviderCatalog[];
  /** The model being edited from the first render, or null to add one. */
  initialEditing?: CustomModel | null;
  /** Runs once, only while the component using the form is still mounted. */
  onDone?: () => void;
};

const formFor = (model: CustomModel | null): CustomModelFormState =>
  model
    ? {
        display_name: model.display_name,
        provider_id: model.provider_id,
        catalog_model_id: model.catalog_model_id,
        api_key: "",
      }
    : emptyCustomModelForm();

/**
 * The state and requests of the add and edit form for custom models, shared by the custom models
 * dialog and the Models section: first-provider default, create and update bodies, and the open
 * state of the two selects (a click inside an open select must not close the dialog).
 */
export const useCustomModelForm = ({
  providers,
  initialEditing = null,
  onDone,
}: Options) => {
  const [editing, setEditing] = useState<CustomModel | null>(initialEditing);
  const [form, setForm] = useState<CustomModelFormState>(() =>
    formFor(initialEditing)
  );
  const [providerSelectOpen, setProviderSelectOpen] = useState(false);
  const [catalogSelectOpen, setCatalogSelectOpen] = useState(false);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === form.provider_id),
    [providers, form.provider_id]
  );

  // Adding: start on the first provider and its first model.
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

  const reset = () => {
    setEditing(null);
    setForm(emptyCustomModelForm());
  };

  const { mutate: createModel, isPending: isCreating } =
    useCreateCustomModel(reset);
  const { mutate: updateModel, isPending: isUpdating } =
    useUpdateCustomModel(reset);

  // Per call, not in the hook: a success that lands after the form unmounted must not run onDone.
  const callOptions = onDone ? { onSuccess: onDone } : undefined;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (editing) {
      updateModel(buildUpdatePayload(editing.id, form), callOptions);
      return;
    }
    createModel(form, callOptions);
  };

  const startEdit = (model: CustomModel) => {
    setEditing(model);
    setForm(formFor(model));
  };

  return {
    providers,
    editing,
    form,
    setForm,
    selectedProvider,
    providerSelectOpen,
    setProviderSelectOpen,
    catalogSelectOpen,
    setCatalogSelectOpen,
    isSelectOpen: providerSelectOpen || catalogSelectOpen,
    isPending: isCreating || isUpdating,
    submit,
    startEdit,
    reset,
  };
};

export type CustomModelForm = ReturnType<typeof useCustomModelForm>;
