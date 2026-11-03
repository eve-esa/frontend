import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMemoryLocalStorage } from "@/test-utils/memoryLocalStorage";

vi.mock("@/services/useGetMcpServers", () => ({
  useGetMcpServers: () => ({
    data: undefined,
    isLoading: false,
    isError: true,
    isFetchingNextPage: false,
    fetchNextPage: () => undefined,
    hasNextPage: false,
  }),
}));

vi.mock("@/services/useGetSkills", () => ({
  useGetSkills: () => ({
    data: {
      pages: [
        {
          data: [
            {
              id: "skill-1",
              name: "roll-dice",
              description: "Roll a die",
              enabled: true,
              files: [{ path: "SKILL.md", size: 12 }],
            },
          ],
          meta: {},
        },
      ],
    },
    isLoading: false,
    isError: false,
    isFetchingNextPage: false,
    fetchNextPage: () => undefined,
    hasNextPage: false,
  }),
}));

vi.mock("@/hooks/useInfinityLoading", () => ({
  default: () => [{ current: null }],
}));

const render = async () => {
  const { SharedToolkits } = await import("./SharedToolkits");
  return renderToStaticMarkup(<SharedToolkits onToggle={() => undefined} />);
};

beforeEach(() => {
  installMemoryLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Shared toolkits panel", () => {
  it("starts with Tools and Skills closed", async () => {
    const html = await render();
    const tools = html.indexOf('data-testid="toolkits-tools"');
    const skills = html.indexOf('data-testid="toolkits-skills"');

    expect(tools).toBeGreaterThanOrEqual(0);
    expect(skills).toBeGreaterThan(tools);
    expect(html).toContain("border-primary-400");
    expect(html).toContain("w-full");
    expect(html).toContain("justify-start");
    expect(html).toContain("overflow-x-hidden");
    const toolsButton = html.slice(
      html.indexOf('data-testid="toolkits-tools"'),
      html.indexOf('data-testid="toolkits-skills"'),
    );
    expect(toolsButton.indexOf(">Tools<")).toBeLessThan(
      toolsButton.indexOf("<svg"),
    );
    expect(html).not.toContain("Could not load the toolkits");
    expect(html).not.toContain("roll-dice");
    expect(html).not.toContain("SKILL.md");
    expect(html).not.toContain('data-testid="toolkit-name"');
  });
});
