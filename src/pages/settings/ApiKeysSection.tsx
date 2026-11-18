import { useRef, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { ApiKeyCreateForm } from "@/components/api-keys/ApiKeyCreateForm";
import { ApiKeyRow } from "@/components/api-keys/ApiKeyRow";
import { ApiKeySecretReveal } from "@/components/api-keys/ApiKeySecretReveal";
import { ApiKeyUsageSnippet } from "@/components/api-keys/ApiKeyUsageSnippet";
import { useDeleteApiKey, useListApiKeys } from "@/services/useApiKeys";
import { MUTATION_KEYS } from "@/services/keys";
import { handleApiError } from "@/utilities/helpers";
import {
  cascadeWarning,
  countActive,
  countDescendants,
  formatKeyMask,
} from "@/utilities/apiKeys";
import type { ApiError, ApiKey, CreatedApiKey } from "@/types";
import { SettingsPanel, SettingsSection } from "./SettingsSection";

type CreateView = { kind: "create" } | { kind: "reveal"; key: CreatedApiKey };
type DeleteTarget = { key: ApiKey; descendants: number };

/**
 * The API keys dialog as a page section: the same list, hooks, create form, one-time reveal,
 * delete confirmation (by name, with the cascade) and Quickstart. Create and delete stay in
 * dialogs, as in the approved design.
 */
export const ApiKeysSection = () => {
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const [createView, setCreateView] = useState<CreateView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const { data, isLoading, isError, refetch } = useListApiKeys(true);
  const {
    mutate: deleteKey,
    isPending: isDeleting,
    error: deleteError,
    reset: resetDelete,
  } = useDeleteApiKey();

  // A close mid-request would drop the only reference to the secret before the reveal shows it.
  const isCreatePending =
    useIsMutating({ mutationKey: [MUTATION_KEYS.apiKeys, "create"] }) > 0;

  const keys = data?.keys ?? [];
  const limit = data?.limit;
  const activeCount = countActive(keys);
  const atLimit = limit !== undefined && activeCount >= limit;

  const closeCreate = () => setCreateView(null);
  const closeDelete = () => {
    resetDelete();
    setDeleteTarget(null);
  };

  const handleDeleteRequest = (key: ApiKey) => {
    resetDelete();
    setDeleteTarget({ key, descendants: countDescendants(keys, key.id) });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteKey(deleteTarget.key.id, {
      onSuccess: closeDelete,
      onError: (error: ApiError) => {
        if (error?.response?.status === 404) {
          toast.error("That key was already deleted");
          closeDelete();
        }
        // Any other error stays visible inline so the person can retry.
      },
    });
  };

  // The delete button is gone once its key is, so focus returns to Create key.
  const refocusCreate = (event: Event) => {
    event.preventDefault();
    createButtonRef.current?.focus();
  };

  return (
    <SettingsSection
      id="api-keys"
      title="API keys"
      lead="Use API keys to call EVE from your own scripts and tools. Requests made with a key count toward your monthly token budget, the same budget your chats use."
    >
      <div className="flex flex-col gap-4">
        <SettingsPanel>
          {isLoading && (
            <div
              data-testid="api-keys-loading"
              className="flex justify-center py-8"
            >
              <Spinner variant="primary" />
            </div>
          )}

          {!isLoading && isError && (
            <div
              data-testid="api-keys-error"
              className="flex flex-col items-center gap-2 py-8"
            >
              <p className="text-sm text-danger-400">
                Could not load your API keys.
              </p>
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
                <span
                  data-testid="api-keys-count"
                  className="text-sm text-primary-300"
                >
                  {activeCount} of {limit ?? "?"} active keys
                </span>
                <Button
                  type="button"
                  ref={createButtonRef}
                  data-testid="settings-apikeys-create"
                  onClick={() => setCreateView({ kind: "create" })}
                  disabled={atLimit}
                >
                  Create key
                </Button>
              </div>

              {atLimit && (
                <p
                  data-testid="api-keys-limit-notice"
                  className="text-sm text-danger-100"
                >
                  You have reached the limit of {limit} active keys. Delete one
                  to create another.
                </p>
              )}

              {keys.length === 0 ? (
                <p
                  data-testid="api-keys-empty"
                  className="text-sm text-primary-300"
                >
                  No API keys yet. Create one to call EVE from your own code.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table
                    data-testid="api-keys-list"
                    className="w-full table-fixed text-left"
                  >
                    <thead>
                      <tr className="text-sm font-medium text-primary-300">
                        <th scope="col" className="pb-2 pr-3 font-medium">
                          Name
                        </th>
                        <th
                          scope="col"
                          className="hidden w-28 pb-2 pr-3 font-medium sm:table-cell"
                        >
                          Key prefix
                        </th>
                        <th
                          scope="col"
                          className="hidden w-24 pb-2 pr-3 font-medium sm:table-cell"
                        >
                          Last used
                        </th>
                        <th
                          scope="col"
                          className="hidden w-24 pb-2 pr-2 font-medium sm:table-cell"
                        >
                          Expires
                        </th>
                        <th scope="col" className="w-10 pb-2">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((key) => (
                        <ApiKeyRow
                          key={key.id}
                          apiKey={key}
                          testId={`settings-apikeys-row-${key.id}`}
                          onDelete={handleDeleteRequest}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </SettingsPanel>

        <SettingsPanel>
          <details open>
            <summary
              data-testid="api-keys-quickstart-toggle"
              className="cursor-pointer text-sm font-medium text-natural-100"
            >
              Quickstart
            </summary>
            <div className="pt-3">
              <ApiKeyUsageSnippet />
            </div>
          </details>
        </SettingsPanel>
      </div>

      <Dialog
        open={createView !== null}
        onOpenChange={(open) => {
          if (!open && !isCreatePending) closeCreate();
        }}
      >
        <DialogContent
          data-testid="settings-apikeys-create-dialog"
          className="sm:max-w-2xl max-h-[85vh] overflow-y-auto"
          onCloseAutoFocus={refocusCreate}
          onEscapeKeyDown={(event) => {
            if (isCreatePending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          {createView?.kind === "create" && (
            <ApiKeyCreateForm
              onCancel={closeCreate}
              onCreated={(key) => setCreateView({ kind: "reveal", key })}
            />
          )}
          {createView?.kind === "reveal" && (
            <ApiKeySecretReveal apiKey={createView.key} onDone={closeCreate} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) closeDelete();
        }}
      >
        <DialogContent
          data-testid="settings-apikeys-delete-dialog"
          onCloseAutoFocus={refocusCreate}
        >
          {deleteTarget && (
            <div
              data-testid="api-key-delete-confirm"
              className="flex flex-col gap-4"
            >
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
                  {deleteTarget.key.name}
                </div>
                <code className="font-mono text-xs text-primary-300">
                  {formatKeyMask(deleteTarget.key.token_suffix)}
                </code>
              </div>

              {deleteTarget.descendants > 0 && (
                <p
                  data-testid="api-key-delete-cascade-warning"
                  className="rounded-md border border-danger-100/60 bg-danger-100/10 p-3 text-sm text-danger-100"
                >
                  {cascadeWarning(deleteTarget.descendants)}
                </p>
              )}

              {deleteError && (
                <p
                  role="alert"
                  data-testid="api-key-delete-error"
                  className="text-sm text-danger-400"
                >
                  {handleApiError(deleteError)}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  data-testid="api-key-delete-cancel"
                  onClick={closeDelete}
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
                  {deleteTarget.descendants > 0
                    ? `Delete ${deleteTarget.descendants + 1} keys`
                    : "Delete key"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
};
