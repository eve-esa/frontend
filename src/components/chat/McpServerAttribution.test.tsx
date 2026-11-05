import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installMemoryLocalStorage } from "@/test-utils/memoryLocalStorage";
import type {
  McpServerAttribution,
  McpServerAuthor,
  McpServerPublic,
} from "@/services/useGetMcpServers";
import {
  McpAttributionButton,
  McpAttributionDetails,
} from "./McpServerAttribution";

vi.mock("@/hooks/useInfinityLoading", () => ({
  default: () => [{ current: null }],
}));

vi.mock("@/services/useGetMcpServer", () => ({
  useGetMcpServer: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
  }),
}));

const author = (overrides: Partial<McpServerAuthor> = {}): McpServerAuthor => ({
  name: "Antonio Lopez",
  given_names: "Antonio",
  family_names: "Lopez",
  alias: "Lopez-Antonio",
  github_url: "https://github.com/Lopez-Antonio",
  affiliation: "Pi School",
  orcid: null,
  website: null,
  ...overrides,
});

const attribution = (
  overrides: Partial<McpServerAttribution> = {},
): McpServerAttribution => ({
  title: "EFFIS Fire Detection MCP Server",
  abstract: "MCP server for European wildfire analysis.",
  authors: [author()],
  license: "Apache-2.0",
  repository_url:
    "https://github.com/eve-esa/mcp-tool-registry/tree/main/servers/effis",
  preferred_citation: null,
  ...overrides,
});

const hrefs = (html: string) =>
  [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);

const details = (
  value: McpServerAttribution,
  serverName = "effis",
) =>
  renderToStaticMarkup(
    <McpAttributionDetails attribution={value} serverName={serverName} />,
  );

describe("MCP attribution credits", () => {
  it("credits the author name, affiliation, and ORCID", () => {
    const html = details(
      attribution({
        authors: [
          author({
            website: "https://example.com/antonio",
            orcid: "https://orcid.org/0000-0001-2345-6789",
          }),
        ],
        license: null,
        repository_url: null,
      }),
    );

    expect(html).toContain("Antonio Lopez");
    expect(html).toContain("Pi School");
    expect(hrefs(html)).toContain("https://example.com/antonio");
    expect(hrefs(html)).not.toContain("https://github.com/Lopez-Antonio");
    expect(hrefs(html)).toContain("https://orcid.org/0000-0001-2345-6789");
    expect(html).toContain(">ORCID<");
  });

  it("uses github_url when website is unset, and never builds one from alias", () => {
    const linked = details(
      attribution({
        authors: [author({ website: null, affiliation: null })],
        license: null,
        repository_url: null,
      }),
    );
    expect(hrefs(linked)).toEqual(["https://github.com/Lopez-Antonio"]);

    const unlinked = details(
      attribution({
        authors: [
          author({
            website: null,
            github_url: null,
            affiliation: null,
          }),
        ],
        license: null,
        repository_url: null,
      }),
    );
    expect(hrefs(unlinked)).toEqual([]);
    expect(unlinked).toContain("Antonio Lopez");
    expect(unlinked).not.toContain("https://github.com/Lopez-Antonio");
    expect(unlinked).not.toContain("Lopez-Antonio");
  });

  it("credits an organization by name", () => {
    const html = details(
      attribution({
        authors: [
          author({
            name: "Pi School",
            given_names: null,
            family_names: null,
            affiliation: null,
            website: null,
            github_url: null,
          }),
        ],
        license: null,
        repository_url: null,
      }),
    );

    expect(html).toContain("Pi School");
    expect(hrefs(html)).toEqual([]);
  });

  it("puts many authors in a dropdown and shows only the selected author", () => {
    const html = details(
      attribution({
        authors: [
          author(),
          author({
            name: "Ada Lovelace",
            affiliation: "Analytical Engines",
            website: null,
            github_url: null,
            orcid: null,
          }),
        ],
        license: null,
        repository_url: null,
      }),
    );

    expect(html).toContain('data-slot="select-trigger"');
    expect(html).toContain('aria-label="Authors"');
    expect(html).toContain("Antonio Lopez");
    expect(html).toContain("Pi School");
    expect(html).not.toContain("Analytical Engines");
  });

  it("puts many preferred-citation authors in a dropdown", () => {
    const html = details(
      attribution({
        authors: [],
        license: null,
        repository_url: null,
        preferred_citation: {
          title: "Burnt area mapping",
          authors: ["Ada Lovelace", "Grace Hopper"],
          year: "2024",
          doi: null,
          url: null,
        },
      }),
    );

    expect(html).toContain('aria-label="Preferred citation authors"');
    expect(html).toContain("Ada Lovelace");
    expect(html).not.toContain("Grace Hopper");
  });

  it("hides an empty author list and still shows the title", () => {
    const html = details(
      attribution({
        authors: [],
        license: null,
        repository_url: null,
      }),
      "EFFIS Fire Detection MCP Server",
    );

    expect(html).toContain("EFFIS Fire Detection MCP Server");
    expect(html).not.toContain("<ul");
    expect(html).not.toContain("Antonio Lopez");
  });

  it("omits a title that repeats the server name when authors are present", () => {
    const html = details(
      attribution({
        title: "effis",
        authors: [author({ affiliation: null, website: null, github_url: null })],
        license: null,
        repository_url: null,
      }),
      "effis",
    );

    expect(html).toContain("Antonio Lopez");
    expect(html).not.toContain(">effis<");
  });

  it("shows a title that differs from the server name", () => {
    const html = details(
      attribution({
        license: null,
        repository_url: null,
        authors: [author({ affiliation: null, website: null, github_url: null })],
      }),
    );

    expect(html).toContain("EFFIS Fire Detection MCP Server");
    expect(html).toContain("Antonio Lopez");
  });

  it("shows the license and links the repository", () => {
    const html = details(attribution({ authors: [] }));

    expect(html).toContain("Apache-2.0");
    expect(hrefs(html)).toContain(
      "https://github.com/eve-esa/mcp-tool-registry/tree/main/servers/effis",
    );
    expect(html).toContain(">Repository<");
  });

  it("omits license and repository when they are unset", () => {
    const html = details(
      attribution({
        authors: [],
        license: null,
        repository_url: null,
      }),
    );

    expect(html).not.toContain("Apache-2.0");
    expect(html).not.toContain("Repository");
  });

  it("asks to cite the preferred work, linking the title to url", () => {
    const html = details(
      attribution({
        authors: [],
        license: null,
        repository_url: null,
        preferred_citation: {
          title: "Burnt area mapping",
          authors: ["Ada Lovelace"],
          year: "2024",
          doi: "10.1234/abcd",
          url: "https://doi.org/10.1234/abcd",
        },
      }),
    );

    expect(html).toContain("Cite this work");
    expect(html).toContain(">Authors<");
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain(">Year<");
    expect(html).toContain("2024");
    expect(html).toContain(">Title<");
    expect(html).toContain("Burnt area mapping");
    expect(html).toContain(">DOI<");
    expect(html).toContain("10.1234/abcd");
    expect(hrefs(html)).toContain("https://doi.org/10.1234/abcd");
    expect(hrefs(html)).not.toContain("10.1234/abcd");
  });

  it("shows the abstract as its own row", () => {
    const html = details(attribution());

    expect(html).toContain(">Abstract<");
    expect(html).toContain("MCP server for European wildfire analysis.");
  });

  it("omits the abstract when it is unset", () => {
    const html = details(
      attribution({
        abstract: null,
        authors: [],
        license: null,
        repository_url: null,
      }),
    );

    expect(html).not.toContain(">Abstract<");
    expect(html).not.toContain("MCP server for European wildfire analysis.");
  });
});

