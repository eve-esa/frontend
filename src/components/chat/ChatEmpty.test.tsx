// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";
import type { ConfigKey } from "@/utilities/runtimeConfig";
import { suggestions } from "@/utilities/suggestions";

/**
 * The empty chat. FEATURE_MOBILE_COMPOSER on below md: logo and three suggestion rows above the
 * composer, a tap fills the input. Flag off or md and up: the layout of main, suggestions inside
 * the composer.
 */
let creating = false;

vi.mock("./MessageInput", () => ({
  // Stand-in with the two things the empty chat touches: the textarea and the suggestions prop.
  MessageInput: ({ suggestions: inside }: { suggestions?: string[] }) => {
    return (
      <div data-testid="composer-box" data-inside={String(inside?.length ?? 0)}>
        <textarea data-testid="composer-input" defaultValue="" onChange={vi.fn()} />
      </div>
    );
  },
}));
vi.mock("./ChatHeader", () => ({ ChatHeader: () => null }));
vi.mock("../onboarding/WelcomeDialog", () => ({ WelcomeDialog: () => null }));
vi.mock("@/services/useCreateConversation", () => ({
  useCreateConversation: () => ({ mutate: vi.fn(), isPending: creating }),
}));
vi.mock("@/services/useTokenUsage", () => ({ prefetchTokenUsage: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  generatePath: () => "/",
}));
vi.mock("@/utilities/routes", () => ({ routes: { CHAT: { path: "/c/:conversationId" } } }));

afterEach(() => {
  creating = false;
  cleanup();
  delete (window as unknown as { __EVE_CONFIG__?: unknown }).__EVE_CONFIG__;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

const renderEmpty = async (flag: boolean, phone: boolean) => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) => ({
      matches: phone && query === "(width < 48rem)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
  const config: Partial<Record<ConfigKey, string>> = {
    FEATURE_MOBILE_COMPOSER: flag ? "true" : "false",
    FEATURE_WELCOME_DIALOG: "false",
  };
  // The real jsdom window stays (React needs it): only the injected config is set on it.
  blankBuildTimeEnv();
  (window as unknown as { __EVE_CONFIG__: unknown }).__EVE_CONFIG__ = config;
  const { ChatEmpty } = await import("./ChatEmpty");
  return render(<ChatEmpty />);
};

describe("ChatEmpty on a phone with FEATURE_MOBILE_COMPOSER on", () => {
  it("shows the logo and three suggestion rows above a composer without suggestions", async () => {
    await renderEmpty(true, true);
    const hero = screen.getByTestId("empty-chat-hero");
    const rows = screen.getAllByTestId("composer-suggestion");
    expect(rows).toHaveLength(3);
    rows.forEach((row, i) => {
      expect(hero.contains(row)).toBe(true);
      expect(row.textContent).toBe(suggestions[i]);
    });
    expect(hero.querySelector("svg, img")).not.toBeNull();
    expect(screen.getByTestId("composer-box").dataset.inside).toBe("0");
    expect(hero.contains(screen.getByTestId("composer-box"))).toBe(false);
  });

  it("fills the input and focuses it when a row is tapped", async () => {
    await renderEmpty(true, true);
    const input = screen.getByTestId("composer-input") as HTMLTextAreaElement;
    fireEvent.click(screen.getAllByTestId("composer-suggestion")[1]);
    expect(input.value).toBe(suggestions[1]);
    expect(document.activeElement).toBe(input);
  });

  it("pins the composer slot at the bottom: 24 px under it, 16 px sides, hero takes the rest", async () => {
    await renderEmpty(true, true);
    const wrapper = screen.getByTestId("empty-chat-hero").parentElement as HTMLElement;
    expect(wrapper.className).toContain("flex-1");
    expect(wrapper.className).toContain("pb-6");
    expect(wrapper.className).toContain("px-4");
    expect(wrapper.className).not.toContain("mt-10");
  });
});

describe("ChatEmpty while the conversation is being created", () => {
  it("disables the suggestion rows", async () => {
    creating = true;
    await renderEmpty(true, true);
    const rows = screen.getAllByTestId("composer-suggestion") as HTMLButtonElement[];
    expect(rows).toHaveLength(3);
    rows.forEach((row) => expect(row.disabled).toBe(true));
    const input = screen.getByTestId("composer-input") as HTMLTextAreaElement;
    fireEvent.click(rows[0]);
    expect(input.value).toBe("");
  });
});

describe("ChatEmpty as on main", () => {
  it.each([
    ["flag off, phone", false, true],
    ["flag off, desktop", false, false],
    ["flag on, desktop", true, false],
  ])("%s: suggestions stay inside the composer, margins unchanged", async (_name, flag, phone) => {
    const { container } = await renderEmpty(flag, phone);
    expect(screen.queryByTestId("empty-chat-hero")).toBeNull();
    expect(screen.queryAllByTestId("composer-suggestion")).toHaveLength(0);
    expect(screen.getByTestId("composer-box").dataset.inside).toBe(String(suggestions.length));
    const wrapper = screen.getByTestId("composer-box").parentElement?.parentElement as HTMLElement;
    expect(wrapper.className).toBe(
      "w-full flex flex-col items-center justify-center mt-10 md:mt-50 2xl:mt-80 3xl:mt-100 gap-4 overflow-hidden px-container-responsive px-4 md:px-6",
    );
    expect(container.querySelector("[data-testid=composer-box]")?.parentElement?.className).toBe(
      "w-full overflow-y-auto flex flex-col gap-2 overflow-hidden",
    );
  });
});
