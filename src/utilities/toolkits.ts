import type {
  McpServerPublic,
  McpServersResponse,
} from "@/services/useGetMcpServers";

/**
 * Enabled toolkits across every page loaded so far.
 *
 * Both the sidebar entry and the panel behind it derive their idea of "empty"
 * from this one function on purpose: if they computed it separately they could
 * disagree, and the visible symptom would be a menu entry that opens onto
 * "No shared toolkits found".
 */
export const enabledToolkits = (
  pages: McpServersResponse[] | undefined
): McpServerPublic[] =>
  pages?.flatMap((page) => page.data).filter((server) => server.enabled) ?? [];

type ToolkitsEntryState = {
  isPending: boolean;
  isError: boolean;
  enabledCount: number;
};

/**
 * Whether the Toolkits entry belongs in the sidebar.
 *
 * The catalog is per environment: production deliberately has no agentic
 * configuration and no registered MCP server, so an entry there would open onto
 * an empty panel for every pilot user. The frontend release artifact is promoted
 * unchanged from dev to staging to production, so this cannot be a build-time
 * flag; it has to be decided at runtime from what the API actually returns.
 *
 * The three states are deliberately not collapsed into `enabledCount > 0`:
 *
 * - pending: hidden. Showing first and hiding a moment later would make the
 *   sidebar flicker on every page load in exactly the environment where the
 *   catalog is empty.
 * - error: SHOWN. A failed request is not an empty catalog, and hiding the
 *   entry would turn a broken API into a feature that silently does not exist.
 *   The panel says which of the two it is.
 * - settled: shown only when at least one enabled toolkit came back.
 */
export const shouldShowToolkitsEntry = ({
  isPending,
  isError,
  enabledCount,
}: ToolkitsEntryState): boolean => {
  if (isError) return true;
  if (isPending) return false;
  return enabledCount > 0;
};
