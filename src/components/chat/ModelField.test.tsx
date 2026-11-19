import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import type { ConfigKey } from "@/utilities/runtimeConfig";
import type { ModelListResponse } from "@/types";

/**
 * The phone header (flag on): hamburger with a name, the model field, New chat; and the model list
 * of the bottom sheet with the current row marked. Flag off: the header as before, one bare icon.
 */
const models = {
  platform: [
    { id: "eve-jsc", display_name: "EVE-Instruct (JSC)", llm_type: "eve_jsc" },
    { id: "eve-instruct", display_name: "EVE-Instruct", llm_type: "main" },
    { id: "mistral-small", display_name: "Mistral Small", llm_type: "fallback" },
  ],
  providers: [],
  custom: [
    {
      id: "c1",
      display_name: "My model",
    },
  ],
} as unknown as ModelListResponse;

vi.mock("@/utilities/routes", () => ({ routes: { EMPTY_CHAT: { path: "/" } } }));
vi.mock("./DynamicSidebarProvider", () => ({
  useSidebar: () => ({ toggleConversationsSidebar: vi.fn() }),
}));
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => true }));
vi.mock("@/services/useListModels", () => ({
  useListModels: () => ({ data: models }),
}));

const stubStorage = (selection: string | null) =>
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (key === "model_selection" ? selection : null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });

const renderHeader = async (config: Partial<Record<ConfigKey, string>>) => {
  stubRuntimeConfig(config);
  const { ChatHeader } = await import("./ChatHeader");
  return renderToStaticMarkup(
    <MemoryRouter>
      <ChatHeader />
    </MemoryRouter>,
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("ChatHeader", () => {
  it("flag off: one bare icon button, no model field, no New chat", async () => {
    stubStorage(null);
    const html = await renderHeader({});
    expect(html).not.toContain("header-model-field");
    expect(html).not.toContain("header-new-chat");
    expect(html).not.toContain("Open sidebar");
    expect((html.match(/<button/g) ?? []).length).toBe(1);
  });

  it("flag on: hamburger with a name, the model field with the current model, New chat", async () => {
    stubStorage(JSON.stringify({ type: "platform", id: "eve-instruct" }));
    const html = await renderHeader({ FEATURE_MOBILE_COMPOSER: "true" });
    expect(html).toMatch(/<button [^>]*aria-label="Open sidebar"[^>]*data-testid="chat-header-menu"/);
    expect(html).toMatch(/<button [^>]*aria-label="New chat"[^>]*data-testid="header-new-chat"/);
    const field = html.match(/<button [^>]*data-testid="header-model-field"[^>]*>.*?<\/button>/)?.[0] ?? "";
    expect(field).toContain("Model</span>");
    expect(field).toContain("EVE-Instruct</span>");
    // Phone only: the field and New chat leave the header from md up.
    expect(field).toContain("md:hidden");
    const newChat = html.match(/<button [^>]*data-testid="header-new-chat"[^>]*>/)?.[0] ?? "";
    expect(newChat).toContain("md:hidden");
  });
});

describe("ModelOptionList", () => {
  it("lists every model, marks the current one and nothing else", async () => {
    stubRuntimeConfig({ FEATURE_MOBILE_COMPOSER: "true" });
    const { ModelOptionList } = await import("./ModelField");
    const html = renderToStaticMarkup(
      <ModelOptionList models={models} value="platform:eve-instruct" onSelect={vi.fn()} />,
    );
    const rows = [...html.matchAll(/<button [^>]*data-testid="model-sheet-option"[^>]*>/g)].map((m) => m[0]);
    expect(rows).toHaveLength(4);
    const current = rows.filter((row) => row.includes('data-current="true"'));
    expect(current).toHaveLength(1);
    expect(current[0]).toContain('aria-current="true"');
    expect(html).toContain("My model");
    // The check mark sits in the current row only.
    expect((html.match(/<svg/g) ?? []).length).toBe(1);
  });
});
