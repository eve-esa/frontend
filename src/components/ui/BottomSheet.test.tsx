// @vitest-environment jsdom
import { useRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BottomSheet } from "./BottomSheet";

const Harness = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={ref} data-testid="opener" onClick={() => setOpen(true)}>
        open
      </button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Model"
        returnFocusTo={ref}
        data-testid="sheet"
      >
        <button data-testid="inside">inside</button>
      </BottomSheet>
    </>
  );
};

// A cold first render of the dialog primitives is slow on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

// Radix arms its outside-press listener one task after the sheet mounts.
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

afterEach(cleanup);

describe("BottomSheet", () => {
  it("is not rendered while closed and shows its title and content when open", () => {
    render(<Harness />);
    expect(screen.queryByTestId("sheet")).toBeNull();
    fireEvent.click(screen.getByTestId("opener"));
    expect(screen.getByTestId("sheet")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Model" })).toBeTruthy();
    expect(screen.getByTestId("inside")).toBeTruthy();
  });

  it("is square, edged and flat: no radius and no shadow classes", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("opener"));
    const cls = screen.getByTestId("sheet").className;
    expect(cls).toContain("border-primary-400");
    expect(cls).toContain("shadow-none");
    expect(cls).not.toMatch(/rounded/);
  });

  it("closes on Escape and returns focus to the opener", async () => {
    render(<Harness />);
    const opener = screen.getByTestId("opener");
    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByTestId("sheet"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("sheet")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("closes from the close button and from the scrim", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("opener"));
    fireEvent.click(screen.getByTestId("bottom-sheet-close"));
    expect(screen.queryByTestId("sheet")).toBeNull();

    fireEvent.click(screen.getByTestId("opener"));
    await settle();
    const overlay = screen.getByTestId("dialog-overlay");
    fireEvent.pointerDown(overlay);
    fireEvent.pointerUp(overlay);
    fireEvent.click(overlay);
    await waitFor(() => expect(screen.queryByTestId("sheet")).toBeNull());
  });

  it("moves focus into the sheet when it opens", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("opener"));
    expect(screen.getByTestId("sheet").contains(document.activeElement)).toBe(true);
  });

  it("focuses the checked row on open when there is one, else the first focusable", () => {
    render(
      <BottomSheet open onOpenChange={vi.fn()} title="Model" data-testid="sheet">
        <button role="radio" aria-checked="false" data-testid="a">a</button>
        <button role="radio" aria-checked="true" data-testid="b">b</button>
      </BottomSheet>,
    );
    expect(document.activeElement).toBe(screen.getByTestId("b"));
  });
});
