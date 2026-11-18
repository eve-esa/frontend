import type { ReactNode, Ref } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ApiKeyRow } from "./ApiKeyRow";
import type { ApiKey } from "@/types";

type ApiKeysListProps = {
  keys: ApiKey[];
  activeCount: number;
  limit: number | undefined;
  atLimit: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onCreate: () => void;
  onDelete: (apiKey: ApiKey) => void;
  createButtonRef?: Ref<HTMLButtonElement>;
  /** The dialog and the Settings page keep their own create button test id. */
  createTestId: string;
  /** Rendered last inside the loaded state, under the table. */
  children?: ReactNode;
};

/**
 * Loading, error, count with the Create button, limit notice, empty state and the table of
 * keys: the part the API keys dialog and the Settings section share.
 */
export const ApiKeysList = ({
  keys,
  activeCount,
  limit,
  atLimit,
  isLoading,
  isError,
  onRetry,
  onCreate,
  onDelete,
  createButtonRef,
  createTestId,
  children,
}: ApiKeysListProps) => (
  <>
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
          onClick={onRetry}
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
            ref={createButtonRef}
            data-testid={createTestId}
            onClick={onCreate}
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
          <div className="overflow-x-auto">
            <table data-testid="api-keys-list" className="w-full table-fixed text-left">
              <thead>
                <tr className="text-sm font-medium text-primary-300">
                  <th scope="col" className="pb-2 pr-3 font-medium">Name</th>
                  <th scope="col" className="hidden w-28 pb-2 pr-3 font-medium sm:table-cell">Key</th>
                  <th scope="col" className="hidden w-24 pb-2 pr-3 font-medium sm:table-cell">
                    Last used
                  </th>
                  <th scope="col" className="hidden w-24 pb-2 pr-2 font-medium sm:table-cell">Expires</th>
                  <th scope="col" className="w-10 pb-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <ApiKeyRow key={key.id} apiKey={key} onDelete={onDelete} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {children}
      </div>
    )}
  </>
);
