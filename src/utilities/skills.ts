import { LOCAL_STORAGE_SKILLS } from "./localStorage";

// Names the user switched on in the Skills section. A missing key stays
// empty. A stored [] stays empty. Unlike MCP servers, there is no default
// name, and this key is not `mcp_servers`.
export function getSelectedSkillNames(): string[] {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_SKILLS);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((name): name is string => typeof name === "string")
      : [];
  } catch {
    return [];
  }
}

export function toggleSkillSelection(
  currentNames: string[],
  skillName: string,
): string[] {
  const newNames = currentNames.includes(skillName)
    ? currentNames.filter((name) => name !== skillName)
    : [...currentNames, skillName];

  localStorage.setItem(LOCAL_STORAGE_SKILLS, JSON.stringify(newNames));
  return newNames;
}
