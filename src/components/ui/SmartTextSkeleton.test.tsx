import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SmartTextSkeleton from "./SmartTextSkeleton";

describe("SmartTextSkeleton", () => {
  it("shows bars and none of the markdown source", () => {
    const source = "Some **bold** text\n\n\\[ \\text{Radiance} = \\frac{a}{b} \\]\n\n$x$ and `code` # h";
    const html = renderToStaticMarkup(<SmartTextSkeleton text={source} />);
    expect(html).toContain('data-testid="smart-text-skeleton"');
    const textContent = html.replace(/<[^>]*>/g, "");
    expect(textContent).toBe("");
    for (const ch of ["*", "\\", "$", "`", "#", "bold", "Radiance"]) {
      expect(html, ch).not.toContain(ch);
    }
  });

  it("keeps roughly the answer height, one 24px bar per line, capped", () => {
    const bars = (text: string) =>
      (renderToStaticMarkup(<SmartTextSkeleton text={text} />).match(/h-4 my-1/g) ?? []).length;
    expect(bars("short")).toBe(1);
    expect(bars("a\nb\nc")).toBe(3);
    expect(bars("x".repeat(5000))).toBe(6);
  });
});
