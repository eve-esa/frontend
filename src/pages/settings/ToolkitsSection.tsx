import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useGetMcpServers,
  type McpServerPublic,
  type ToolkitUserCredentials,
} from "@/services/useGetMcpServers";
import {
  toolkitCredentialErrorMessage,
  useDeleteToolkitCredentials,
  useSaveToolkitCredentials,
} from "@/services/useToolkitCredentials";
import { formatApiDate } from "@/utilities/dayjs";
import { SettingsPanel, SettingsSection } from "./SettingsSection";

type CredentialsServer = McpServerPublic & {
  user_credentials: ToolkitUserCredentials;
};

const hasCredentialForm = (server: McpServerPublic): server is CredentialsServer =>
  Boolean(server.user_credentials);

const statusText = ({ user_credentials: creds }: CredentialsServer): string => {
  if (!creds.configured) {
    return creds.required
      ? "Not set. Required to use this toolkit."
      : "Not set. EVE's shared access is used.";
  }
  const hints = creds.fields
    .filter((field) => creds.hints[field.name])
    .map((field) => `${field.label} ending in ${creds.hints[field.name]}`);
  const checked = formatApiDate(creds.verified_at);
  return [
    "Using your credentials",
    ...hints,
    ...(checked ? [`Checked ${checked}`] : []),
  ].join(". ");
};

type CredentialsFormProps = {
  server: CredentialsServer;
  onDone: () => void;
};

/**
 * Mounted only while the dialog is open, so the typed values and a previous error never outlive
 * it. The mutation hook drops the submitted variables as soon as nothing observes it.
 */
