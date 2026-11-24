// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolActivityEntry } from "@/types";
import api from "@/services/axios";
import { offloadedFilePath } from "@/utilities/agentSteps";
import { AgentSteps } from "./AgentSteps";

vi.mock("@/services/axios", () => ({ default: { get: vi.fn() } }));

/** The stub deepagents leaves in the thread when a result is over the token limit. */
const STUB = [
  "Tool result too large, the result of this tool call call_42 was saved in the filesystem at this path: /large_tool_results/call_42",
  "You can read the result from the filesystem by using the read_file tool.",
  "",
  "Here is a preview showing the head and tail of the result:",
  '{"events": [{"name": "Flood"',
].join("\n");

const offloaded: ToolActivityEntry = {
  label: "Calling tool",
  state: "done",
  id: "call_42",
  tool: "gdacs_search_gdacs_events",
  args: { country: "Italy" },
  preview: STUB,
};

const renderSteps = (conversationId: string | null) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AgentSteps activity={[offloaded]} live={false} answerStarted conversationId={conversationId} />
    </QueryClientProvider>,
  );

const openFull = () => {
  fireEvent.click(screen.getByTestId("agent-steps-toggle"));
  fireEvent.click(screen.getByTestId("agent-step-toggle"));
  fireEvent.click(screen.getByTestId("agent-step-open-full"));
};

afterEach(() => {
  cleanup();
  vi.mocked(api.get).mockReset();
});

describe("offloadedFilePath", () => {
  it("reads the saved file path from the stub", () => {
    expect(offloadedFilePath(STUB)).toBe("large_tool_results/call_42");
  });

  it("is null for ordinary output", () => {
    expect(offloadedFilePath('{"events": []}')).toBeNull();
    expect(offloadedFilePath(null)).toBeNull();
  });
});

describe("Open full result", () => {
  it("shows the saved file, not the stub", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: '{"events":[{"name":"Flood"},{"name":"Fire"}]}' });
    renderSteps("conv1");
    openFull();
    expect(screen.getByTestId("agent-step-full-loading")).toBeTruthy();
    const full = await screen.findByTestId("agent-step-full");
    expect(api.get).toHaveBeenCalledWith("/conversations/conv1/files/large_tool_results/call_42", {
      responseType: "text",
    });
    expect(full.textContent).toContain('"name": "Fire"');
    expect(full.textContent).not.toContain("Tool result too large");
  });

  it("keeps the stub and says so when the file cannot be read", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("404"));
    renderSteps("conv1");
    openFull();
    await waitFor(() => expect(screen.getByTestId("agent-step-full-unavailable").textContent).toMatch(/could not be loaded/));
    expect(screen.getByTestId("agent-step-full").textContent).toContain("Tool result too large");
  });

  it("does not call the API without a conversation", () => {
    renderSteps(null);
    openFull();
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.getByTestId("agent-step-full-unavailable").textContent).toMatch(/not available/);
  });
});
