// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  McpServerPublic,
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

const server = (
  name: string,
  user_credentials: ToolkitUserCredentials | null | undefined
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
    const link = screen.getByTestId("settings-toolkits-help-link") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://provider.example/keys");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
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
