import { createRequire } from "node:module";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SmartText from "./SmartText";

/**
 * Formulas go through the whole SmartText pipeline (remark-math, rehype-katex,
 * rehype-raw, rehype-sanitize). The katex copy rehype-katex loads is pinned by a
 * yarn resolution outside the range rehype-katex declares, so these tests prove
 * the pinned copy still renders and the sanitizer still keeps its markup.
 */
const render = (text: string) => renderToStaticMarkup(<SmartText text={text} />);

describe("SmartText math", () => {
  it("renders inline math with KaTeX", () => {
    const html = render("Energy is $E = mc^2$ here.");
    expect(html).toContain('class="katex"');
    expect(html).toContain('<annotation encoding="application/x-tex">E = mc^2</annotation>');
    expect(html).not.toContain("katex-display");
    expect(html).not.toContain("katex-error");
    expect(html).not.toContain("$E = mc^2$");
  });

  it("renders block math with KaTeX in display mode", () => {
    const html = render("$$\n\\int_0^1 x^2 \\, dx = \\frac{1}{3}\n$$");
    expect(html).toContain('class="katex-display"');
    expect(html).toContain("<math");
    expect(html).toContain('class="mfrac"');
    expect(html).not.toContain("katex-error");
  });

  it("emits the equation number class that index.css targets", () => {
    // index.css styles `.katex-display > .katex > .katex-html > .katex-tag`:
    // a katex release that renames the class must fail here, not in the UI.
    const html = render("$$\nE = mc^2 \\tag{1}\n$$");
    expect(html).toContain('class="katex-display"');
    expect(html).toContain('class="katex-tag"');
    expect(html).not.toContain('class="tag"');
    expect(html).not.toContain("katex-error");
  });

  it("loads the same katex copy for rendering as the app imports for the CSS", () => {
    const require = createRequire(import.meta.url);
    const fromRehype = require.resolve("katex/package.json", {
      paths: [path.resolve("node_modules/rehype-katex")],
    });
    const direct = require.resolve("katex/package.json");
    expect(fromRehype).toBe(direct);
    expect(require(fromRehype).version).toMatch(/^0\.(1[89]|[2-9]\d)\./);
  });
});
