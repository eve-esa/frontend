import { LOCAL_STORAGE_MCP_SERVERS } from "./localStorage";

export function getSelectedMcpServerNames(): string[] {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_MCP_SERVERS);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((name): name is string => typeof name === "string")
      : [];
  } catch {
    return [];
  }
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
