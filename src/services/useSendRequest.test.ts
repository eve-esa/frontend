import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMemoryLocalStorage } from "@/test-utils/memoryLocalStorage";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import type { ModelListResponse } from "@/types";
import {
  LOCAL_STORAGE_MCP_SERVERS,
  LOCAL_STORAGE_MODEL_SELECTION,
} from "@/utilities/localStorage";

// The pipeline is read from FEATURE_AGENTIC_CHAT at module scope, so these
// tests load useSendRequest after stubbing the runtime config and assert on the
// request that actually leaves: api.post for the blocking path, postStream for
// the streaming one. vitest runs in Node without a DOM, so the hook's React and
// TanStack calls are replaced and the mutation options are used directly.
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  postStream: vi.fn(),
}));

vi.mock("@/services/axios", () => ({ default: { post: mocks.post } }));
vi.mock("./streaming", () => ({
  postStream: mocks.postStream,
  consumeSuppressToastFlag: () => false,
  consumeWatchdogTimeoutFlag: () => false,
}));
vi.mock("./errorLogging", () => ({ logError: vi.fn() }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useRef: (initial: unknown) => ({ current: initial }),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => new actual.QueryClient(),
    useMutation: (options: unknown) => options,
  };
});

const MODELS: ModelListResponse = {
  platform: [
    { id: "eve-instruct", llm_type: "main", display_name: "EVE-Instruct" },
  ],
  providers: [],
  custom: [],
};

const SETTINGS = { score_threshold: 0.42, temperature: 0.3, k: 7 };

const load = (agenticChat: "true" | "false") => {
  stubRuntimeConfig({
    FEATURE_AGENTIC_CHAT: agenticChat,
    FEATURE_TOOLKITS: "true",
  });
  installMemoryLocalStorage();
  localStorage.setItem(
    LOCAL_STORAGE_MCP_SERVERS,
    JSON.stringify(["eve_retrieval", "weather"]),
  );
  localStorage.setItem(
    LOCAL_STORAGE_MODEL_SELECTION,
    JSON.stringify({ type: "platform", id: "eve-instruct" }),
  );
  return import("./useSendRequest");
};

type MutationOptions = {
  mutationFn: (props: Record<string, unknown>) => Promise<unknown>;
};

const streamOnce = async (agenticChat: "true" | "false") => {
  const { useSendRequest } = await load(agenticChat);
  mocks.postStream.mockImplementation(
    ({ onEvent }: { onEvent: (evt: unknown) => void }) => {
      onEvent({ type: "final", answer: "done" });
      return Promise.resolve();
    },
  );
  const options = useSendRequest("conv-1") as unknown as MutationOptions;
  await options.mutationFn({
    query: "hello",
    conversationId: "conv-1",
    settings: SETTINGS,
    models: MODELS,
  });
  return mocks.postStream.mock.calls[0][0] as {
    url: string;
    payload: Record<string, unknown>;
  };
};

beforeEach(() => {
  mocks.post.mockReset();
  mocks.postStream.mockReset();
  mocks.post.mockResolvedValue({
    data: {
      id: "m1",
      query: "hello",
      answer: "done",
      documents: [],
      use_rag: true,
      conversation_id: "conv-1",
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sendRequest with FEATURE_AGENTIC_CHAT=false", () => {
  it("posts to the classic messages route without public_mcp_servers", async () => {
    const { sendRequest } = await load("false");

    await sendRequest({
      query: "hello",
      conversationId: "conv-1",
      settings: SETTINGS,
      models: MODELS,
    });

    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [url, payload] = mocks.post.mock.calls[0];
    expect(url).toBe("/conversations/conv-1/messages");
    expect(payload).not.toHaveProperty("public_mcp_servers");
    expect(payload).toMatchObject({ query: "hello", llm_type: "main" });
  });

  it("streams from stream_messages without public_mcp_servers", async () => {
    const { url, payload } = await streamOnce("false");

    expect(url).toBe("/conversations/conv-1/stream_messages");
    expect(payload).not.toHaveProperty("public_mcp_servers");
  });
});

describe("sendRequest with FEATURE_AGENTIC_CHAT=true", () => {
  it("posts to generate-agentic with the selected MCP servers", async () => {
    const { sendRequest } = await load("true");

    await sendRequest({
      query: "hello",
      conversationId: "conv-1",
      settings: SETTINGS,
      models: MODELS,
    });

    const [url, payload] = mocks.post.mock.calls[0];
    expect(url).toBe("/conversations/conv-1/generate-agentic");
    expect(payload).toMatchObject({
      public_mcp_servers: ["eve_retrieval", "weather"],
    });
  });

  it("streams from stream-generate-agentic with the selected MCP servers", async () => {
    const { url, payload } = await streamOnce("true");

    expect(url).toBe("/conversations/conv-1/stream-generate-agentic");
    expect(payload).toMatchObject({
      public_mcp_servers: ["eve_retrieval", "weather"],
    });
  });
});
