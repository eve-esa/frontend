import { useEffect, useRef, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { ApiKeyCreateForm } from "@/components/api-keys/ApiKeyCreateForm";
import { ApiKeyDeleteConfirm } from "@/components/api-keys/ApiKeyDeleteConfirm";
import { ApiKeysList } from "@/components/api-keys/ApiKeysList";
import { ApiKeySecretReveal } from "@/components/api-keys/ApiKeySecretReveal";
import { ApiKeyUsageSnippet } from "@/components/api-keys/ApiKeyUsageSnippet";
import { useDeleteApiKey, useListApiKeys } from "@/services/useApiKeys";
import { MUTATION_KEYS } from "@/services/keys";
import { countActive, countDescendants } from "@/utilities/apiKeys";
import type { ApiError, ApiKey, CreatedApiKey } from "@/types";
import { SettingsPanel, SettingsSection, settingsTitleId } from "./SettingsSection";

type CreateView = { kind: "create" } | { kind: "reveal"; key: CreatedApiKey };
type DeleteTarget = { key: ApiKey; descendants: number };

/**
 * The API keys dialog as a page section: the same list, hooks, create form, one-time reveal,
 * delete confirmation (by name, with the cascade) and Quickstart. Create and delete stay in
 * dialogs, as in the approved design.
 */
export const ApiKeysSection = () => {
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Where focus goes when a dialog closes: the key whose delete button comes next, set by a
  // delete that succeeded; unset means return to the control that opened the dialog.
  const focusKeyIdRef = useRef<string | null>(null);
  const openerKeyIdRef = useRef<string | null>(null);
  const pendingCreateFocusRef = useRef(false);
  const [createView, setCreateView] = useState<CreateView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useListApiKeys(true);
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

  const focusHeading = () =>
    document.getElementById(settingsTitleId("api-keys"))?.focus();

  const focusDeleteOf = (keyId: string) => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>("[data-key-id]");
    const row = Array.from(rows ?? []).find((r) => r.dataset.keyId === keyId);
    const button = row?.querySelector<HTMLButtonElement>(
      '[data-testid="api-key-delete"]',
    );
    if (!button || button.disabled) return false;
    button.focus();
    return true;
  };

  // The refetch after a create can land after the dialog closed and disable Create key at the
  // limit, which would drop focus to the body: move it to the heading instead.
  useEffect(() => {
    if (isFetching) return;
    if (
      pendingCreateFocusRef.current &&
      atLimit &&
      document.activeElement === document.body
    ) {
      focusHeading();
    }
    pendingCreateFocusRef.current = false;
  }, [isFetching, atLimit]);

  const closeCreate = () => setCreateView(null);
  const closeDelete = () => {
    resetDelete();
    setDeleteTarget(null);
  };

  const handleDeleteRequest = (key: ApiKey) => {
    resetDelete();
    openerKeyIdRef.current = key.id;
    focusKeyIdRef.current = null;
    setDeleteTarget({ key, descendants: countDescendants(keys, key.id) });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const deletedId = deleteTarget.key.id;
    const index = keys.findIndex((k) => k.id === deletedId);
    const next = index >= 0 ? keys[index + 1] : undefined;
    const done = () => {
      // The deleted row is going away: next row's delete button, else the heading.
      openerKeyIdRef.current = null;
      focusKeyIdRef.current = next?.id ?? null;
      closeDelete();
    };
    deleteKey(deletedId, {
      onSuccess: done,
      onError: (error: ApiError) => {
        if (error?.response?.status === 404) {
          toast.error("That key was already deleted");
          done();
        }
        // Any other error stays visible inline so the person can retry.
      },
    });
  };

  // Create key when it can take focus, else the heading; never the body.
  const refocusCreate = (event: Event) => {
    event.preventDefault();
    const button = createButtonRef.current;
    if (button && !button.disabled) {
      button.focus();
      pendingCreateFocusRef.current = true;
    } else {
      focusHeading();
    }
  };

  const refocusAfterDelete = (event: Event) => {
    event.preventDefault();
    const target = focusKeyIdRef.current ?? openerKeyIdRef.current;
    focusKeyIdRef.current = null;
    openerKeyIdRef.current = null;
    if (target && focusDeleteOf(target)) return;
    focusHeading();
  };

  return (
    <SettingsSection
      id="api-keys"
      title="API keys"
      lead="Use API keys to call EVE from your own scripts and tools. Requests made with a key count toward your monthly token budget, the same budget your chats use."
    >
      <div className="flex flex-col gap-4">
        <SettingsPanel>
          <div ref={listRef}>
            <ApiKeysList
              keys={keys}
              activeCount={activeCount}
              limit={limit}
              atLimit={atLimit}
              isLoading={isLoading}
              isError={isError}
              onRetry={() => void refetch()}
              onCreate={() => setCreateView({ kind: "create" })}
              onDelete={handleDeleteRequest}
              createButtonRef={createButtonRef}
              createTestId="settings-apikeys-create"
            />
          </div>
        </SettingsPanel>

        <SettingsPanel>
          <details>
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
          onCloseAutoFocus={refocusAfterDelete}
        >
          {deleteTarget && (
            <ApiKeyDeleteConfirm
              target={deleteTarget.key}
              descendants={deleteTarget.descendants}
              error={deleteError}
              isDeleting={isDeleting}
              onCancel={closeDelete}
              onConfirm={handleConfirmDelete}
            />
          )}
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
};
