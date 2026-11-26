// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  McpServerPublic,
  ToolkitUserCredentials,
} from "@/services/useGetMcpServers";

const flags = vi.hoisted(() => ({
  TOOLKIT_CREDENTIALS_ENABLED: true,
  SETTINGS_PAGE_ENABLED: true,
}));

vi.mock("@/utilities/features", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utilities/features")>()),
  get TOOLKIT_CREDENTIALS_ENABLED() {
    return flags.TOOLKIT_CREDENTIALS_ENABLED;
  },
  TOOLKITS_ENABLED: true,
  get SETTINGS_PAGE_ENABLED() {
    return flags.SETTINGS_PAGE_ENABLED;
  },
}));

vi.mock("@/hooks/useInfinityLoading", () => ({
  default: () => [{ current: null }],
}));

vi.mock("./McpServerTools", () => ({ McpServerTools: () => null }));

const creds = (
  overrides: Partial<ToolkitUserCredentials> = {}
): ToolkitUserCredentials => ({
  fields: [
    { name: "client_id", label: "Client ID", secret: false, help_text: null },
    { name: "client_secret", label: "Client secret", secret: true, help_text: null },
  ],
  required: false,
  help_url: null,
  configured: false,
  hints: {},
  verified_at: null,
  updated_at: null,
  ...overrides,
});

const server = (
  name: string,
  user_credentials?: ToolkitUserCredentials | null
): McpServerPublic => ({
  id: `id-${name}`,
  timestamp: "2026-11-20T00:00:00Z",
  name,
  provider: null,
  description: null,
  type: "global",
  enabled: true,
  environment: null,
  config: { transport: "streamable_http", url: null },
  created_at: "2026-11-20T00:00:00Z",
  updated_at: "2026-11-20T00:00:00Z",
  deleted_at: null,
  attribution: null,
  user_credentials,
});

const renderLink = async (s: McpServerPublic) => {
  const { ToolkitCredentialsLink } = await import("./ToolkitCredentialsLink");
  return render(
    <MemoryRouter>
      <ToolkitCredentialsLink server={s} />
    </MemoryRouter>
  );
};

beforeEach(() => {
  flags.TOOLKIT_CREDENTIALS_ENABLED = true;
  flags.SETTINGS_PAGE_ENABLED = true;
});

afterEach(cleanup);

describe("ToolkitCredentialsLink", () => {
  it("renders nothing when the credentials flag is off", async () => {
    flags.TOOLKIT_CREDENTIALS_ENABLED = false;
    const { container } = await renderLink(server("effis", creds()));
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when the settings page flag is off", async () => {
    flags.SETTINGS_PAGE_ENABLED = false;
    const { container } = await renderLink(server("effis", creds()));
    expect(container.innerHTML).toBe("");
  });

  it.each([undefined, null])(
    "renders nothing for a toolkit with user_credentials %s",
    async (value) => {
      const { container } = await renderLink(server("geocode", value));
      expect(container.innerHTML).toBe("");
    }
  );

  it("says Not set and offers Add credentials", async () => {
    await renderLink(server("effis", creds()));
    expect(screen.getByTestId("toolkit-credentials-status-effis").textContent).toBe("Not set.");
    expect(screen.getByTestId("toolkit-credentials-link-effis").textContent).toContain("Add credentials");
  });

  it("says when the credentials are required", async () => {
    await renderLink(server("effis", creds({ required: true })));
    expect(screen.getByTestId("toolkit-credentials-status-effis").textContent).toContain("Not set. Required to use this toolkit.");
    expect(screen.getByTestId("toolkit-credentials-link-effis").textContent).toContain("Add credentials");
  });

  it("says Using your credentials and offers Manage credentials", async () => {
    await renderLink(
      server(
        "effis",
        creds({ configured: true, hints: { client_id: "4f2a" } })
      )
    );
    const status = screen.getByTestId("toolkit-credentials-status-effis");
    expect(status.textContent).toContain("Using your credentials");
    expect(status.textContent).toContain("Client ID ending in 4f2a");
    expect(screen.getByTestId("toolkit-credentials-link-effis").textContent).toContain("Manage credentials");
  });

  it("links to the Toolkits section of Settings", async () => {
    await renderLink(server("effis", creds()));
    expect(screen.getByTestId("toolkit-credentials-link-effis").getAttribute("href")).toBe("/settings/toolkits");
  });
});

describe("SharedToolkitsList credentials line", () => {
  it("shows it under the toolkits that take credentials and nowhere else", async () => {
    const { SharedToolkitsList } = await import("./SharedToolkitsList");
    render(
      <MemoryRouter>
        <SharedToolkitsList
          isLoading={false}
          isFetchingNextPage={false}
          hasNextPage={false}
          fetchNextPage={() => undefined}
          serversList={[server("effis", creds()), server("geocode")]}
        />
      </MemoryRouter>
    );
    expect(screen.getAllByTestId("toolkit-item")).toHaveLength(2);
    expect(screen.getByTestId("toolkit-credentials-link-effis")).toBeTruthy();
    expect(screen.queryByTestId("toolkit-credentials-link-geocode")).toBeNull();
  });
});

describe("SharedToolkitsList switch when credentials are required", () => {
  const renderList = async (servers: McpServerPublic[]) => {
    const { SharedToolkitsList } = await import("./SharedToolkitsList");
    return render(
      <MemoryRouter>
        <SharedToolkitsList
          isLoading={false}
          isFetchingNextPage={false}
          hasNextPage={false}
          fetchNextPage={() => undefined}
          serversList={servers}
        />
      </MemoryRouter>
    );
  };

  it("disables the switch, shows it off and says why", async () => {
    localStorage.setItem("mcp_servers", JSON.stringify(["effis"]));
    await renderList([server("effis", creds({ required: true }))]);
    const toggle = screen.getByTestId("toolkit-switch-effis");
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    expect(toggle.getAttribute("aria-disabled")).toBe("true");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByTestId("toolkit-credentials-required-effis").textContent).toBe("Credentials required.");
    expect(screen.getByTestId("toolkit-credentials-link-effis").textContent).toContain("Add credentials");
  });

  it("keeps the stored choice in storage", async () => {
    localStorage.setItem("mcp_servers", JSON.stringify(["effis"]));
    await renderList([server("effis", creds({ required: true }))]);
    expect(JSON.parse(localStorage.getItem("mcp_servers") ?? "[]")).toEqual(["effis"]);
  });

  it.each([
    ["not required", creds({ required: false })],
    ["configured", creds({ required: true, configured: true })],
  ])("leaves the switch alone when %s", async (_label, c) => {
    localStorage.setItem("mcp_servers", JSON.stringify(["effis"]));
    await renderList([server("effis", c)]);
    const toggle = screen.getByTestId("toolkit-switch-effis");
    expect((toggle as HTMLButtonElement).disabled).toBe(false);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByTestId("toolkit-credentials-required-effis")).toBeNull();
  });

  it("puts a switch testid on a toolkit without credentials", async () => {
    await renderList([server("geocode")]);
    expect(screen.getByTestId("toolkit-switch-geocode")).toBeTruthy();
  });

  it("flag off: a required toolkit stays switchable", async () => {
    flags.TOOLKIT_CREDENTIALS_ENABLED = false;
    await renderList([server("effis", creds({ required: true }))]);
    expect((screen.getByTestId("toolkit-switch-effis") as HTMLButtonElement).disabled).toBe(false);
  });
});
