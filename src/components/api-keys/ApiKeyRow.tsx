import { Button } from "@/components/ui/Button";
import {
  apiKeyStatusLabel,
  createdLabel,
  expiryLabel,
  formatKeyMask,
  lastUsedLabel,
  provenanceLabel,
} from "@/utilities/apiKeys";
import type { ApiKey } from "@/types";

type ApiKeyRowProps = {
  apiKey: ApiKey;
  onDelete: (apiKey: ApiKey) => void;
  disabled?: boolean;
};

/**
 * One row of the list. Props only, no hooks: everything it shows is a pure
 * function of `apiKey`, which keeps it renderable with `renderToStaticMarkup`
 * in tests (this project's vitest runs in a Node environment, no DOM).
 */
export const ApiKeyRow = ({ apiKey, onDelete, disabled }: ApiKeyRowProps) => {
  const mask = formatKeyMask(apiKey.token_suffix);
  const provenance = provenanceLabel(apiKey.created_by);

  return (
    <li
      data-testid="api-key-row"
      data-key-id={apiKey.id}
      className="flex flex-col gap-1 rounded-lg border border-primary-400/40 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            data-testid="api-key-name"
            className="truncate font-medium text-natural-50"
          >
            {apiKey.name}
          </span>
          {apiKey.status !== "active" && (
            <span
              data-testid="api-key-status"
              className="shrink-0 rounded-full bg-primary-400/40 px-2 py-0.5 text-xs text-natural-200"
            >
              {apiKeyStatusLabel(apiKey.status)}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="api-key-delete"
          aria-label={`Delete API key ${apiKey.name} (${mask})`}
          onClick={() => onDelete(apiKey)}
          disabled={disabled}
        >
          Delete
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-primary-300">
        <span data-testid="api-key-mask" className="font-mono text-natural-100">
          {mask}
        </span>
        <span data-testid="api-key-created">{createdLabel(apiKey.created_at)}</span>
        <span data-testid="api-key-last-used">{lastUsedLabel(apiKey.last_used_at)}</span>
        <span data-testid="api-key-expiry">
          {expiryLabel(apiKey.expires_at, apiKey.status)}
        </span>
      </div>

      {provenance && (
        <div data-testid="api-key-provenance" className="text-sm text-primary-300">
          {provenance}
        </div>
      )}
    </li>
  );
};
