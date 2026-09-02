import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMemoryLocalStorage } from "@/test-utils/memoryLocalStorage";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import type { AdvancedSettingsValidation } from "@/utilities/advancedSettingsSchema";
import type { ModelListResponse } from "@/types";
import { resolveMessageEndpoint } from "@/utilities/messageEndpoint";
import {
  LOCAL_STORAGE_MCP_SERVERS,
  LOCAL_STORAGE_MODEL_SELECTION,
  LOCAL_STORAGE_PRIVATE_COLLECTIONS,
  LOCAL_STORAGE_PUBLIC_COLLECTIONS,
  LOCAL_STORAGE_SETTINGS,
} from "@/utilities/localStorage";

const MODELS: ModelListResponse = {
  platform: [
    { id: "eve-instruct", llm_type: "main", display_name: "EVE-Instruct" },
  ],
  providers: [],
  custom: [],
};

const SETTINGS: AdvancedSettingsValidation = {
  score_threshold: 0.42,
  temperature: 0.3,
  k: 7,
};

const seed = (key: string, value: unknown) =>
  localStorage.setItem(key, JSON.stringify(value));

// What these suites describe is the request an enabled toolkit selection and an
// enabled private collection produce, so both flags are on for every case here.
// The flags themselves are covered in utilities/runtimeConfig.test.
let buildGenerationPayload: typeof import("./agenticMessage").buildGenerationPayload;
let getSelectedMcpServerNames: typeof import("@/utilities/mcpServers").getSelectedMcpServerNames;

// Mirrors useSendRequest: settings come from the caller (read from storage),
// the MCP selection picks the endpoint, collections are read by the builder.
const buildRequest = (conversationId: string) => {
  const settings = JSON.parse(
    localStorage.getItem(LOCAL_STORAGE_SETTINGS) as string,
  ) as AdvancedSettingsValidation;
  const mcpServers = getSelectedMcpServerNames();
  const { url, extraPayload } = resolveMessageEndpoint(
    conversationId,
    mcpServers,
    "stream",
  );
  return {
    url,
    payload: {
      ...buildGenerationPayload({ query: "hello", settings, models: MODELS }),
      ...extraPayload,
    },
  };
};

