import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCopy } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/Button";
import { useClipboard } from "@/hooks/useClipboard";
import { buildUsageSnippet, resolveApiBaseUrl } from "@/utilities/apiKeys";

/**
 * "Use your key" curl example. Never embeds the real secret, by design: it
 * builds from `resolveApiBaseUrl` alone, so it renders identically whether
 * shown collapsed in the list view (no secret in scope) or expanded in the
 * reveal view (secret in scope but never read here).
 */
export const ApiKeyUsageSnippet = () => {
  const { copyToClipboard, isCopied } = useClipboard();
  const baseUrl = resolveApiBaseUrl(
    import.meta.env.VITE_API_URL,
    window.location.origin,
  );
  const snippet = buildUsageSnippet(baseUrl);

  return (
    <div
      data-testid="api-keys-usage-snippet"
      className="flex flex-col gap-2 rounded-lg border border-primary-400 bg-primary-700/30 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-words text-xs text-natural-100">
          {snippet}
        </pre>
        <Button
          type="button"
          variant="icon"
          data-testid="api-keys-usage-snippet-copy"
          aria-label="Copy usage snippet"
          onClick={() => void copyToClipboard(snippet)}
        >
          <FontAwesomeIcon
            icon={isCopied ? faCheck : faCopy}
            className="size-4"
          />
        </Button>
      </div>
    </div>
  );
};
