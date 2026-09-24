import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  recordException: vi.fn(),
}));

vi.mock("@/services/axios", () => ({ default: { post: mocks.post } }));
vi.mock("@/observability/telemetry", () => ({
  recordException: mocks.recordException,
}));

import { logError } from "./errorLogging";

const payload = {
  error_message: "boom",
  error_stack: "Error: boom\n at x",
  error_type: "TypeError",
  url: "https://app/x",
  user_agent: "ua",
  component: "ErrorBoundary",
  description: "desc",
  metadata: { a: 1 },
};

beforeEach(() => {
  mocks.post.mockReset();
  mocks.recordException.mockReset();
});

describe("logError", () => {
  it("still posts to /log-error and also records the exception", async () => {
    mocks.post.mockResolvedValue({});
    await logError(payload);

    expect(mocks.post).toHaveBeenCalledWith("/log-error", payload);
    expect(mocks.recordException).toHaveBeenCalledWith(
      { name: "TypeError", message: "boom", stack: "Error: boom\n at x" },
      {
        "eve.error.component": "ErrorBoundary",
        "eve.error.description": "desc",
        "url.full": "https://app/x",
        "user_agent.original": "ua",
        "eve.error.metadata": { a: 1 },
      },
    );
  });

  it("defaults the component to FRONTEND on both paths", async () => {
    mocks.post.mockResolvedValue({});
    await logError({ error_message: "m", error_type: "E" });
    expect(mocks.post.mock.calls[0][1].component).toBe("FRONTEND");
    expect(mocks.recordException.mock.calls[0][1]["eve.error.component"]).toBe(
      "FRONTEND",
    );
  });

  it("does not reject when the POST fails", async () => {
    mocks.post.mockRejectedValue(new Error("network"));
    await expect(logError(payload)).resolves.toBeUndefined();
    expect(mocks.recordException).toHaveBeenCalledTimes(1);
  });
});