beforeEach(async () => {
  stubRuntimeConfig({
    FEATURE_TOOLKITS: "true",
    FEATURE_PRIVATE_COLLECTIONS: "true",
  });
  ({ buildGenerationPayload } = await import("./agenticMessage"));
  ({ getSelectedMcpServerNames } = await import("@/utilities/mcpServers"));

  installMemoryLocalStorage();
  seed(LOCAL_STORAGE_SETTINGS, SETTINGS);
  seed(LOCAL_STORAGE_MODEL_SELECTION, { type: "platform", id: "eve-instruct" });
  seed(LOCAL_STORAGE_PUBLIC_COLLECTIONS, ["wikipedia-512", "EVE open access"]);
  seed(LOCAL_STORAGE_PRIVATE_COLLECTIONS, ["my-private"]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("classic request (no MCP servers)", () => {
  it("hits stream_messages with exactly the enabled collections", () => {
    expect(buildRequest("conv-1")).toEqual({
      url: "/conversations/conv-1/stream_messages",
      payload: {
        query: "hello",
        score_threshold: 0.42,
        temperature: 0.3,
        k: 7,
        llm_type: "main",
        public_collections: ["wikipedia-512", "EVE open access"],
        private_collections: ["my-private"],
      },
    });
  });

  it("omits public_mcp_servers when the MCP key is absent", () => {
    expect(buildRequest("conv-1").payload).not.toHaveProperty(
      "public_mcp_servers",
    );
  });

  it("omits public_mcp_servers when the MCP selection is empty", () => {
    seed(LOCAL_STORAGE_MCP_SERVERS, []);

    const { url, payload } = buildRequest("conv-1");

    expect(url).toBe("/conversations/conv-1/stream_messages");
    expect(payload).not.toHaveProperty("public_mcp_servers");
  });
});

describe("agentic request (MCP servers selected)", () => {
  it("hits stream-generate-agentic and attaches public_mcp_servers", () => {
    seed(LOCAL_STORAGE_MCP_SERVERS, ["weather"]);

    expect(buildRequest("conv-2")).toEqual({
      url: "/conversations/conv-2/stream-generate-agentic",
      payload: {
        query: "hello",
        score_threshold: 0.42,
        temperature: 0.3,
        k: 7,
        llm_type: "main",
        public_collections: ["wikipedia-512", "EVE open access"],
        private_collections: ["my-private"],
        public_mcp_servers: ["weather"],
      },
    });
  });
});

describe("collection selection in the payload", () => {
  it("leaves disabled collection ids out", () => {
    seed(LOCAL_STORAGE_PUBLIC_COLLECTIONS, ["wikipedia-512"]);

    expect(buildRequest("conv-1").payload.public_collections).toEqual([
      "wikipedia-512",
    ]);
  });

  it("sends public_collections: [] when everything is disabled", () => {
    seed(LOCAL_STORAGE_PUBLIC_COLLECTIONS, []);
    seed(LOCAL_STORAGE_PRIVATE_COLLECTIONS, []);

    const { payload } = buildRequest("conv-1");

    expect(payload).toHaveProperty("public_collections", []);
    expect(payload).toHaveProperty("private_collections", []);
  });

  it("sends public_collections: [] when the key is missing", () => {
    localStorage.removeItem(LOCAL_STORAGE_PUBLIC_COLLECTIONS);

    expect(buildRequest("conv-1").payload).toHaveProperty(
      "public_collections",
      [],
    );
  });
});

describe("settings pass-through", () => {
  it("forwards k and score_threshold untouched", () => {
    seed(LOCAL_STORAGE_SETTINGS, { ...SETTINGS, k: 12, score_threshold: 0.9 });

    const { payload } = buildRequest("conv-1");

    expect(payload.k).toBe(12);
    expect(payload.score_threshold).toBe(0.9);
  });
});

describe("classification filters with the flag off", () => {
  const PERSPECTIVES = {
    thematic_perspective: { label: "Climate", value: "climate" },
    scientific_and_technical: { label: "Sensors", value: "sensors" },
    market_perspective: { label: "Agriculture", value: "agriculture" },
  };

  let adaptSettingsForRequest: typeof import("@/utilities/helpers").adaptSettingsForRequest;
  let readStoredSettings: typeof import("@/utilities/messageDefaultSettings").readStoredSettings;

  // The whole path a perspective would have to travel to reach the backend:
  // Chat reads storage and adapts, useSendRequest builds the payload from what
  // it is handed. Both endpoints run through it, only the MCP selection differs.
  const sentRequest = (conversationId: string) => {
    const settings = { ...adaptSettingsForRequest(readStoredSettings()) };
    const { url, extraPayload } = resolveMessageEndpoint(
      conversationId,
      getSelectedMcpServerNames(),
      "stream",
    );
    const payload: Record<string, unknown> = {
      ...buildGenerationPayload({ query: "hello", settings, models: MODELS }),
      ...extraPayload,
    };
    return { url, payload };
  };

  const mustKeys = (payload: Record<string, unknown>) => {
    const requestFilters = payload.filters as
      | { must?: { key: string }[] }
      | undefined;
    return (requestFilters?.must ?? []).map((entry) => entry.key);
  };

  beforeEach(async () => {
    stubRuntimeConfig({
      FEATURE_TOOLKITS: "true",
      FEATURE_CLASSIFICATION_FILTERS: "false",
    });
    ({ buildGenerationPayload } = await import("./agenticMessage"));
    ({ getSelectedMcpServerNames } = await import("@/utilities/mcpServers"));
    ({ adaptSettingsForRequest } = await import("@/utilities/helpers"));
    ({ readStoredSettings } = await import(
      "@/utilities/messageDefaultSettings"
    ));

    installMemoryLocalStorage();
    // journal is the control: an unrelated filter the flag must not touch.
    seed(LOCAL_STORAGE_SETTINGS, {
      ...SETTINGS,
      ...PERSPECTIVES,
      journal: "Nature",
    });
    seed(LOCAL_STORAGE_MODEL_SELECTION, {
      type: "platform",
      id: "eve-instruct",
    });
  });

  it("keeps the three perspectives out of the classic request", () => {
    const { url, payload } = sentRequest("conv-1");

    expect(url).toBe("/conversations/conv-1/stream_messages");
    expect(mustKeys(payload)).toEqual(["journal"]);
  });

  it("keeps them out of the agentic request too", () => {
    seed(LOCAL_STORAGE_MCP_SERVERS, ["weather"]);

    const { url, payload } = sentRequest("conv-2");

    expect(url).toBe("/conversations/conv-2/stream-generate-agentic");
    expect(mustKeys(payload)).toEqual(["journal"]);
  });

  it("leaves the stored perspectives where they are", () => {
    sentRequest("conv-1");

    expect(
      JSON.parse(localStorage.getItem(LOCAL_STORAGE_SETTINGS) as string),
    ).toMatchObject(PERSPECTIVES);
  });
});
