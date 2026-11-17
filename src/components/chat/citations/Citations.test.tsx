// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
import SmartText from "@/components/ui/SmartText";
import StreamdownText from "@/components/ui/StreamdownText";
import { markCitations, type Citation, type RetrievedSource } from "@/utilities/citations";
import { CitationsProvider } from "./CitationsContext";
import { MessageSources } from "./MessageSources";
import { StepSourceChips } from "./StepSourceChips";

// jsdom has no ResizeObserver; the popover measures its anchor with one.
const noop = () => undefined;
globalThis.ResizeObserver ??= class {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
} as unknown as typeof ResizeObserver;

/** Radix adds its outside listeners and restores focus one task later. */
const tick = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const doc = (n: number, at: number[], extra: Partial<Citation> = {}): Citation => ({
  id: `src_${n}`,
  kind: "document",
  provider: "qwen-512-filtered",
  provider_label: "EVE open access",
  visibility: "public",
  title: `Burn severity study ${n}`,
  passage: `Passage ${n}.`,
  locator: { page: n },
  n,
  at,
  origin: "model",
  ...extra,
});

const wiley = (n: number, at: number[]) =>
  doc(n, at, {
    provider: "wiley",
    provider_label: "Wiley AI Gateway",
    visibility: "licensed",
    open: { type: "url", href: "https://doi.org/10.1002/x" },
  });

const file = (n: number, at: number[]) =>
  doc(n, at, {
    kind: "user_file",
    provider: "my-collections",
    provider_label: "My collections",
    visibility: "private",
    title: "evros_field_campaign_2023_composite_burn_index_plots_final.pdf",
    file: { name: "evros_field_campaign_2023_composite_burn_index_plots_final.pdf" },
    open: { type: "viewer", document_id: "d1", page: 18 },
  });

const stac = (n: number, at: number[]) =>
  doc(n, at, {
    kind: "stac_item",
    provider: "cdse",
    provider_label: "cdse",
    title: "Sentinel-2B L2A, tile 33TTG, 4 November 2026",
    passage: undefined,
    locator: {
      stac_collection: "sentinel-2-l2a",
      stac_item_id: "S2B_MSIL2A_20261104T100059_N0511_R122_T33TTG",
      datetime: "2026-11-04T10:00:59Z",
    },
    meta: { cloud_cover: 3.2 },
    open: { type: "stac", href: "https://stac.dataspace.copernicus.eu/v1/collections/sentinel-2-l2a/items/x" },
  });

// Streamdown loads mermaid only for a diagram; none here, but the module is mocked as in its own tests.
vi.mock("@streamdown/mermaid", () => ({
  createMermaidPlugin: () => ({
    getMermaid: () => ({ initialize: vi.fn(), render: vi.fn(() => Promise.resolve({ svg: "" })) }),
  }),
}));

type Renderer = ComponentType<{ text: string; markers?: ReturnType<typeof markCitations>["markers"] }>;
// Each marker test runs in both answer renderers (FEATURE_STREAMDOWN off and on).
const RENDERERS: [string, Renderer][] = [
  ["SmartText", SmartText as Renderer],
  ["StreamdownText", StreamdownText as Renderer],
];
let Answer: Renderer = SmartText as Renderer;

const renderAnswer = (text: string, citations: Citation[], retrieved: RetrievedSource[] = []) => {
  const marked = markCitations(text, citations);
  return render(
    <CitationsProvider markers={marked.markers} citations={citations} scope="m1">
      <Answer text={marked.text} markers={marked.markers} />
      <MessageSources citations={citations} retrieved={retrieved} answer={text} />
    </CitationsProvider>,
  );
};

afterEach(cleanup);