describe("MCP attribution button", () => {
  it("renders nothing when attribution is null", () => {
    const html = renderToStaticMarkup(
      <McpAttributionButton attribution={null} serverName="eve_retrieval" />,
    );

    expect(html).toBe("");
  });

  it("renders nothing when the citation has no visible credits", () => {
    const html = renderToStaticMarkup(
      <McpAttributionButton
        serverName="effis"
        attribution={attribution({
          title: "   ",
          abstract: null,
          authors: [],
          license: null,
          repository_url: null,
          preferred_citation: null,
        })}
      />,
    );

    expect(html).toBe("");
  });

  it("renders the info button when a citation is present", () => {
    const html = renderToStaticMarkup(
      <McpAttributionButton
        serverName="effis"
        attribution={attribution()}
      />,
    );

    expect(html).toContain('data-testid="mcp-attribution"');
    expect(html).toContain('data-slot="dialog-trigger"');
    expect(html).toContain('aria-label="Citation for effis"');
  });
});

const server = (
  name: string,
  value: McpServerAttribution | null,
): McpServerPublic => ({
  id: name,
  timestamp: "",
  name,
  provider: null,
  description: `${name} description`,
  type: "mcp",
  enabled: true,
  environment: null,
  config: { transport: "streamable_http", url: null },
  created_at: "",
  updated_at: "",
  deleted_at: null,
  attribution: value,
});

describe("toolkit row attribution", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it("puts the info button only on a server that has a citation", async () => {
    const { SharedToolkitsList } = await import("./SharedToolkitsList");
    const html = renderToStaticMarkup(
      <SharedToolkitsList
        isLoading={false}
        isFetchingNextPage={false}
        hasNextPage={false}
        fetchNextPage={() => undefined}
        serversList={[
          server("eve_retrieval", null),
          server("effis", attribution()),
        ]}
      />,
    );

    expect(html).toContain("eve_retrieval");
    expect(html).toContain("effis");
    expect(html).toContain("effis description");
    expect(html.match(/data-testid="mcp-attribution"/g)).toHaveLength(1);
    expect(html).not.toContain("Unable to load");
    expect(html).not.toContain("No citation");
  });
});
