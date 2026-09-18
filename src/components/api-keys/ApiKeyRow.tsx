import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashCan } from "@fortawesome/free-regular-svg-icons";
import { Button } from "@/components/ui/Button";
import {
  createdLabel,
  expiryLabel,
  expiryShort,
  formatKeyMask,
  lastUsedLabel,
  lastUsedShort,
  provenanceLabel,
} from "@/utilities/apiKeys";
import type { ApiKey } from "@/types";

type ApiKeyRowProps = {
  apiKey: ApiKey;
  onDelete: (apiKey: ApiKey) => void;
  disabled?: boolean;
  /** Reference time for "Last used"; a prop so tests can pin it. */
  now?: number;
};

/**
 * One row of the keys table. Props only, no hooks: everything it shows is a
 * pure function of `apiKey`, which keeps it renderable with
 * `renderToStaticMarkup` in tests (this project's vitest runs in a Node
 * environment, no DOM). Short values in the cells, the full wording in each
 * cell's title.
 */
export const ApiKeyRow = ({
  apiKey,
  onDelete,
  disabled,
  now = Date.now(),
}: ApiKeyRowProps) => {
  const mask = formatKeyMask(apiKey.token_suffix);
  const provenance = provenanceLabel(apiKey.created_by_key_id);
  const expired = apiKey.status === "expired";

  return (
    <tr
      data-testid="api-key-row"
      data-key-id={apiKey.id}
      className="border-t border-primary-400/30 align-top"
    >
      <td className="max-w-0 py-3 pr-3">
        <div
          data-testid="api-key-name"
          className="truncate font-medium text-natural-50"
          title={apiKey.name}
        >
          {apiKey.name}
        </div>
        <div
          className="mt-0.5 truncate whitespace-nowrap text-[11px] leading-4 text-primary-300"
          title={[createdLabel(apiKey.created_at), provenance].filter(Boolean).join(", ")}
        >
          <span data-testid="api-key-created">
            {createdLabel(apiKey.created_at)}
          </span>
          {provenance && (
            <>
              {", "}
              <span data-testid="api-key-provenance">
                {provenance}
              </span>
            </>
          )}
        </div>
        {/* Narrow screens drop the other columns: the same values, labelled, under the name. */}
        <div className="mt-1 flex flex-wrap gap-x-2 text-[12px] text-natural-200 sm:hidden">
          <span className="font-mono text-natural-100">{mask}</span>
          <span className={expired ? "text-danger-100" : undefined}>
            {expired ? "Expired" : expiryLabel(apiKey.expires_at, apiKey.status)}
          </span>
          <span>
            {apiKey.last_used_at
              ? `Used ${lastUsedShort(apiKey.last_used_at, now)}`
              : "Never used"}
          </span>
        </div>
      </td>
      <td
        data-testid="api-key-mask"
        className="hidden whitespace-nowrap py-3 pr-3 font-mono text-sm text-natural-100 sm:table-cell"
      >
        {mask}
      </td>
      <td
        data-testid="api-key-last-used"
        className="hidden whitespace-nowrap py-3 pr-3 text-sm text-natural-200 sm:table-cell"
        title={lastUsedLabel(apiKey.last_used_at)}
      >
        {lastUsedShort(apiKey.last_used_at, now)}
      </td>
      <td
        data-testid="api-key-expiry"
        className={`hidden whitespace-nowrap py-3 pr-2 text-sm sm:table-cell ${
          expired ? "text-danger-100" : "text-natural-200"
        }`}
        title={expiryLabel(apiKey.expires_at, apiKey.status)}
      >
        {expiryShort(apiKey.expires_at, apiKey.status)}
      </td>
      <td className="w-8 py-2 text-right">
        <Button
          type="button"
          variant="icon"
          data-testid="api-key-delete"
          aria-label={`Delete API key ${apiKey.name} (${mask})`}
          title="Delete key"
          onClick={() => onDelete(apiKey)}
          disabled={disabled}
          className="text-primary-300 hover:text-danger-300"
        >
          <FontAwesomeIcon icon={faTrashCan} className="size-4" />
        </Button>
      </td>
    </tr>
  );
};