const CredentialsForm = ({ server, onDone }: CredentialsFormProps) => {
  const { fields, help_url: helpUrl } = server.user_credentials;
  const [values, setValues] = useState<Record<string, string>>({});
  const { mutate, isPending, isError, error } = useSaveToolkitCredentials();

  const complete = fields.every((field) => (values[field.name] ?? "") !== "");

  const finish = () => {
    setValues({});
    onDone();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!complete || isPending || !server.id) return;
    const payload = Object.fromEntries(
      fields.map((field) => [field.name, values[field.name]])
    );
    mutate({ serverId: server.id, values: payload }, { onSuccess: finish });
  };

  return (
    <form
      onSubmit={submit}
      autoComplete="off"
      data-testid="settings-toolkits-form"
      className="mt-2 flex flex-col gap-5"
    >
      {fields.map((field) => {
        const id = `settings-toolkits-field-${field.name}`;
        const helpId = `${id}-help`;
        return (
          <div key={field.name} className="flex flex-col gap-2">
            <label htmlFor={id} className="font-['NotesESA'] text-sm">
              {field.label}
            </label>
            <Input
              id={id}
              data-testid={id}
              data-private
              data-1p-ignore="true"
              data-lpignore="true"
              name={`eve-toolkit-${field.name}`}
              type={field.secret ? "password" : "text"}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={field.help_text ? helpId : undefined}
              value={values[field.name] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
              }
            />
            {field.help_text && (
              <p id={helpId} className="text-sm text-natural-200">
                {field.help_text}
              </p>
            )}
          </div>
        );
      })}

      {helpUrl && (
        <a
          href={helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="settings-toolkits-help-link"
          className="text-sm underline"
        >
          Where to get these
        </a>
      )}

      {isError && (
        <p
          role="alert"
          data-testid="settings-toolkits-error"
          className="text-sm text-danger-400"
        >
          {toolkitCredentialErrorMessage(error)}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="md"
          data-testid="settings-toolkits-cancel"
          onClick={finish}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="md"
          data-testid="settings-toolkits-save"
          disabled={isPending || !complete}
        >
          Save
        </Button>
      </div>
    </form>
  );
};

type RemoveDialogProps = {
  server: CredentialsServer | null;
  onOpenChange: (open: boolean) => void;
};

const RemoveCredentialsDialog = ({ server, onOpenChange }: RemoveDialogProps) => {
  const { mutate, isPending, isError, reset } = useDeleteToolkitCredentials();

  // Kept while the dialog closes, so the title does not blank during the exit animation.
  const [shown, setShown] = useState<CredentialsServer | null>(server);
  if (server !== null && server !== shown) setShown(server);

  return (
    <Dialog
      open={server !== null}
      onOpenChange={(open) => {
        if (!open) reset();
        onOpenChange(open);
      }}
    >
      <DialogContent data-testid="settings-toolkits-remove-dialog">
        <DialogHeader>
          <DialogTitle>Remove your credentials for {shown?.name}?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Your stored credentials are deleted. EVE's shared access is used
          instead, if this toolkit has one.
        </DialogDescription>
        {isError && (
          <p
            role="alert"
            data-testid="settings-toolkits-remove-error"
            className="text-sm text-danger-400"
          >
            Couldn't remove the credentials. Try again.
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="md"
            data-testid="settings-toolkits-remove-cancel"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="md"
            data-testid="settings-toolkits-remove-confirm"
            disabled={isPending || server === null || !server.id}
            onClick={() => {
              if (!server?.id) return;
              mutate(server.id, { onSuccess: () => onOpenChange(false) });
            }}
          >
            Remove
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Bring your own account for the toolkits that call an external service: one row per toolkit
 * that declares a credential form, with Add or Replace and Remove. The form lives in a dialog.
 */
export const ToolkitsSection = () => {
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useGetMcpServers();
  // The toolkit the dialog is for. Kept while the dialog closes, so the title and the form do
  // not change during the exit animation; formOpen says whether it shows.
  const [formTarget, setFormTarget] = useState<CredentialsServer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<CredentialsServer | null>(
    null
  );

  // The list pages by 20 and a toolkit with a form can sit on any page.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const servers = (data?.pages ?? [])
    .flatMap((page) => page.data)
    .filter(hasCredentialForm);

  return (
    <SettingsSection
      id="toolkits"
      title="Toolkits"
      lead="Use your own accounts with toolkits that call external services. Credentials are checked with the provider, stored encrypted and cannot be viewed again after saving."
    >
      <SettingsPanel>
        {isLoading ? (
          <Skeleton className="h-[120px] w-full" />
        ) : servers.length === 0 ? (
          <p
            data-testid="settings-toolkits-empty"
            className="text-sm text-natural-200"
          >
            No toolkit accepts your own credentials yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {servers.map((server) => (
              <li
                key={server.name}
                data-testid={`settings-toolkits-row-${server.name}`}
                className="flex items-start justify-between gap-3 rounded-md border border-primary-400/40 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{server.name}</p>
                  {server.provider && (
                    <p className="truncate text-sm text-natural-200">
                      {server.provider}
                    </p>
                  )}
                  <p
                    data-testid={`settings-toolkits-status-${server.name}`}
                    className="text-sm text-natural-200"
                  >
                    {statusText(server)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid={`settings-toolkits-add-${server.name}`}
                    aria-label={`${
                      server.user_credentials.configured ? "Replace" : "Add"
                    } credentials for ${server.name}`}
                    onClick={() => {
                      setFormTarget(server);
                      setFormOpen(true);
                    }}
                  >
                    {server.user_credentials.configured
                      ? "Replace"
                      : "Add credentials"}
                  </Button>
                  {server.user_credentials.configured && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid={`settings-toolkits-remove-${server.name}`}
                      aria-label={`Remove credentials for ${server.name}`}
                      onClick={() => setPendingRemove(server)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsPanel>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          data-testid="settings-toolkits-dialog"
          className="max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>
              {formTarget?.user_credentials.configured ? "Replace" : "Add"}{" "}
              credentials for {formTarget?.name}
            </DialogTitle>
            <DialogDescription>
              They are checked with the provider before they are saved.
            </DialogDescription>
          </DialogHeader>
          {formTarget && (
            <CredentialsForm
              server={formTarget}
              onDone={() => setFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <RemoveCredentialsDialog
        server={pendingRemove}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
      />
    </SettingsSection>
  );
};
