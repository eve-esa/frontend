import type { Ref } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { handleApiError } from "@/utilities/helpers";
import { cascadeWarning, formatKeyMask } from "@/utilities/apiKeys";
import type { ApiError, ApiKey } from "@/types";

type ApiKeyDeleteConfirmProps = {
  target: ApiKey;
  /** Keys created with the target, deleted with it. */
  descendants: number;
  error: ApiError | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  cancelRef?: Ref<HTMLButtonElement>;
};

/**
 * The delete confirmation, by name, with the cascade warning. Rendered inside a dialog by the
 * API keys dialog and by the Settings page section.
 */
export const ApiKeyDeleteConfirm = ({
  target,
  descendants,
  error,
  isDeleting,
  onCancel,
  onConfirm,
  cancelRef,
}: ApiKeyDeleteConfirmProps) => (
  <div data-testid="api-key-delete-confirm" className="flex flex-col gap-4">
    <DialogHeader>
      <DialogTitle>Delete API key?</DialogTitle>
      <DialogDescription>
        The key stops working right away. Any app or script that uses
        it gets a 401 error. You cannot undo this.
      </DialogDescription>
    </DialogHeader>

    <div
      data-testid="api-key-delete-target"
      className="rounded-md border border-primary-400/60 px-3 py-2"
    >
      <div className="truncate text-sm font-medium text-natural-50">
        {target.name}
      </div>
      <code className="font-mono text-xs text-primary-300">
        {formatKeyMask(target.token_suffix)}
      </code>
    </div>

    {descendants > 0 && (
      <p
        data-testid="api-key-delete-cascade-warning"
        className="rounded-md border border-danger-100/60 bg-danger-100/10 p-3 text-sm text-danger-100"
      >
        {cascadeWarning(descendants)}
      </p>
    )}

    {error && (
      <p role="alert" data-testid="api-key-delete-error" className="text-sm text-danger-400">
        {handleApiError(error)}
      </p>
    )}

    <div className="flex justify-end gap-2">
      <Button
        type="button"
        ref={cancelRef}
        variant="outline"
        data-testid="api-key-delete-cancel"
        onClick={onCancel}
        disabled={isDeleting}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="destructive"
        data-testid="api-key-delete-confirm-submit"
        onClick={onConfirm}
        disabled={isDeleting}
      >
        {isDeleting ? <Spinner size="xs" /> : null}
        {descendants > 0 ? `Delete ${descendants + 1} keys` : "Delete key"}
      </Button>
    </div>
  </div>
);
