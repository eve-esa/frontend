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
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

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
  mocks.toastError.mockReset();
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

// The generation routes refuse with 429 overloaded past the per-worker
// in-flight cap. The streaming request reads the body as text, so the refusal
// carries the raw JSON string.
const overloaded = (retryAfter?: string) =>
  Object.assign(new Error("Request failed with status code 429"), {
    response: {
      status: 429,
      data: JSON.stringify({
        detail: {
          code: "overloaded",
          message: "The service is busy, retry in a few seconds",
        },
      }),
      headers: retryAfter ? { "retry-after": retryAfter } : {},
    },
  });

type BusyMutationOptions = MutationOptions & {
  onError: (error: unknown, variables: Record<string, unknown>) => void;
};

const VARIABLES = {
  query: "hello",
  conversationId: "conv-1",
  settings: SETTINGS,
  models: MODELS,
};

// Loads the hook with streaming on, then gives the stubbed window the location
// the error logging path reads.
const loadBusy = async () => {
  const hook = await load("false");
  const busy = await import("./serviceBusy");
  vi.stubGlobal("window", {
    __EVE_CONFIG__: { FEATURE_AGENTIC_CHAT: "false" },
    location: { href: "http://localhost/chat/conv-1" },
  });
  const options = hook.useSendRequest("conv-1") as unknown as BusyMutationOptions;
  return { options, busy };
};

describe("send refused by an overloaded backend", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("counts down from Retry-After and retries once", async () => {
    const { options, busy } = await loadBusy();
    mocks.postStream
      .mockRejectedValueOnce(overloaded("3"))
      .mockImplementationOnce(
        ({ onEvent }: { onEvent: (evt: unknown) => void }) => {
          onEvent({ type: "final", answer: "done" });
          return Promise.resolve();
        },
      );

    const run = options.mutationFn(VARIABLES);
    await vi.advanceTimersByTimeAsync(0);
    expect(busy.getBusyNotice()).toEqual({
      conversationId: "conv-1",
      phase: "waiting",
      secondsLeft: 3,
    });
    expect(mocks.postStream).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(busy.getBusyNotice()).toMatchObject({ secondsLeft: 2 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(busy.getBusyNotice()).toMatchObject({ secondsLeft: 1 });
    expect(mocks.postStream).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    await expect(run).resolves.toMatchObject({ output: "done" });
    expect(mocks.postStream).toHaveBeenCalledTimes(2);
    expect(busy.getBusyNotice()).toBeNull();
  });

  it("waits 10 s when Retry-After is missing", async () => {
    const { options, busy } = await loadBusy();
    mocks.postStream
      .mockRejectedValueOnce(overloaded())
      .mockResolvedValueOnce(undefined);

    const run = options.mutationFn(VARIABLES);
    await vi.advanceTimersByTimeAsync(0);
    expect(busy.getBusyNotice()).toMatchObject({ secondsLeft: 10 });
    await vi.advanceTimersByTimeAsync(9000);
    expect(mocks.postStream).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    await run;
    expect(mocks.postStream).toHaveBeenCalledTimes(2);
  });

  it("stops after a second refusal and hands the text back", async () => {
    const { options, busy } = await loadBusy();
    mocks.postStream
      .mockRejectedValueOnce(overloaded("1"))
      .mockRejectedValueOnce(overloaded("1"));

    const run = options.mutationFn(VARIABLES);
    const outcome = run.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(1000);
    const error = await outcome;

    expect(mocks.postStream).toHaveBeenCalledTimes(2);
    expect(busy.isServiceBusyError(error)).toBe(true);

    options.onError(error, VARIABLES);
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(busy.getBusyNotice()).toEqual({
      conversationId: "conv-1",
      phase: "stopped",
      draft: "hello",
    });
    // What the composer reads back into its text area.
    expect(busy.takeBusyDraft("conv-1")).toBe("hello");
    expect(busy.getBusyNotice()).toMatchObject({ phase: "stopped" });
  });

  it("returns the text without a notice when Stop is pressed mid countdown", async () => {
    const { options, busy } = await loadBusy();
    mocks.postStream.mockRejectedValueOnce(overloaded("5"));

    const run = options.mutationFn(VARIABLES);
    const outcome = run.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(1000);
    expect(busy.isBusyWaitActive()).toBe(true);
    busy.cancelBusyWait();
    const error = await outcome;

    expect(mocks.postStream).toHaveBeenCalledTimes(1);
    options.onError(error, VARIABLES);
    expect(busy.getBusyNotice()).toMatchObject({ phase: "canceled", draft: "hello" });
  });

  it("keeps today's token-budget 429 handling: no retry, no notice, credits toast", async () => {
    const { options, busy } = await loadBusy();
    const budget = Object.assign(new Error("Request failed with status code 429"), {
      response: {
        status: 429,
        data: JSON.stringify({ detail: "Token limit exceeded for this period" }),
        headers: { "retry-after": "3600" },
      },
    });
    mocks.postStream.mockRejectedValueOnce(budget);

    await expect(options.mutationFn(VARIABLES)).rejects.toBe(budget);
    expect(mocks.postStream).toHaveBeenCalledTimes(1);
    expect(busy.getBusyNotice()).toBeNull();

    options.onError(budget, VARIABLES);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "You've run out of free credits. Please recharge and try again.",
    );
    expect(busy.getBusyNotice()).toBeNull();
  });
});
