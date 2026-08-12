import type { UpdateCustomModelInput } from "@/services/useCustomModels";

export type CustomModelFormState = {
  display_name: string;
  provider_id: string;
  catalog_model_id: string;
  api_key: string;
};

export const emptyCustomModelForm = (): CustomModelFormState => ({
  display_name: "",
  provider_id: "",
  catalog_model_id: "",
  api_key: "",
});

/**
 * Build the PATCH body for editing a custom model, dropping empty fields so the
 * backend keeps the stored value. A blank catalog_model_id is rejected by the
 * API (min_length=1) and a blank api_key must never overwrite the saved secret.
 * Radix's Select can momentarily blank catalog_model_id on remount, so omitting
 * empties here backs up the onValueChange guards in the dialog.
 */
export const buildUpdatePayload = (
  id: string,
  form: CustomModelFormState,
): UpdateCustomModelInput => {
  const payload: UpdateCustomModelInput = { id };
  if (form.display_name) payload.display_name = form.display_name;
  if (form.catalog_model_id) payload.catalog_model_id = form.catalog_model_id;
  if (form.api_key) payload.api_key = form.api_key;
  return payload;
};
