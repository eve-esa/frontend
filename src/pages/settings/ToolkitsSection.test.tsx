// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  McpServerPublic,
  ToolkitAccount,
  ToolkitUserCredentials,
} from "@/services/useGetMcpServers";
import { ToolkitsSection } from "./ToolkitsSection";

const creds = (
  overrides: Partial<ToolkitUserCredentials> = {}
): ToolkitUserCredentials => ({
  fields: [
    { name: "username", label: "Username", secret: false, help_text: "Your account name" },
    { name: "api_key", label: "API key", secret: true, help_text: null },
  ],
  required: false,
  help_url: "https://provider.example/keys",
  configured: false,
  hints: {},
  verified_at: null,
  updated_at: null,
  ...overrides,
});

const account = (via: "header" | "variable"): ToolkitAccount => ({
  id: "cdse",
  label: "Copernicus Data Space",
  provider: "Sentinel Hub",
  url: "https://dataspace.copernicus.eu/",
  tools: ["compute_metrics"],
  credentials: [
    {
      name: "client_id",
      label: "Copernicus client ID",
      secret: false,
      help_text: "OAuth client id from the Sentinel Hub dashboard.",
      url: "https://shapps.dataspace.copernicus.eu/dashboard/#/account/settings",
      via,
    },
  ],
  services: [],
});

const server = (
  name: string,
  user_credentials: ToolkitUserCredentials | null | undefined,
  accounts: ToolkitAccount[] | null = null
): McpServerPublic => ({
  id: `id-${name}`,
  timestamp: "2026-11-20T00:00:00Z",
  name,
  provider: `${name} provider`,
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
  accounts,
});

let servers: McpServerPublic[];
let saveState: { isPending: boolean; isError: boolean; error: unknown };
const saveMutate = vi.fn();
const deleteMutate = vi.fn();

vi.mock("@/services/useGetMcpServers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/useGetMcpServers")>()),
  useGetMcpServers: () => ({
    data: { pages: [{ data: servers }] },
    isLoading: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}));
vi.mock("@/services/useToolkitCredentials", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/useToolkitCredentials")>()),
  useSaveToolkitCredentials: () => ({ mutate: saveMutate, ...saveState }),
  useDeleteToolkitCredentials: () => ({
    mutate: deleteMutate,
    isPending: false,
    isError: false,
    reset: vi.fn(),
  }),
}));

const type = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });

beforeEach(() => {
  saveMutate.mockClear();
  deleteMutate.mockClear();
  saveState = { isPending: false, isError: false, error: null };
  servers = [
    server("alpha", creds()),
    server("beta", creds({ required: true })),
    server(
      "gamma",
      creds({
        configured: true,
        hints: { api_key: "9f2c" },
        verified_at: "2026-11-03T10:00:00Z",
      })
    ),
    server("plain", null),
    server("legacy", undefined),
  ];
});
afterEach(cleanup);

