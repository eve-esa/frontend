import { TOOLKITS_ENABLED } from "./features";
import { LOCAL_STORAGE_MCP_SERVERS } from "./localStorage";

// The knowledge base search. On until the user switches it off: without it the
// agent answers with no sources.
export const DEFAULT_MCP_SERVER_NAMES = ["eve_retrieval"];

// Toolkits whose required credentials are not set. Kept in memory, fed from the
// server list by the sidebar entry (utilities/toolkitCredentials). They are
// left out when a turn is sent, never removed from storage, so the choice
// returns once the credentials are saved.
let blockedNames = new Set<string>();

export function setBlockedMcpServerNames(names: string[]): void {
  blockedNames = new Set(names);
}

/** The user's stored choice, blocked toolkits included. What the switches edit. */
export function getStoredMcpServerNames(): string[] {
  // With toolkits hidden the user cannot choose, so the default applies. The
  // stored names are read past, not deleted, so flipping the flag back
  // restores the user's choice.
  if (!TOOLKITS_ENABLED) return [...DEFAULT_MCP_SERVER_NAMES];

  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_MCP_SERVERS);
    if (!stored) return [...DEFAULT_MCP_SERVER_NAMES];

    // A stored [] is a choice (everything switched off) and stays empty.
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((name): name is string => typeof name === "string")
      : [...DEFAULT_MCP_SERVER_NAMES];
  } catch {
    return [...DEFAULT_MCP_SERVER_NAMES];
  }
}

/** What a turn sends as `public_mcp_servers`: the stored choice without blocked toolkits. */
export function getSelectedMcpServerNames(): string[] {
  return getStoredMcpServerNames().filter((name) => !blockedNames.has(name));
}

export function toggleMcpServerSelection(
  currentNames: string[],
  serverName: string,
): string[] {
  const newNames = currentNames.includes(serverName)
    ? currentNames.filter((name) => name !== serverName)
    : [...currentNames, serverName];

  localStorage.setItem(LOCAL_STORAGE_MCP_SERVERS, JSON.stringify(newNames));
  return newNames;
}
