import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCopy } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useClipboard } from "@/hooks/useClipboard";
import { ApiKeyUsageSnippet } from "./ApiKeyUsageSnippet";
import type { CreatedApiKey } from "@/types";

type ApiKeySecretRevealProps = {
  apiKey: CreatedApiKey;
  onDone: () => void;
};

/**
 * The only place the raw secret is ever rendered. `apiKey` comes from the
 * caller's own view state (set once, on the create mutation's onSuccess),
 * never re-read from `mutation.data`, so it disappears from the tree the
 * instant the caller navigates away from this view.
 */
export const ApiKeySecretReveal = ({ apiKey, onDone }: ApiKeySecretRevealProps) => {
  const { copyToClipboard, isCopied } = useClipboard();
  const [announceCopied, setAnnounceCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  const handleCopy = async () => {
    const copied = await copyToClipboard(apiKey.token);
    if (copied) {
      setAnnounceCopied(true);
      window.setTimeout(() => setAnnounceCopied(false), 1000);
    }
  };

  return (
    <div data-testid="api-key-secret-reveal" className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Save your API key</DialogTitle>
        <DialogDescription>
          Use it as a Bearer token in the Authorization header.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="api-key-secret"
          className="text-sm font-medium text-natural-100"
        >
          Your new API key
        </label>
        <Input
          id="api-key-secret"
          data-testid="api-key-secret"
          ref={inputRef}
          type="text"
          readOnly
          value={apiKey.token}
          aria-describedby="api-key-secret-warning"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          data-form-type="other"
          data-gramm="false"
          className="font-mono"
          endSlot={
            <Button
              type="button"
              variant="icon"
              data-testid="api-key-secret-copy"
              aria-label="Copy API key"
              onClick={() => void handleCopy()}
            >
              <FontAwesomeIcon
                icon={isCopied ? faCheck : faCopy}
                className="size-4"
              />
            </Button>
          }
        />
        <span className="sr-only" role="status" aria-live="polite">
          {announceCopied ? "Copied to clipboard" : ""}
        </span>
        <p
          id="api-key-secret-warning"
          data-testid="api-key-secret-warning"
          className="text-sm text-primary-300"
        >
          This is the only time the full key is shown. Copy it now and store it
          somewhere safe. If you lose it, delete it and create a new one.
        </p>
      </div>

      <details className="rounded-lg border border-primary-400/40" open>
        <summary className="cursor-pointer p-3 text-sm font-medium text-natural-100">
          Use your key
        </summary>
        <div className="px-3 pb-3">
          <ApiKeyUsageSnippet />
        </div>
      </details>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          data-testid="api-key-secret-done"
          onClick={onDone}
        >
          Done
        </Button>
      </div>
    </div>
  );
};
