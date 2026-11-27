import { useEffect, useState, type FormEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
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
import { Tooltip } from "@/components/ui/Tooltip";
import {
  useGetMcpServers,
  type McpServerPublic,
  type ToolkitAccount,
  type ToolkitAccountCredential,
  type ToolkitUserCredentials,
} from "@/services/useGetMcpServers";
import {
  toolkitCredentialErrorMessage,
  useDeleteToolkitCredentials,
  useSaveToolkitCredentials,
} from "@/services/useToolkitCredentials";
import { toolkitCredentialsStatus } from "@/utilities/toolkitCredentials";
import { SettingsPanel, SettingsSection } from "./SettingsSection";

type CredentialsServer = McpServerPublic & {
  user_credentials: ToolkitUserCredentials;
};

const hasCredentialForm = (server: McpServerPublic): server is CredentialsServer =>
  Boolean(server.user_credentials);

// The payload only carries http(s) URLs. Anything else is treated as unset
// so a stray value cannot become an href.
const httpUrl = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed;
  }
  return null;
};

const listServices = (accounts: ToolkitAccount[]): ToolkitAccount[] =>
  accounts.flatMap((account) => [account, ...listServices(account.services)]);

const accountCredentials = (server: McpServerPublic) => {
  const byName = new Map<string, ToolkitAccountCredential>();
  for (const service of listServices(server.accounts ?? [])) {
    for (const credential of service.credentials) byName.set(credential.name, credential);
  }
  return byName;
};

type FieldHintProps = {
  label: string;
  name: string;
  help: string | null;
  url: string | null;
};

/** The help text in a tooltip. With a link, the icon opens the page where the value is issued. */
const FieldHint = ({ label, name, help, url }: FieldHintProps) => {
  if (!help && !url) return null;
  const icon = <FontAwesomeIcon icon={faCircleInfo} className="size-4 text-natural-200" />;
  return (
    <Tooltip
      content={
        <span className="flex flex-col gap-1">
          {help && <span>{help}</span>}
          {url && <span className="text-natural-200">Click to open where to get it.</span>}
        </span>
      }
      className="max-w-[280px] md:max-w-[350px]"
      disableClick
    >
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Where to get ${label}`}
          data-testid={`settings-toolkits-credential-link-${name}`}
          className="inline-flex"
        >
          {icon}
        </a>
      ) : (
        <span tabIndex={-1} aria-hidden className="inline-flex cursor-help">
          {icon}
        </span>
      )}
    </Tooltip>
  );
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
  const details = accountCredentials(server);
  const [values, setValues] = useState<Record<string, string>>({});
  const { mutate, isPending, isError, error } = useSaveToolkitCredentials();

  const complete = fields.every((field) => (values[field.name] ?? "") !== "");
  const services = listServices(server.accounts ?? []);
  const groups = services
    .map((service) => ({
      id: service.id,
      label: service.label,
      url: httpUrl(service.url),
      fields: fields.filter((field) =>
        service.credentials.some(
          (credential) => credential.via === "header" && credential.name === field.name
        )
      ),
      readOnly: service.credentials.filter(
        (credential) =>
          credential.via !== "header" || !fields.some((field) => field.name === credential.name)
      ),
    }))
    .filter((group) => group.fields.length > 0 || group.readOnly.length > 0);
  const grouped = new Set(groups.flatMap((group) => group.fields.map((field) => field.name)));
  const loose = fields.filter((field) => !grouped.has(field.name));
  const firstName = groups[0]?.fields[0]?.name ?? loose[0]?.name;

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

  const renderField = (field: (typeof fields)[number]) => {
    const id = `settings-toolkits-field-${field.name}`;
    const helpId = `${id}-help`;
    const detail = details.get(field.name);
    const help = field.help_text ?? detail?.help_text ?? null;
    const url = httpUrl(detail?.url) ?? httpUrl(helpUrl);
    return (
      <div key={field.name} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor={id} className="font-['NotesESA'] text-sm">
            {field.label}
          </label>
          <FieldHint label={field.label} name={field.name} help={help} url={url} />
        </div>
        <Input
          id={id}
          data-testid={id}
          autoFocus={field.name === firstName}
          data-private
          data-1p-ignore="true"
          data-lpignore="true"
          name={`eve-toolkit-${field.name}`}
          type={field.secret ? "password" : "text"}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={help ? helpId : undefined}
          value={values[field.name] ?? ""}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
          }
        />
        {help && (
          <span id={helpId} className="sr-only">
            {help}
          </span>
        )}
      </div>
    );
  };

  return (
    <form
      onSubmit={submit}
      autoComplete="off"
      data-testid="settings-toolkits-form"
      className="mt-2 flex flex-col gap-5"
    >
      {groups.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-natural-200">
            This toolkit uses {groups.length} {groups.length === 1 ? "service" : "services"}.
            Each service needs its own credentials.
          </p>
          {groups.map((group) => (
            <fieldset
              key={group.label}
              className="flex flex-col gap-4 rounded-md border border-primary-400/40 p-3"
            >
              <legend className="px-1 text-sm font-medium">
                {group.url ? (
                  <a
                    href={group.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`settings-toolkits-service-link-${group.id}`}
                    className="underline"
                  >
                    {group.label}
                  </a>
                ) : (
                  group.label
                )}
              </legend>
              {group.fields.map((field) => renderField(field))}
              {group.readOnly.map((credential) => (
                <div key={credential.name} className="flex items-center gap-2">
                  <p className="text-sm">{credential.label}</p>
                  <FieldHint
                    label={credential.label}
                    name={credential.name}
                    help={credential.help_text}
                    url={httpUrl(credential.url)}
                  />
                  <p className="text-sm text-natural-200">The server reads this key.</p>
                </div>
              ))}
            </fieldset>
          ))}
        </div>
      )}
      {loose.map((field) => renderField(field))}

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
          Your stored credentials are deleted.
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
                  <p
                    data-testid={`settings-toolkits-status-${server.name}`}
                    className="text-sm text-natural-200"
                  >
                    {toolkitCredentialsStatus(server.user_credentials)}
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
          className="max-h-[80vh] overflow-y-auto sm:max-w-2xl"
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
