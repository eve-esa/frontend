import { useEffect, useRef, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useDeleteApiKey, useListApiKeys } from "@/services/useApiKeys";
import { MUTATION_KEYS } from "@/services/keys";
import { handleApiError } from "@/utilities/helpers";
import {
  cascadeWarning,
  countActive,
  countDescendants,
  formatKeyMask,
} from "@/utilities/apiKeys";
import { ApiKeyCreateForm } from "./ApiKeyCreateForm";
import { ApiKeyRow } from "./ApiKeyRow";
import { ApiKeySecretReveal } from "./ApiKeySecretReveal";
import { ApiKeyUsageSnippet } from "./ApiKeyUsageSnippet";
import type { ApiError, ApiKey, CreatedApiKey } from "@/types";

type ApiKeysDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "reveal"; key: CreatedApiKey }
  | { kind: "confirmDelete"; key: ApiKey; descendants: number };

export const ApiKeysDialog = ({ isOpen, onOpenChange }: ApiKeysDialogProps) => {
  const [view, setView] = useState<View>({ kind: "list" });
  const createOpenRef = useRef<HTMLButtonElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);

  const { data, isLoading, isError, refetch } = useListApiKeys(isOpen);
  const {
    mutate: deleteKey,
    isPending: isDeleting,
    error: deleteError,
    reset: resetDelete,
  } = useDeleteApiKey();

  // The create mutation's response carries the raw secret once; a close
  // mid-request would drop the only reference to it before the reveal view
  // ever gets a chance to show it.
  const isCreatePending =
    useIsMutating({ mutationKey: [MUTATION_KEYS.apiKeys, "create"] }) > 0;

  useEffect(() => {
    if (!isOpen) return;
    if (view.kind === "list") {
      createOpenRef.current?.focus();
    } else if (view.kind === "confirmDelete") {
      deleteCancelRef.current?.focus();
    }
  }, [isOpen, view.kind]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (isCreatePending) return;
      // Drops the reveal view's secret and any confirm/create state, so
      // reopening the dialog always starts at the list.
      setView({ kind: "list" });
      resetDelete();
    }
    onOpenChange(open);
  };

  const goToList = () => setView({ kind: "list" });

  const handleDeleteRequest = (key: ApiKey) => {
    resetDelete();
    setView({
      kind: "confirmDelete",
      key,
      descendants: countDescendants(data?.keys ?? [], key.id),
    });
  };

  const handleConfirmDelete = () => {
    if (view.kind !== "confirmDelete") return;
    deleteKey(view.key.id, {
      onSuccess: goToList,
      onError: (error: ApiError) => {
        if (error?.response?.status === 404) {
          toast.error("That key was already deleted");
          goToList();
        }
        // Any other error stays visible inline (api-key-delete-error) so the
        // person can retry without losing the confirmation context.
      },
    });
  };

  const keys = data?.keys ?? [];
  const limit = data?.limit;
  const activeCount = countActive(keys);
  const atLimit = limit !== undefined && activeCount >= limit;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="api-keys-dialog"
        className="sm:max-w-2xl max-h-[85vh] overflow-y-auto"
        onEscapeKeyDown={(event) => {
          if (view.kind !== "list") {
            event.preventDefault();
            goToList();
          }
        }}
        onPointerDownOutside={(event) => {
          if (view.kind === "create" || view.kind === "reveal") {
            event.preventDefault();
          }
        }}
      >
        {view.kind === "list" && (
          <>
            <DialogHeader>
              <DialogTitle>API keys</DialogTitle>
              <DialogDescription>
                Use API keys to call EVE from your own scripts and tools.
                Requests made with a key count toward your monthly token
                budget, the same budget your chats use.
                {limit !== undefined && ` You can have up to ${limit} active keys.`}
              </DialogDescription>
            </DialogHeader>

            {isLoading && (
              <div data-testid="api-keys-loading" className="flex justify-center py-8">
                <Spinner variant="primary" />
              </div>
            )}

            {!isLoading && isError && (
              <div data-testid="api-keys-error" className="flex flex-col items-center gap-2 py-8">
                <p className="text-sm text-danger-400">Could not load your API keys.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="api-keys-retry"
                  onClick={() => void refetch()}
                >
                  Retry
                </Button>
              </div>
            )}

            {!isLoading && !isError && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <span data-testid="api-keys-count" className="text-sm text-primary-300">
                    {activeCount} of {limit ?? "?"} active keys
                  </span>
                  <Button
                    type="button"
                    ref={createOpenRef}
                    data-testid="api-keys-create-open"
                    onClick={() => setView({ kind: "create" })}
                    disabled={atLimit}
                  >
                    Create key
                  </Button>
                </div>

                {atLimit && (
                  <p data-testid="api-keys-limit-notice" className="text-sm text-danger-100">
                    You have reached the limit of {limit} active keys. Delete one to
                    create another.
                  </p>
                )}

                {keys.length === 0 ? (
                  <p data-testid="api-keys-empty" className="text-sm text-primary-300">
                    No API keys yet. Create one to call EVE from your own code.
                  </p>
                ) : (
                  <ul data-testid="api-keys-list" className="flex flex-col gap-2">
                    {keys.map((key) => (
                      <ApiKeyRow key={key.id} apiKey={key} onDelete={handleDeleteRequest} />
                    ))}
                  </ul>
                )}

                <details className="rounded-lg border border-primary-400/40">
                  <summary className="cursor-pointer p-3 text-sm font-medium text-natural-100">
                    Use your key
                  </summary>
                  <div className="px-3 pb-3">
                    <ApiKeyUsageSnippet />
                  </div>
                </details>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                data-testid="api-keys-close"
                onClick={() => handleOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        )}

        {view.kind === "create" && (
          <ApiKeyCreateForm
            onCancel={goToList}
            onCreated={(key) => setView({ kind: "reveal", key })}
          />
        )}

        {view.kind === "reveal" && (
          <ApiKeySecretReveal apiKey={view.key} onDone={goToList} />
        )}

        {view.kind === "confirmDelete" && (
          <div data-testid="api-key-delete-confirm" className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Delete API key?</DialogTitle>
              <DialogDescription>
                {view.key.name} ({formatKeyMask(view.key.token_suffix)}) stops
                working immediately; apps using it will get 401 errors. This
                cannot be undone.
                {view.descendants > 0 && (
                  <>
                    {" "}
                    <span
                      data-testid="api-key-delete-cascade-warning"
                      className="text-danger-100"
                    >
                      {cascadeWarning(view.descendants)}
                    </span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {deleteError && (
              <p role="alert" data-testid="api-key-delete-error" className="text-sm text-danger-400">
                {handleApiError(deleteError)}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                ref={deleteCancelRef}
                variant="outline"
                data-testid="api-key-delete-cancel"
                onClick={() => {
                  resetDelete();
                  goToList();
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                data-testid="api-key-delete-confirm-submit"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? <Spinner size="xs" /> : null}
                {view.descendants > 0
                  ? `Delete ${view.descendants + 1} keys`
                  : "Delete key"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
