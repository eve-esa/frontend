import type { ReactNode, Ref } from "react";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import type { CustomModelForm } from "./useCustomModelForm";

// Styled like the Input fields beside it: in light it keeps their white fill, edge and
// placeholder grey, not the trigger's highlight fill.
const SELECT_TRIGGER_CLASS =
  "h-12 bg-primary-200 border border-control shadow-xs in-data-[theme=light]:shadow-none text-natural-100 data-[placeholder]:text-natural-200 in-data-[theme=light]:bg-primary-200 in-data-[theme=light]:[--color-placeholder:inherit]";

type Props = {
  model: CustomModelForm;
  nameRef?: Ref<HTMLInputElement>;
  /**
   * Set: every field gets a label, an id and a `<prefix>-<field>` testid, and the API key a hint
   * (the Settings page). Unset: bare fields with placeholders (the custom models dialog).
   */
  idPrefix?: string;
};

/**
 * The four fields of the custom model form: display name, provider, model and API key. Put them
 * inside a flex column in a `<form>`; the buttons belong to the caller.
 */
export const CustomModelFields = ({ model, nameRef, idPrefix }: Props) => {
  const {
    providers,
    editing,
    form,
    setForm,
    selectedProvider,
    providerSelectOpen,
    setProviderSelectOpen,
    catalogSelectOpen,
    setCatalogSelectOpen,
  } = model;

  const labelled = Boolean(idPrefix);
  const ids = (field: string) =>
    idPrefix ? { id: `${idPrefix}-${field}`, "data-testid": `${idPrefix}-${field}` } : {};
  const field = (name: string, label: string, children: ReactNode) =>
    labelled ? (
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-${name}`} className="font-['NotesESA'] text-sm">
          {label}
        </label>
        {children}
      </div>
    ) : (
      children
    );
  const hintId = `${idPrefix}-api-key-hint`;

  return (
    <>
      {field(
        "name",
        "Display name",
        <Input
          {...ids("name")}
          ref={nameRef}
          name="eve-custom-model-name"
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          className="placeholder:text-natural-200"
          placeholder={labelled ? undefined : "Display name"}
          value={form.display_name}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, display_name: e.target.value }))
          }
          required
        />
      )}
      {field(
        "provider",
        "Provider",
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
          <SelectTrigger {...ids("provider")} className={SELECT_TRIGGER_CLASS}>
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
      )}
      {field(
        "catalog",
        "Model",
        <Select
          open={catalogSelectOpen}
          onOpenChange={setCatalogSelectOpen}
          value={form.catalog_model_id}
          onValueChange={(catalogModelId) => {
            // Radix's hidden native select emits "" on remount; ignoring it
            // keeps the current model instead of blanking the dropdown and
            // sending an empty catalog_model_id the backend rejects.
            if (!catalogModelId) return;
            setForm((prev) => ({ ...prev, catalog_model_id: catalogModelId }));
          }}
        >
          <SelectTrigger {...ids("catalog")} className={SELECT_TRIGGER_CLASS}>
            <SelectValue placeholder="Model" />
          </SelectTrigger>
          <SelectContent portalled={false}>
            {(selectedProvider?.models ?? []).map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {field(
        "api-key",
        "API key",
        <>
          <Input
            {...ids("api-key")}
            type="password"
            name="eve-custom-model-api-key"
            autoComplete="new-password"
            data-1p-ignore="true"
            data-lpignore="true"
            aria-describedby={labelled ? hintId : undefined}
            className="placeholder:text-natural-200"
            placeholder={
              labelled
                ? undefined
                : editing
                  ? "New API key (leave blank to keep current)"
                  : "API key"
            }
            value={form.api_key}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, api_key: e.target.value }))
            }
            required={!editing}
          />
          {labelled && (
            <p id={hintId} className="text-sm text-natural-200">
              {editing
                ? "Leave blank to keep the saved key."
                : "Stored securely. You cannot view it again after saving."}
            </p>
          )}
        </>
      )}
    </>
  );
};
