import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMemoryLocalStorage } from "@/test-utils/memoryLocalStorage";
import { LOCAL_STORAGE_SKILLS } from "@/utilities/localStorage";
import type { SkillPublic } from "@/services/useGetSkills";
import { SkillsList } from "./SkillsList";

const catalog = vi.hoisted(() => ({
  skills: [] as SkillPublic[],
  isLoading: false,
  isError: false,
}));

vi.mock("@/services/useGetSkills", () => ({
  useGetSkills: () => ({
    data: { pages: [{ data: catalog.skills, meta: {} }] },
    isLoading: catalog.isLoading,
    isError: catalog.isError,
    isFetchingNextPage: false,
    fetchNextPage: () => undefined,
    hasNextPage: false,
  }),
}));

vi.mock("@/hooks/useInfinityLoading", () => ({
  default: () => [{ current: null }],
}));

const skill = (overrides: Partial<SkillPublic> = {}): SkillPublic => ({
  id: "skill-1",
  timestamp: "2026-11-03T00:00:00Z",
  name: "roll-dice",
  description: "Roll a die",
  enabled: true,
  requires_mcp_servers: ["eve_retrieval"],
  files: [
    { path: "SKILL.md", size: 128 },
    { path: "scripts/roll.py", size: 2048 },
  ],
  created_at: "2026-11-03T00:00:00Z",
  updated_at: "2026-11-03T00:00:00Z",
  deleted_at: null,
  ...overrides,
});

const render = () => renderToStaticMarkup(<SkillsList />);

beforeEach(() => {
  installMemoryLocalStorage();
  catalog.skills = [skill()];
  catalog.isLoading = false;
  catalog.isError = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Skills list", () => {
  it("shows the name and the description, not the files", () => {
    const html = render();

    expect(html).toContain('data-testid="skill-name"');
    expect(html).toContain("roll-dice");
    expect(html).toContain("Roll a die");
    expect(html).not.toContain("SKILL.md");
    expect(html).not.toContain("scripts/roll.py");
    expect(html).not.toContain("128 B");
    expect(html).not.toContain("eve_retrieval");
    expect(html).toContain('data-state="unchecked"');
  });

  it("checks the switch when the name is stored", () => {
    localStorage.setItem(LOCAL_STORAGE_SKILLS, JSON.stringify(["roll-dice"]));

    expect(render()).toContain('data-state="checked"');
  });

  it("stays unchecked when the stored list is empty", () => {
    localStorage.setItem(LOCAL_STORAGE_SKILLS, JSON.stringify([]));

    const html = render();

    expect(html).toContain('data-state="unchecked"');
    expect(html).not.toContain('data-state="checked"');
    expect(html).not.toContain('disabled=""');
  });

  it("greys a disabled skill and does not let the switch change", () => {
    catalog.skills = [skill({ enabled: false })];

    const html = render();

    expect(html).toContain('data-skill-enabled="false"');
    expect(html).toContain("opacity-50");
    expect(html).toContain('disabled=""');
    expect(html).toContain("roll-dice");
    expect(html).toContain("Roll a die");
    expect(html).not.toContain("SKILL.md");
  });

  it("says when the catalog is empty", () => {
    catalog.skills = [];

    expect(render()).toContain("No skills found");
  });

  it("says when the catalog cannot be loaded", () => {
    catalog.isError = true;

    expect(render()).toContain("Could not load the skills");
  });
});