describe("ToolkitsSection", () => {
  it("lists only toolkits that declare a credential form", () => {
    render(<ToolkitsSection />);
    expect(screen.getByTestId("settings-toolkits-row-alpha")).toBeTruthy();
    expect(screen.getByTestId("settings-toolkits-row-beta")).toBeTruthy();
    expect(screen.getByTestId("settings-toolkits-row-gamma")).toBeTruthy();
    expect(screen.queryByTestId("settings-toolkits-row-plain")).toBeNull();
    expect(screen.queryByTestId("settings-toolkits-row-legacy")).toBeNull();
  });

  it("shows the empty state when none does", () => {
    servers = [server("plain", null)];
    render(<ToolkitsSection />);
    expect(screen.getByTestId("settings-toolkits-empty").textContent).toBe(
      "No toolkit accepts your own credentials yet."
    );
  });

  it("states what a toolkit uses and what its buttons are", () => {
    render(<ToolkitsSection />);
    expect(screen.getByTestId("settings-toolkits-status-alpha").textContent).toBe(
      "Not set."
    );
    expect(screen.getByTestId("settings-toolkits-status-beta").textContent).toBe(
      "Not set. Required to use this toolkit."
    );
    const gamma = screen.getByTestId("settings-toolkits-status-gamma").textContent;
    expect(gamma).toContain("Using your credentials");
    expect(gamma).toContain("API key ending in 9f2c");
    expect(gamma).toContain("Checked 3 November 2026");
    expect(screen.getByTestId("settings-toolkits-add-alpha").textContent).toBe("Add credentials");
    expect(screen.getByTestId("settings-toolkits-add-gamma").textContent).toBe("Replace");
    expect(screen.queryByTestId("settings-toolkits-remove-alpha")).toBeNull();
    expect(screen.getByTestId("settings-toolkits-remove-gamma")).toBeTruthy();
  });

  it("renders secret fields as password inputs, masked for replay, with help and link", () => {
    render(<ToolkitsSection />);
    fireEvent.click(screen.getByTestId("settings-toolkits-add-alpha"));
    const key = screen.getByTestId("settings-toolkits-field-api_key") as HTMLInputElement;
    const user = screen.getByTestId("settings-toolkits-field-username") as HTMLInputElement;
    expect(key.type).toBe("password");
    expect(user.type).toBe("text");
    for (const input of [key, user]) {
      expect(input.getAttribute("autocomplete")).toBe("off");
      expect(input.getAttribute("spellcheck")).toBe("false");
      expect(input.hasAttribute("data-private")).toBe(true);
    }
    expect(screen.getByText("Your account name")).toBeTruthy();
    expect(screen.queryByText("Where to get these")).toBeNull();
    for (const name of ["username", "api_key"]) {
      const link = screen.getByTestId(
        `settings-toolkits-credential-link-${name}`
      ) as HTMLAnchorElement;
      expect(link.getAttribute("href")).toBe("https://provider.example/keys");
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("shows only the name and status, and links each field to its page", () => {
    servers = [
      server(
        "effis",
        creds({
          help_url: null,
          fields: [
            { name: "client_id", label: "Copernicus client ID", secret: false, help_text: null },
          ],
        }),
        [account("header")]
      ),
      server("cdse", null, [account("variable")]),
    ];
    render(<ToolkitsSection />);
    const row = screen.getByTestId("settings-toolkits-row-effis").textContent;
    expect(row).not.toContain("effis provider");
    expect(row).not.toContain("Copernicus Data Space");
    expect(screen.queryByTestId("settings-toolkits-row-cdse")).toBeNull();
    expect(screen.getByTestId("settings-toolkits-add-effis").textContent).toBe(
      "Add credentials"
    );
    fireEvent.click(screen.getByTestId("settings-toolkits-add-effis"));
    expect(
      screen.getByTestId("settings-toolkits-credential-link-client_id").getAttribute("href")
    ).toBe("https://shapps.dataspace.copernicus.eu/dashboard/#/account/settings");
    expect(screen.getByText("OAuth client id from the Sentinel Hub dashboard.")).toBeTruthy();
    expect(
      screen.getByTestId("settings-toolkits-credential-link-client_id").getAttribute("aria-label")
    ).toBe("Where to get Copernicus client ID");
  });

  it("does not turn a non-http field url into a link", () => {
    const bad = account("header");
    bad.credentials[0].url = "javascript:alert(1)";
    servers = [
      server(
        "effis",
        creds({
          help_url: null,
          fields: [
            { name: "client_id", label: "Copernicus client ID", secret: false, help_text: null },
          ],
        }),
        [bad]
      ),
    ];
    render(<ToolkitsSection />);
    fireEvent.click(screen.getByTestId("settings-toolkits-add-effis"));
    expect(screen.queryByTestId("settings-toolkits-credential-link-client_id")).toBeNull();
  });

  it("keeps Save disabled until every field is filled, then sends exactly the values", () => {
    render(<ToolkitsSection />);
    fireEvent.click(screen.getByTestId("settings-toolkits-add-alpha"));
    const save = screen.getByTestId("settings-toolkits-save") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    type("settings-toolkits-field-username", "ada");
    expect(save.disabled).toBe(true);
    type("settings-toolkits-field-api_key", "s3cret");
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(saveMutate).toHaveBeenCalledTimes(1);
    expect(saveMutate.mock.calls[0][0]).toEqual({
      serverId: "id-alpha",
      values: { username: "ada", api_key: "s3cret" },
    });
  });

  it("disables Save while the request is pending", () => {
    saveState = { isPending: true, isError: false, error: null };
    render(<ToolkitsSection />);
    fireEvent.click(screen.getByTestId("settings-toolkits-add-alpha"));
    type("settings-toolkits-field-username", "ada");
    type("settings-toolkits-field-api_key", "s3cret");
    expect((screen.getByTestId("settings-toolkits-save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the mapped error in an alert and never the typed values", () => {
    saveState = { isPending: false, isError: true, error: new Error("boom s3cret") };
    render(<ToolkitsSection />);
    fireEvent.click(screen.getByTestId("settings-toolkits-add-alpha"));
    type("settings-toolkits-field-api_key", "s3cret");
    const alert = screen.getByTestId("settings-toolkits-error");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.textContent).toBe("Couldn't save the credentials. Try again.");
    expect(alert.textContent).not.toContain("s3cret");
  });

  it("starts empty after the dialog is closed and opened again", () => {
    render(<ToolkitsSection />);
    fireEvent.click(screen.getByTestId("settings-toolkits-add-alpha"));
    type("settings-toolkits-field-username", "ada");
    type("settings-toolkits-field-api_key", "s3cret");
    fireEvent.click(screen.getByTestId("settings-toolkits-cancel"));
    expect(screen.queryByTestId("settings-toolkits-dialog")).toBeNull();
    fireEvent.click(screen.getByTestId("settings-toolkits-add-alpha"));
    expect((screen.getByTestId("settings-toolkits-field-username") as HTMLInputElement).value).toBe("");
    expect((screen.getByTestId("settings-toolkits-field-api_key") as HTMLInputElement).value).toBe("");
  });

  it("groups the form under each service", () => {
    const weather = account("header");
    weather.id = "weather";
    weather.label = "Weather Desk";
    weather.credentials[0].name = "weather_key";
    weather.credentials[0].label = "Weather key";
    const maps = account("header");
    maps.id = "maps";
    maps.label = "Map Desk";
    maps.credentials[0].name = "maps_token";
    maps.credentials[0].label = "Maps token";
    servers = [
      server(
        "dummy",
        creds({
          help_url: null,
          fields: [
            { name: "weather_key", label: "Weather key", secret: true, help_text: null },
            { name: "maps_token", label: "Maps token", secret: true, help_text: null },
          ],
        }),
        [weather, maps]
      ),
    ];
    render(<ToolkitsSection />);
    expect(screen.getByTestId("settings-toolkits-row-dummy").textContent).not.toContain(
      "Weather Desk"
    );
    fireEvent.click(screen.getByTestId("settings-toolkits-add-dummy"));
    const form = screen.getByTestId("settings-toolkits-form");
    expect(form.textContent).toContain("This toolkit uses 2 services.");
    const legends = [...form.querySelectorAll("legend")].map((node) => node.textContent);
    expect(legends).toEqual(["Weather Desk", "Map Desk"]);
    const weatherLink = screen.getByTestId(
      "settings-toolkits-service-link-weather"
    ) as HTMLAnchorElement;
    expect(weatherLink.getAttribute("href")).toBe("https://dataspace.copernicus.eu/");
    expect(weatherLink.getAttribute("target")).toBe("_blank");
  });

  it("Remove asks first, names the toolkit, and deletes only on confirm", () => {
    render(<ToolkitsSection />);
    fireEvent.click(screen.getByTestId("settings-toolkits-remove-gamma"));
    expect(deleteMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId("settings-toolkits-remove-dialog").textContent).toContain(
      "Remove your credentials for gamma?"
    );
    fireEvent.click(screen.getByTestId("settings-toolkits-remove-confirm"));
    expect(deleteMutate).toHaveBeenCalledWith("id-gamma", expect.anything());
  });
});
