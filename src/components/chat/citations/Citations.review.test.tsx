// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SmartText from "@/components/ui/SmartText";
import { markCitations, type Citation } from "@/utilities/citations";
import { CitationsProvider } from "./CitationsContext";
import { MessageSources } from "./MessageSources";

/** Review fixes on the source card: anchor by id, layer, Escape scope, one popover, swap, phone. */

const noop = () => undefined;
globalThis.ResizeObserver ??= class {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
} as unknown as typeof ResizeObserver;

const tick = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const doc = (n: number, at: number[]): Citation => ({
  id: `src_${n}`,
  kind: "document",
  provider: "qwen-512-filtered",
  provider_label: "EVE open access",
  slug: "oa",
  visibility: "public",
  title: `Burn severity study ${n}`,
  passage: `Passage ${n}.`,
  locator: { page: n },
  n,
  at,
  origin: "model",
});

const text = "First.[1]\n\nSecond.[2]";
const citations = [doc(1, [6]), doc(2, [18])];

const Answer = ({ value = text }: { value?: string }) => {
  const marked = markCitations(value, citations);
  return (
    <CitationsProvider markers={marked.markers} citations={citations} scope="r1">
      <SmartText text={marked.text} markers={marked.markers} />
      <MessageSources citations={citations} retrieved={[]} answer={value} />
    </CitationsProvider>
  );
};

const stubMedia = (desktop: boolean) => {
  const fn = vi.fn((query: string) => ({
    matches: query.includes("min-width") ? desktop : false,
    media: query,
    addEventListener: noop,
    removeEventListener: noop,
  }));
  window.matchMedia = fn as unknown as typeof window.matchMedia;
  return fn;
};

afterEach(() => {
  cleanup();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("source card review fixes", () => {
  it("swaps between markers in two paragraphs: one card, focus on the second marker", async () => {
    render(<Answer />);
    const [first, second] = screen.getAllByTestId("citation-marker");
    expect(first.closest("[data-testid='citation-block']")).not.toBe(second.closest("[data-testid='citation-block']"));
    fireEvent.click(first);
    await tick();
    second.focus();
    fireEvent.pointerDown(second);
    fireEvent.mouseDown(second);
    fireEvent.click(second);
    await tick();
    await tick();
    const cards = screen.getAllByTestId("source-card");
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute("aria-label")).toContain("Source 2");
    expect(document.activeElement).toBe(second);
  });

  it("renders the card in place on a phone, inside the block of its marker", () => {
    stubMedia(false);
    render(<Answer />);
    const marker = screen.getAllByTestId("citation-marker")[1];
    fireEvent.click(marker);
    const block = marker.closest("[data-testid='citation-block']") as HTMLElement;
    expect(block.contains(screen.getByTestId("source-card"))).toBe(true);
  });

  it("names each opener by its card id and keeps the card after a streaming re-render", () => {
    const { rerender } = render(<Answer />);
    const marker = screen.getAllByTestId("citation-marker")[0];
    expect(marker.getAttribute("data-citation-opener")).toBeTruthy();
    fireEvent.click(marker);
    rerender(<Answer value={`${text} More.`} />);
    expect(screen.getAllByTestId("source-card")).toHaveLength(1);
  });

  it("floats the desktop card on the dialog layer", () => {
    render(<Answer />);
    fireEvent.click(screen.getAllByTestId("citation-marker")[0]);
    expect(screen.getByTestId("source-card").className).toContain("z-50");
  });

  it("ignores Escape pressed outside the card and its marker", async () => {
    render(
      <>
        <Answer />
        <input data-testid="outside" />
      </>,
    );
    const marker = screen.getAllByTestId("citation-marker")[0];
    fireEvent.click(marker);
    await tick();
    // A key pressed in another field (focus moved there without a click or Tab, which close the card).
    const outside = screen.getByTestId("outside");
    fireEvent.keyDown(outside, { key: "Escape" });
    await tick();
    expect(screen.getByTestId("source-card")).toBeTruthy();
    expect(document.activeElement).not.toBe(marker);
    marker.focus();
    fireEvent.keyDown(marker, { key: "Escape" });
    await tick();
    expect(screen.queryByTestId("source-card")).toBeNull();
  });

  it("reads the viewport width once per answer, not once per marker or list item", () => {
    const media = stubMedia(true);
    render(<Answer />);
    const widthCalls = media.mock.calls.filter(([q]) => q.includes("min-width")).length;
    expect(widthCalls).toBeLessThanOrEqual(2);
  });
});
