// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SuggestionRows } from "./SuggestionRows";

afterEach(cleanup);

describe("SuggestionRows", () => {
  const items = ["first question", "second question", "third question"];

  it("renders one button row per suggestion with a search icon, the text and an arrow", () => {
    render(<SuggestionRows suggestions={items} onPick={vi.fn()} />);
    const rows = screen.getAllByTestId("composer-suggestion");
    expect(rows).toHaveLength(3);
    rows.forEach((row, i) => {
      expect(row.tagName).toBe("BUTTON");
      expect(row.textContent).toBe(items[i]);
      expect(row.querySelectorAll("svg")).toHaveLength(2);
    });
  });

  it("hands the tapped text to onPick", () => {
    const onPick = vi.fn();
    render(<SuggestionRows suggestions={items} onPick={onPick} />);
    fireEvent.click(screen.getAllByTestId("composer-suggestion")[2]);
    expect(onPick).toHaveBeenCalledExactlyOnceWith("third question");
  });
});
