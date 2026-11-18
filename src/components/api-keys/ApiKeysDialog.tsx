import { useEffect, useRef, useState, type RefObject } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
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
import { countActive, countDescendants } from "@/utilities/apiKeys";
import { ApiKeyCreateForm } from "./ApiKeyCreateForm";
import { ApiKeyDeleteConfirm } from "./ApiKeyDeleteConfirm";
import { ApiKeysList } from "./ApiKeysList";
import { ApiKeySecretReveal } from "./ApiKeySecretReveal";
import { ApiKeyUsageSnippet } from "./ApiKeyUsageSnippet";
import type { ApiError, ApiKey, CreatedApiKey } from "@/types";

type ApiKeysDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opened from state, not a DialogTrigger, so Radix has no trigger to refocus on close. */
  returnFocusRef?: RefObject<HTMLElement | null>;
};

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "reveal"; key: CreatedApiKey }
  | { kind: "confirmDelete"; key: ApiKey; descendants: number };

export const ApiKeysDialog = ({
  isOpen,
  onOpenChange,
  returnFocusRef,
}: ApiKeysDialogProps) => {
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
        onCloseAutoFocus={(event) => {
          if (returnFocusRef?.current) {
            event.preventDefault();
            returnFocusRef.current.focus();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (view.kind === "create" && isCreatePending) return;
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

            <ApiKeysList
              keys={keys}
              activeCount={activeCount}
              limit={limit}
              atLimit={atLimit}
              isLoading={isLoading}
              isError={isError}
              onRetry={() => void refetch()}
              onCreate={() => setView({ kind: "create" })}
              onDelete={handleDeleteRequest}
              createButtonRef={createOpenRef}
              createTestId="api-keys-create-open"
            >
              <details className="rounded-lg border border-primary-400/40">
                <summary
                  data-testid="api-keys-quickstart-toggle"
                  className="cursor-pointer p-3 text-sm font-medium text-natural-100"
                >
                  Quickstart
                </summary>
                <div className="px-3 pb-3">
                  <ApiKeyUsageSnippet />
                </div>
              </details>
            </ApiKeysList>

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
          <ApiKeyDeleteConfirm
            target={view.key}
            descendants={view.descendants}
            error={deleteError}
            isDeleting={isDeleting}
            cancelRef={deleteCancelRef}
            onCancel={() => {
              resetDelete();
              goToList();
            }}
            onConfirm={handleConfirmDelete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
