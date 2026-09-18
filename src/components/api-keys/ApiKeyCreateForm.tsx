import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useCreateApiKey } from "@/services/useApiKeys";
import { handleApiError } from "@/utilities/helpers";
import {
  DEFAULT_EXPIRY,
  EXPIRY_OPTIONS,
  buildCreateApiKeyBody,
  type ExpiryOption,
} from "@/utilities/apiKeys";
import type { CreatedApiKey } from "@/types";

type ApiKeyCreateFormProps = {
  onCancel: () => void;
  onCreated: (key: CreatedApiKey) => void;
};

export const ApiKeyCreateForm = ({ onCancel, onCreated }: ApiKeyCreateFormProps) => {
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState<ExpiryOption>(DEFAULT_EXPIRY);
  const { mutate: createKey, isPending, error, reset } = useCreateApiKey();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    createKey(buildCreateApiKeyBody({ name, expiry }), {
      onSuccess: (key) => {
        onCreated(key);
        reset();
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Create API key</DialogTitle>
        <DialogDescription>
          Name it however helps you tell your keys apart. Both fields are
          optional from the command line too: an omitted name gets a
          generated one, and an omitted expiry defaults to 90 days.
        </DialogDescription>
      </DialogHeader>

      <form
        data-testid="api-key-create-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="api-key-name-input" className="text-sm font-medium text-natural-100">
            Name (optional)
          </label>
          <Input
            id="api-key-name-input"
            data-testid="api-key-name-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            placeholder="e.g. Local script"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-natural-100">Expiration</legend>
          <div className="flex flex-col gap-2">
            {EXPIRY_OPTIONS.map((option) => (
              <label
                key={option.value}
                htmlFor={`api-key-expiry-${option.value}`}
                className="flex items-center gap-2 text-sm text-natural-100"
              >
                <input
                  id={`api-key-expiry-${option.value}`}
                  data-testid={`api-key-expiry-${option.value}`}
                  type="radio"
                  name="api-key-expiry"
                  value={option.value}
                  checked={expiry === option.value}
                  onChange={() => setExpiry(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
          {expiry === "never" && (
            <p className="text-sm text-danger-100">
              A key with no expiration works until you delete it. Prefer a
              fixed expiry when you can.
            </p>
          )}
        </fieldset>

        {error && (
          <p role="alert" data-testid="api-key-create-error" className="text-sm text-danger-400">
            {handleApiError(error)}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            data-testid="api-key-create-cancel"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" data-testid="api-key-create-submit" disabled={isPending}>
            {isPending ? <Spinner size="xs" /> : null}
            Create key
          </Button>
        </div>
      </form>
    </div>
  );
};
