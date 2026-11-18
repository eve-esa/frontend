import { useState, type ReactNode } from "react";
import {
  faArrowsRotate,
  faDownload,
  faFile,
  faFolder,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import api from "@/services/axios";
import {
  conversationFileUrl,
  errorStatus,
  useConversationFiles,
  useSandbox,
  useSandboxFiles,
} from "@/services/useSandbox";
import type { FileListing, Sandbox } from "@/types";
import { buildFileTree, type FileTreeNode } from "@/utilities/fileTree";
import { formatBytes } from "@/utilities/formatBytes";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

type SandboxExplorerProps = {
  onToggle: () => void;
  conversationId?: string;
};

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "in 8 minutes" or "3 minutes ago", against now. */
export const relativeTime = (iso: string, now: number = Date.now()): string => {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return RELATIVE.format(seconds, "second");
  if (abs < 3600) return RELATIVE.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return RELATIVE.format(Math.round(seconds / 3600), "hour");
  return RELATIVE.format(Math.round(seconds / 86400), "day");
};

const formatTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString() : "";

const STATUS_LABEL: Record<Sandbox["status"], string> = {
  disabled: "No sandbox provider",
  none: "No sandbox",
  idle: "Idle",
  busy: "Running a turn",
};

const STATUS_CLASS: Record<Sandbox["status"], string> = {
  disabled: "border-natural-200 text-natural-200",
  none: "border-natural-200 text-natural-200",
  idle: "border-primary-300 text-primary-300",
  busy: "border-success-200 text-success-200",
};

const download = async (url: string, filename: string) => {
  const { data } = await api.get<Blob>(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

const Section = ({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-2">
    <h3 className="text-xs text-primary-300">
      {title}
      {count !== undefined && ` (${count})`}
    </h3>
    {children}
  </section>
);

const Notice = ({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) => (
  <p
    className={cn(
      "text-sm",
      tone === "error" ? "text-danger-400" : "text-natural-200",
    )}
  >
    {children}
  </p>
);

const StatusCard = ({ sandbox }: { sandbox: Sandbox }) => {
  const rows: Array<[string, ReactNode]> = [];
  if (sandbox.provider) rows.push(["Provider", sandbox.provider]);
  if (sandbox.sandbox_id) {
    rows.push([
      "Sandbox id",
      <code className="break-all text-xs">{sandbox.sandbox_id}</code>,
    ]);
  }
  if (sandbox.status === "idle" || sandbox.status === "busy") {
    rows.push(["Turns in flight", String(sandbox.inflight)]);
  }
  if (sandbox.created_at) rows.push(["Created", formatTime(sandbox.created_at)]);
  if (sandbox.idle_deadline) {
    rows.push([
      "Stops when idle",
      `${formatTime(sandbox.idle_deadline)} (${relativeTime(sandbox.idle_deadline)})`,
    ]);
  }
  if (sandbox.expires_at) {
    rows.push([
      "Hard cap",
      `${formatTime(sandbox.expires_at)} (${relativeTime(sandbox.expires_at)})`,
    ]);
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary-400 p-3">
      <span
        data-testid="sandbox-status"
        className={cn(
          "self-start rounded-full border px-2 py-0.5 text-xs",
          STATUS_CLASS[sandbox.status],
        )}
      >
        {STATUS_LABEL[sandbox.status]}
      </span>
      {rows.length > 0 && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-natural-200">{label}</dt>
              <dd className="min-w-0 text-natural-50">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
};

const TreeRows = ({
  nodes,
  depth,
  onDownload,
}: {
  nodes: FileTreeNode[];
  depth: number;
  onDownload?: (path: string, name: string) => void;
}) => (
  <ul className="flex flex-col">
    {nodes.map((node) => (
      <li key={`${node.file ? "f" : "d"}:${node.path}`}>
        {node.file ? (
          <div
            className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-primary-800/40"
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
            title={node.file.modified_at ? formatTime(node.file.modified_at) : undefined}
          >
            <FontAwesomeIcon icon={faFile} className="size-3 flex-none text-natural-200" />
            <span className="min-w-0 flex-1 truncate text-natural-50">{node.name}</span>
            <span className="flex-none text-xs tabular-nums text-natural-200">
              {formatBytes(node.size)}
            </span>
            {onDownload && (
              <button
                type="button"
                aria-label={`Download ${node.path}`}
                onClick={() => onDownload(node.path, node.name)}
                className="flex-none cursor-pointer text-natural-200 outline-none hover:text-natural-50 focus-visible:ring-2 focus-visible:ring-primary-50"
              >
                <FontAwesomeIcon icon={faDownload} className="size-3" />
              </button>
            )}
          </div>
        ) : (
          <details open={depth === 0}>
            <summary
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-primary-800/40"
              style={{ paddingLeft: `${depth * 12 + 4}px` }}
            >
              <FontAwesomeIcon icon={faFolder} className="size-3 flex-none text-primary-300" />
              <span className="min-w-0 flex-1 truncate text-natural-50">{node.name}/</span>
              <span className="flex-none text-xs tabular-nums text-natural-200">
                {node.fileCount} · {formatBytes(node.size)}
              </span>
            </summary>
            <TreeRows nodes={node.children} depth={depth + 1} onDownload={onDownload} />
          </details>
        )}
      </li>
    ))}
  </ul>
);

const Listing = ({
  listing,
  onDownload,
  testId,
}: {
  listing: FileListing;
  onDownload?: (path: string, name: string) => void;
  testId: string;
}) => (
  <div data-testid={testId} className="flex flex-col gap-1">
    {listing.truncated && (
      <Notice>Showing the first {listing.items.length} files; there are more.</Notice>
    )}
    {listing.items.length === 0 ? (
      <Notice>No files.</Notice>
    ) : (
      <TreeRows nodes={buildFileTree(listing.items)} depth={0} onDownload={onDownload} />
    )}
  </div>
);

export const liveError = (error: unknown): string => {
  const status = errorStatus(error);
  if (status === 410) {
    return "The sandbox has ended. The saved files below are what remains.";
  }
  if (status === 404) return "No sandbox for this conversation.";
  return `Could not read the sandbox${status ? ` (${status})` : ""}.`;
};

/**
 * Debugging view of a conversation's sandbox (FEATURE_SANDBOX_EXPLORER): the pool record, the
 * files in the live session and the files saved for the conversation. Opening it does not keep
 * the sandbox alive: the backend reads without moving the idle deadline.
 */
export const SandboxExplorer = ({ onToggle, conversationId }: SandboxExplorerProps) => {
  const sandbox = useSandbox(conversationId);
  const hasLive = sandbox.data?.status === "idle" || sandbox.data?.status === "busy";
  const live = useSandboxFiles(conversationId, hasLive);
  const saved = useConversationFiles(conversationId);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const refreshing = sandbox.isFetching || live.isFetching || saved.isFetching;

  const refresh = () => {
    void sandbox.refetch();
    void saved.refetch();
    if (hasLive) void live.refetch();
  };

  const downloadSaved = (path: string, name: string) => {
    if (!conversationId) return;
    setDownloadError(null);
    download(conversationFileUrl(conversationId, path), name).catch(() =>
      setDownloadError(`Could not download ${path}.`),
    );
  };

  return (
    <div data-testid="sandbox-explorer" className="flex h-full flex-col gap-5 py-6">
      <div className="flex flex-none items-center justify-between gap-3 px-6">
        <h2 className="text-lg 3xl:text-3xl text-natural-50">Sandbox</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refresh}
            disabled={!conversationId || refreshing}
            aria-label="Refresh"
            className="cursor-pointer text-primary-50 outline-none transition-colors hover:text-natural-200 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary-50"
          >
            <FontAwesomeIcon
              icon={faArrowsRotate}
              className={cn("h-5", refreshing && "animate-spin")}
            />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Close"
            className="cursor-pointer text-primary-50 outline-none transition-colors hover:text-natural-200 focus-visible:ring-2 focus-visible:ring-primary-50"
          >
            <FontAwesomeIcon icon={faTimes} className="h-6" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6">
        {!conversationId ? (
          <Notice>Send a message first: a new chat has no sandbox yet.</Notice>
        ) : (
          <>
            <Section title="Status">
              {sandbox.isPending ? (
                <Spinner size="xs" />
              ) : sandbox.isError ? (
                <Notice tone="error">
                  Could not read the sandbox status
                  {errorStatus(sandbox.error) ? ` (${errorStatus(sandbox.error)})` : ""}.
                </Notice>
              ) : (
                <StatusCard sandbox={sandbox.data} />
              )}
            </Section>

            <Section title="Live sandbox" count={live.data?.items.length}>
              {!hasLive ? (
                <Notice>
                  {sandbox.data?.status === "disabled"
                    ? "This environment runs no sandbox."
                    : "No sandbox running for this conversation."}
                </Notice>
              ) : live.isPending ? (
                <Spinner size="xs" />
              ) : live.isError ? (
                <Notice tone={errorStatus(live.error) === 410 ? "muted" : "error"}>
                  {liveError(live.error)}
                </Notice>
              ) : (
                <Listing listing={live.data} testId="sandbox-live-files" />
              )}
            </Section>

            <Section title="Saved files" count={saved.data?.items.length}>
              {saved.isPending ? (
                <Spinner size="xs" />
              ) : saved.isError ? (
                <Notice tone="error">
                  Could not list the saved files
                  {errorStatus(saved.error) ? ` (${errorStatus(saved.error)})` : ""}.
                </Notice>
              ) : (
                <Listing
                  listing={saved.data}
                  onDownload={downloadSaved}
                  testId="sandbox-saved-files"
                />
              )}
              {downloadError && <Notice tone="error">{downloadError}</Notice>}
            </Section>
          </>
        )}
      </div>
    </div>
  );
};
