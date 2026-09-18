import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCopy } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/Button";
import { useClipboard } from "@/hooks/useClipboard";
import { buildQuickstartSteps, resolveApiBaseUrl } from "@/utilities/apiKeys";

const CopyButton = ({
  value,
  label,
  testId,
  className = "",
}: {
  value: string;
  label: string;
  testId: string;
  className?: string;
}) => {
  const { copyToClipboard, isCopied } = useClipboard();
  return (
    <Button
      type="button"
      variant="icon"
      data-testid={testId}
      aria-label={label}
      title={label}
      onClick={() => void copyToClipboard(value)}
      className={`shrink-0 text-primary-300 hover:text-natural-50 ${className}`}
    >
      <FontAwesomeIcon icon={isCopied ? faCheck : faCopy} className="size-3.5" />
    </Button>
  );
};

/**
 * Quickstart: the base URL, then one command per step, each with its own copy
 * button. Never embeds the real secret, by design: it builds from
 * `resolveApiBaseUrl` alone, so it renders identically in the list view (no
 * secret in scope) and in the reveal view (secret in scope but never read here).
 */
export const ApiKeyUsageSnippet = () => {
  const apiBase = resolveApiBaseUrl(
    import.meta.env.VITE_API_URL,
    window.location.origin,
  );
  const baseUrl = `${apiBase}/v1`;
  const steps = buildQuickstartSteps(apiBase);

  return (
    <div data-testid="api-keys-usage-snippet" className="flex flex-col gap-3">
      <p className="text-sm text-natural-200">
        The API is OpenAI-compatible: any OpenAI SDK works with this base URL
        and your key.
      </p>

      <div className="flex items-center justify-between gap-2 rounded-md border border-primary-400/60 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[11px] leading-4 text-primary-300">Base URL</div>
          <code className="block truncate font-mono text-sm text-natural-50">
            {baseUrl}
          </code>
        </div>
        <CopyButton
          value={baseUrl}
          label="Copy base URL"
          testId="api-keys-usage-copy-base-url"
        />
      </div>

      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-natural-100">
              {index + 1}. {step.title}
            </span>
            <div className="relative rounded-md border border-primary-400/60 bg-natural-900/60">
              <pre className="overflow-x-auto whitespace-pre-wrap break-words py-2 pl-3 pr-10 font-mono text-xs leading-5 text-natural-100">
                {step.code}
              </pre>
              <CopyButton
                value={step.code}
                label={`Copy: ${step.title}`}
                testId={`api-keys-usage-copy-step-${index + 1}`}
                className="absolute right-1 top-1 p-1.5"
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};
