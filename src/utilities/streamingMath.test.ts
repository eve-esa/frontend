import { describe, expect, it } from "vitest";
import { scanMath, withMathPlaceholders } from "./streamingMath";

const place = (text: string, opts: { streaming: boolean; mathReady: boolean }) =>
  withMathPlaceholders(text, scanMath(text), opts);

describe("scanMath", () => {
  it("finds closed display and inline formulas", () => {
    const text = "A $x$ and\n\n$$\ny^2\n$$\n";
    expect(scanMath(text)).toEqual([
      { start: 2, end: 5, kind: "inline", closed: true },
      { start: 11, end: 20, kind: "display", closed: true },
    ]);
  });

  it("marks an unclosed $$, \\[, \\( and $ as running to the end", () => {
    for (const [text, kind] of [
      ["Intro\n\n$$\n\\frac{a}{", "display"],
      ["Intro \\[ \\text{abc", "display"],
      ["Intro \\( x +", "inline"],
      ["Intro $x +", "inline"],
    ] as const) {
      const segments = scanMath(text);
      expect(segments[segments.length - 1], text).toMatchObject({ kind, closed: false, end: text.length });
    }
  });

  it("ignores dollars in code, escaped dollars and a dollar before a space", () => {
    expect(scanMath("```\n$$ not math\n```\nand `$x` and \\$5 and $ 5")).toEqual([]);
  });

  it("treats a dollar whose paragraph ended as literal", () => {
    expect(scanMath("Costs $5 today.\n\nNext paragraph.")).toEqual([]);
  });
});

describe("withMathPlaceholders", () => {
  it("holds back an unclosed display block while streaming", () => {
    const out = place("Intro\n\n$$\n\\text{Rad", { streaming: true, mathReady: true });
    expect(out).toBe('Intro\n\n<span class="eve-math-pending eve-math-pending-display"></span>');
    expect(out).not.toContain("\\text");
  });

  it("holds back unclosed inline math while streaming", () => {
    const out = place("Energy \\( E = m", { streaming: true, mathReady: true });
    expect(out).toBe('Energy <span class="eve-math-pending"></span>');
  });

  it("keeps an unclosed formula as text once the answer is finished", () => {
    const text = "Price $5 and more";
    expect(place(text, { streaming: false, mathReady: true })).toBe(text);
  });

  it("replaces closed formulas only while the math plugin is missing", () => {
    const text = "A $x$ b";
    expect(place(text, { streaming: false, mathReady: false })).toBe(
      'A <span class="eve-math-pending"></span> b',
    );
    expect(place(text, { streaming: false, mathReady: true })).toBe(text);
  });
});