describe.each(RENDERERS)("citation markers in %s", (_name, renderer) => {
  beforeEach(() => {
    Answer = renderer;
  });
  const text = "Burn severity uses dNBR.[1] Thresholds need field plots.[2] A literal [1] stays.";
  const citations = [wiley(1, [24]), doc(2, [56])];

  it("turns only the recorded offsets into buttons named for screen readers", () => {
    renderAnswer(text, citations);
    const markers = screen.getAllByTestId("citation-marker");
    expect(markers).toHaveLength(2);
    expect(markers[0].getAttribute("aria-label")).toBe("Source 1: Burn severity study 1, Wiley AI Gateway");
    expect(markers[0].getAttribute("aria-haspopup")).toBe("dialog");
    expect(markers[0].getAttribute("aria-expanded")).toBe("false");
    expect(document.body.textContent).toContain("A literal [1] stays.");
  });

  it("opens the card on click and closes it on a second click", () => {
    renderAnswer(text, citations);
    const marker = screen.getAllByTestId("citation-marker")[0];
    fireEvent.click(marker);
    const card = screen.getByTestId("source-card");
    expect(card.getAttribute("role")).toBe("dialog");
    expect(marker.getAttribute("aria-expanded")).toBe("true");
    expect(within(card).queryByTestId("source-badge")).toBeNull();
    expect(within(card).getByTestId("source-provider").textContent).toBe("wiley");
    expect(within(card).getByTestId("source-open").textContent).toContain("(opens in a new tab)");
    fireEvent.click(marker);
    expect(screen.queryByTestId("source-card")).toBeNull();
  });

  it("opens from the keyboard, lets Tab into the card and closes on Escape with focus back", async () => {
    renderAnswer(text, citations);
    const marker = screen.getAllByTestId("citation-marker")[1];
    marker.focus();
    fireEvent.keyDown(marker, { key: "Enter" });
    expect(screen.getByTestId("source-card")).toBeTruthy();
    fireEvent.keyDown(marker, { key: "Tab" });
    const card = screen.getByTestId("source-card");
    expect(card.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    await tick();
    expect(screen.queryByTestId("source-card")).toBeNull();
    expect(document.activeElement).toBe(marker);
  });

  it("swaps the card to another marker without a closed frame in between", async () => {
    renderAnswer(text, citations);
    const [first, second] = screen.getAllByTestId("citation-marker");
    fireEvent.click(first);
    await tick();
    expect(screen.getAllByTestId("source-card")).toHaveLength(1);
    // The press on the second marker must not close the first card on its own.
    fireEvent.pointerDown(second);
    fireEvent.mouseDown(second);
    expect(screen.getAllByTestId("source-card")).toHaveLength(1);
    expect(screen.getByTestId("source-card").getAttribute("aria-label")).toContain("Source 1");
    fireEvent.click(second);
    const cards = screen.getAllByTestId("source-card");
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute("aria-label")).toContain("Source 2");
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(second.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on a click outside", async () => {
    renderAnswer(text, citations);
    fireEvent.click(screen.getAllByTestId("citation-marker")[0]);
    await tick();
    await tick();
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);
    expect(screen.queryByTestId("source-card")).toBeNull();
  });

  it("draws markers as a fill with no border", () => {
    renderAnswer(text, citations);
    for (const marker of screen.getAllByTestId("citation-marker")) {
      expect(marker.className).not.toMatch(/(^|\s)border(-|\s|$)/);
    }
  });

  it("folds three consecutive numbers into one range chip", () => {
    renderAnswer("All three.[1][2][3]", [doc(1, [10]), doc(2, [13]), doc(3, [16])]);
    const markers = screen.getAllByTestId("citation-marker");
    expect(markers).toHaveLength(1);
    expect(markers[0].textContent).toBe("1 to 3");
    expect(markers[0].getAttribute("aria-label")).toBe("Sources 1 to 3");
    fireEvent.click(markers[0]);
    expect(within(screen.getByTestId("source-card")).getAllByTestId("source-card-item")).toHaveLength(3);
  });

  it("keeps a marker inside code as text", () => {
    renderAnswer("Run `x[1]` here.[1]", [doc(1, [16]), doc(1, [6], { id: "dup" })]);
    expect(screen.getAllByTestId("citation-marker")).toHaveLength(1);
    expect(document.querySelector("code")?.textContent).toBe("x[1]");
  });

  it("keeps a marker inside a formula as plain text", () => {
    renderAnswer("Ratio $a[1]$ here.[1]", [doc(1, [8]), doc(1, [18], { id: "b" })]);
    expect(screen.getAllByTestId("citation-marker")).toHaveLength(1);
    expect(document.querySelector(".katex, [data-testid='streamdown-math-pending']")).toBeTruthy();
    expect(document.querySelector(".katex button, annotation button")).toBeNull();
  });

  it("puts a marker written inside link text after the link, never inside it", () => {
    renderAnswer("See [the paper[1]](https://esa.int) now.", [doc(1, [14])]);
    const marker = screen.getByTestId("citation-marker");
    expect(marker.closest("a")).toBeNull();
    const link = document.querySelector("a[href='https://esa.int/'], a[href='https://esa.int']");
    expect(link?.textContent).toBe("the paper");
    expect(link?.nextElementSibling).toBe(marker);
  });

  it("traps Tab in the open card and sends Shift+Tab from its first control back to the marker", () => {
    renderAnswer(text, citations);
    const marker = screen.getAllByTestId("citation-marker")[0];
    marker.focus();
    fireEvent.click(marker);
    fireEvent.keyDown(marker, { key: "Tab" });
    const card = screen.getByTestId("source-card");
    const controls = [...card.querySelectorAll<HTMLElement>("a[href], button")];
    expect(document.activeElement).toBe(controls[0]);
    controls[controls.length - 1].focus();
    fireEvent.keyDown(controls[controls.length - 1], { key: "Tab" });
    expect(document.activeElement).toBe(controls[0]);
    fireEvent.keyDown(controls[0], { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(marker);
  });

  it("shows a STAC scene with collection, acquisition, cloud cover and item id", () => {
    renderAnswer("Scene found.[1]", [stac(1, [12])]);
    fireEvent.click(screen.getByTestId("citation-marker"));
    const card = screen.getByTestId("source-card");
    expect(card.getAttribute("data-kind")).toBe("stac_item");
    expect(card.textContent).toContain("sentinel-2-l2a");
    expect(card.textContent).toContain("2026-11-04 10:00 UTC");
    expect(card.textContent).toContain("3.2 %");
    expect(card.textContent).toContain("S2B_MSIL2A_20261104T100059_N0511_R122_T33TTG");
    expect(within(card).getByTestId("source-open").textContent).toContain("Open item");
  });

  it("draws a user file with its truncated name, the full name kept", () => {
    renderAnswer("Your plot.[1]", [file(1, [10])]);
    const marker = screen.getByTestId("citation-marker");
    expect(marker.getAttribute("aria-label")).toBe(
      "Source 1: evros_field_campaign_2023_composite_burn_index_plots_final.pdf, My collections",
    );
    fireEvent.click(marker);
    const name = within(screen.getByTestId("source-card")).getByTestId("source-file-name");
    expect(name.getAttribute("title")).toBe("evros_field_campaign_2023_composite_burn_index_plots_final.pdf");
    expect(name.textContent?.endsWith("_final.pdf")).toBe(true);
    expect(name.textContent).toContain("...");
  });
});

describe("sources list", () => {
  const text = "A.[1] B.[2] C.[3]";
  const citations = [wiley(1, [2]), doc(2, [8]), file(3, [14])];
  const retrieved: RetrievedSource[] = [
    { id: "r1", title: "Uncited one", provider: "wikipedia-512", provider_label: "Wikipedia EO", kind: "document" },
    { id: "r2", title: "Uncited two", provider: "wikipedia-512", provider_label: "Wikipedia EO", kind: "document" },
  ];

  it("is folded to one summary line by default and groups by provider when opened", () => {
    renderAnswer(text, citations, retrieved);
    const toggle = screen.getByTestId("message-sources-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("Sources: 3 cited from 2 providers and your file");
    expect(screen.queryAllByTestId("source-group")).toHaveLength(0);
    fireEvent.click(toggle);
    const groups = screen.getAllByTestId("source-group");
    expect(groups.map((g) => g.getAttribute("data-provider"))).toEqual(["wiley", "qwen-512-filtered", "own"]);
    expect(screen.getByTestId("message-sources-cited-label").textContent).toBe("Cited");
    const uncited = screen.getByTestId("message-sources-uncited-toggle");
    expect(uncited.textContent).toContain("Also retrieved: 2");
    expect(screen.queryByText("Uncited one")).toBeNull();
    fireEvent.click(uncited);
    expect(screen.getByText("Uncited one")).toBeTruthy();
  });

  it("reads Retrieved, not cited when nothing was cited", () => {
    renderAnswer("No markers here.", [], retrieved);
    expect(screen.queryByTestId("message-sources-toggle")).toBeNull();
    expect(screen.getByTestId("message-sources-uncited-toggle").textContent).toContain("Retrieved, not cited: 2");
  });
});

describe("private file Open", () => {
  it("says it opens My collections and calls the panel, never a dead link", () => {
    let opened = 0;
    const citations = [file(1, [10])];
    const marked = markCitations("Your plot.[1]", citations);
    render(
      <CitationsProvider markers={marked.markers} citations={citations} scope="m2" onOpenMyCollections={() => (opened += 1)}>
        <SmartText text={marked.text} markers={marked.markers} />
      </CitationsProvider>,
    );
    fireEvent.click(screen.getByTestId("citation-marker"));
    const card = screen.getByTestId("source-card");
    expect(within(card).getByTestId("source-open-hint").textContent).toBe("Opens in My collections");
    expect(card.querySelector("a[href]")).toBeNull();
    fireEvent.click(within(card).getByTestId("source-open"));
    expect(opened).toBe(1);
  });
});

describe("provider slugs", () => {
  const open = (citation: Citation) => {
    const marked = markCitations("A.[1]", [citation]);
    render(
      <CitationsProvider markers={marked.markers} citations={[citation]} scope="m3">
        <SmartText text={marked.text} markers={marked.markers} />
      </CitationsProvider>,
    );
    fireEvent.click(screen.getByTestId("citation-marker"));
    return screen.getByTestId("source-card");
  };

  it("shows the descriptor slug as a lowercase mono label, no initials tile", () => {
    const card = open(doc(1, [2], { slug: "oa" }));
    const label = within(card).getByTestId("source-provider");
    expect(label.textContent).toBe("oa");
    expect(label.className).toContain("font-mono");
    expect(card.querySelector("[data-testid='provider-initials']")).toBeNull();
    expect(card.textContent).not.toContain("EV");
  });

  it("falls back to the lowercase provider without a slug", () => {
    const card = open(doc(1, [2], { provider: "Qwen-512-Filtered" }));
    expect(within(card).getByTestId("source-provider").textContent).toBe("qwen-512-filtered");
  });

  it("names the user's files Your files", () => {
    const card = open(file(1, [2]));
    expect(within(card).getByTestId("source-provider").textContent).toBe("Your files");
  });
});

describe("step source chips", () => {
  const tool = "call_1";
  const cited = [doc(1, [2], { tool_call_id: tool, slug: "esa" }), doc(2, [5], { tool_call_id: tool, slug: "esa" })];
  const retrieved: RetrievedSource[] = [1, 2, 3, 4, 5].map((i) => ({
    id: `r${i}`,
    title: `Retrieved ${i}`,
    provider: "wikipedia-512",
    slug: "wikipedia",
    kind: "document",
    tool_call_id: tool,
  }));

  const renderChips = () => {
    const marked = markCitations("A.[1] B.[2]", cited);
    render(
      <CitationsProvider markers={marked.markers} citations={cited} retrieved={retrieved} scope="m4">
        <StepSourceChips toolCallId={tool} />
      </CitationsProvider>,
    );
  };

  it("shows cited chips first with their number and folds the rest behind N more retrieved", () => {
    renderChips();
    const chips = screen.getAllByTestId("agent-step-source-chip");
    expect(chips.map((c) => c.getAttribute("data-n"))).toEqual(["1", "2"]);
    expect(chips[0].textContent).toContain("esa");
    for (const chip of chips) expect(chip.className).not.toMatch(/(^|\s)border(-|\s|$)/);
    const more = screen.getByTestId("agent-step-source-chip-more");
    expect(more.textContent).toBe("5 more retrieved");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("agent-step-sources-uncited")).toBeNull();
    fireEvent.click(more);
    const list = screen.getByTestId("agent-step-sources-uncited");
    expect(list.getAttribute("aria-label")).toBe("Retrieved, not cited");
    expect(list.textContent).toContain("Retrieved, not cited");
    const items = within(list).getAllByTestId("agent-step-source-uncited");
    expect(items).toHaveLength(5);
    expect(items[0].textContent).toContain("Retrieved 1");
    expect(items[0].textContent).toContain("wikipedia");
    expect(items[0].getAttribute("data-n")).toBeNull();
    expect(items[0].className).not.toMatch(/bg-/);
  });
});

describe("card on a phone", () => {
  const citations = [doc(1, [2]), doc(2, [8])];
  const realRect = Element.prototype.getBoundingClientRect;
  const realHeight = window.innerHeight;

  /** md and up matches `desktop`; reduced motion matches `reduce`. */
  const stubMedia = ({ desktop, reduce = false }: { desktop: boolean; reduce?: boolean }) => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("min-width") ? desktop : query.includes("reduced-motion") ? reduce : false,
      media: query,
      addEventListener: noop,
      removeEventListener: noop,
    })) as unknown as typeof window.matchMedia;
  };

  const rect = (top: number, bottom: number) =>
    ({ top, bottom, left: 0, right: 390, width: 390, height: bottom - top, x: 0, y: top, toJSON: noop }) as DOMRect;

  /** A chat scroller (0 to 700) with the composer box under it (700 to 844), the card at 640 to 900. */
  const renderInChat = () => {
    const marked = markCitations("A.[1] B.[2]", citations);
    render(
      <div data-testid="scroller" style={{ overflowY: "auto" }}>
        <CitationsProvider markers={marked.markers} citations={citations} scope="m5">
          <SmartText text={marked.text} markers={marked.markers} />
        </CitationsProvider>
        <div data-testid="composer-box" />
      </div>,
    );
    const scroller = screen.getByTestId("scroller");
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 700 });
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy as unknown as typeof scroller.scrollBy;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this === scroller) return rect(0, 700);
      if (this.getAttribute("data-testid") === "composer-box") return rect(700, 844);
      if (this.getAttribute("data-testid") === "source-card") return rect(640, 900);
      return rect(0, 0);
    };
    return { scrollBy };
  };

  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = realRect;
    Object.defineProperty(window, "innerHeight", { configurable: true, value: realHeight });
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("scrolls the chat so the card ends 8 px above the composer, focus left on the marker", () => {
    stubMedia({ desktop: false });
    const { scrollBy } = renderInChat();
    const marker = screen.getAllByTestId("citation-marker")[0];
    marker.focus();
    fireEvent.click(marker);
    expect(screen.getByTestId("source-card")).toBeTruthy();
    expect(scrollBy).toHaveBeenCalledWith({ top: 208, behavior: "smooth" });
    expect(document.activeElement).toBe(marker);
  });

  it("scrolls again when the card swaps to another marker", () => {
    stubMedia({ desktop: false });
    const { scrollBy } = renderInChat();
    const [first, second] = screen.getAllByTestId("citation-marker");
    expect(screen.getAllByTestId("citation-marker")).toHaveLength(2);
    fireEvent.click(first);
    fireEvent.click(second);
    expect(screen.getByTestId("source-card").getAttribute("aria-label")).toContain("Source 2");
    expect(scrollBy).toHaveBeenCalledTimes(2);
  });

  it("scrolls at once under reduced motion", () => {
    stubMedia({ desktop: false, reduce: true });
    const { scrollBy } = renderInChat();
    fireEvent.click(screen.getAllByTestId("citation-marker")[0]);
    expect(scrollBy).toHaveBeenCalledWith({ top: 208, behavior: "instant" });
  });

  it("never scrolls from md up, where the card floats", () => {
    stubMedia({ desktop: true });
    const { scrollBy } = renderInChat();
    fireEvent.click(screen.getAllByTestId("citation-marker")[0]);
    expect(screen.getByTestId("source-card")).toBeTruthy();
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
