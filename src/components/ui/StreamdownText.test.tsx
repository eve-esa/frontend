import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Node environment, no layout engine: mermaid itself is mocked. The tests prove
// a fenced block becomes a Streamdown diagram block and that the plugin loads
// mermaid only when a diagram is rendered.
const mermaidRender = vi.fn(() => Promise.resolve({ svg: "<svg></svg>" }));
const mermaidInitialize = vi.fn();
const mermaidFactory = vi.fn(() => ({
  getMermaid: () => ({ initialize: mermaidInitialize, render: mermaidRender }),
}));
vi.mock("@streamdown/mermaid", () => ({ createMermaidPlugin: mermaidFactory }));

import StreamdownText, { lazyMermaid, loadMathPlugin } from "./StreamdownText";
import { MermaidFallbackView } from "./MermaidFallback";

const render = (text: string, isStreaming = false) =>
  renderToStaticMarkup(<StreamdownText text={text} isStreaming={isStreaming} />);
const PENDING = 'data-testid="streamdown-math-pending"';

describe("StreamdownText", () => {
  beforeAll(async () => {
    await loadMathPlugin();
  });

  it("renders markdown with the SmartText classes and link testid", () => {
    const html = render("# Title\n\nSome **bold** and a [link](https://esa.int).\n\n- one\n- two");
    expect(html).toMatch(/<h1[^>]*>Title<\/h1>/);
    expect(html).toMatch(/<strong[^>]*>bold<\/strong>/);
    expect(html).toContain('data-testid="smart-text-link"');
    expect(html).toContain('href="https://esa.int"');
    expect(html.match(/<li /g)).toHaveLength(2);
  });

  it("shows Python power notation literally and keeps bold", () => {
    const html = render("3**50 = 717897987691852588770249 and 2**100 is **big**, `4**2` too");
    expect(html).toContain("3**50 = 717897987691852588770249");
    expect(html).toContain("2**100");
    expect(html).toMatch(/<strong[^>]*>big<\/strong>/);
    expect(html).not.toMatch(/<strong[^>]*>50/);
    expect(html).toMatch(/<code[^>]*>4\*\*2<\/code>/);
  });

  it("renders inline math with KaTeX", () => {
    const html = render("Energy is $E = mc^2$ here.");
    expect(html).toContain('class="katex"');
    expect(html).toContain('<annotation encoding="application/x-tex">E = mc^2</annotation>');
    expect(html).not.toContain("katex-display");
    expect(html).not.toContain("katex-error");
  });

  it("renders display math and keeps the equation number class index.css targets", () => {
    const html = render("$$\nE = mc^2 \\tag{1}\n$$");
    expect(html).toContain('class="katex-display"');
    expect(html).toContain('class="katex-tag"');
    expect(html).not.toContain('class="tag"');
    expect(html).not.toContain("katex-error");
  });

  it("converts \\[ \\] delimiters like SmartText", () => {
    const html = render("\\[\\frac{1}{3}\\]");
    expect(html).toContain('class="katex-display"');
    expect(html).toContain('class="mfrac"');
  });

  it("turns a mermaid fence into a diagram block and loads mermaid only to render it", async () => {
    const html = render("```mermaid\ngraph TD; A-->B;\n```");
    // Streamdown shows its diagram placeholder, not the fenced source as code.
    expect(html).not.toContain('data-streamdown="code-block"');
    expect(html).not.toContain("A--&gt;B");
    expect(html).toContain("animate-spin");
    expect(mermaidFactory).not.toHaveBeenCalled();
    const { svg } = await lazyMermaid.getMermaid().render("m1", "graph TD; A-->B;");
    expect(svg).toBe("<svg></svg>");
    expect(mermaidFactory).toHaveBeenCalledTimes(1);
    expect(mermaidRender).toHaveBeenCalledWith("m1", "graph TD; A-->B;");
  });

  it("applies the theme config Streamdown passes right before rendering, always strict", async () => {
    mermaidInitialize.mockClear();
    const light = { theme: "base", themeVariables: { lineColor: "#8197a6" }, securityLevel: "loose" };
    await lazyMermaid.getMermaid(light).render("m2", "graph TD; A-->B;");
    expect(mermaidInitialize).toHaveBeenCalledWith({ ...light, securityLevel: "strict" });
    const renders = mermaidRender.mock.invocationCallOrder;
    expect(mermaidInitialize.mock.invocationCallOrder[0]).toBeLessThan(renders[renders.length - 1]);

    mermaidInitialize.mockClear();
    await lazyMermaid.getMermaid({ theme: "dark" }).render("m3", "graph TD; A-->B;");
    expect(mermaidInitialize).toHaveBeenCalledWith({ theme: "dark", securityLevel: "strict" });
  });

  it("quotes unquoted labels before mermaid renders the live diagram", async () => {
    const live = "flowchart TD\n    A[Start] --> B[Input Red and NIR values]\n    D --> E[Divide (NIR - Red) by (NIR + Red)]";
    await lazyMermaid.getMermaid().render("m4", live);
    expect(mermaidRender).toHaveBeenLastCalledWith(
      "m4",
      'flowchart TD\n    A[Start] --> B[Input Red and NIR values]\n    D --> E["Divide (NIR - Red) by (NIR + Red)"]',
    );
  });

  it("opens a diagram click link in a new tab, never in place of the app", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: '<svg><a href="https://example.com" target="_self"><g></g></a></svg>',
    });
    const { svg } = await lazyMermaid
      .getMermaid()
      .render("m6", 'flowchart TD\n    A --> B\n    click A "https://example.com" _self');
    expect(svg).toBe(
      '<svg><a href="https://example.com" target="_blank" rel="noopener noreferrer"><g></g></a></svg>',
    );
  });

  it("logs a diagram that still fails at debug level only and rethrows it", async () => {
    const parseError = new Error("Parse error on line 2: ... Expecting 'SQE'");
    mermaidRender.mockRejectedValueOnce(parseError);
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = "flowchart TD\n    A[Start --> B[End";
    await expect(lazyMermaid.getMermaid().render("m5", broken)).rejects.toBe(parseError);
    expect(debug).toHaveBeenCalledWith("Mermaid diagram not rendered", parseError);
    expect(error).not.toHaveBeenCalled();
    debug.mockRestore();
    error.mockRestore();
  });

  it("shows an unfixable diagram as code with a muted note, never the error", () => {
    const broken = "flowchart TD\n    A[Start --> B[End";
    const html = renderToStaticMarkup(<MermaidFallbackView chart={broken} incomplete={false} />);
    expect(html).toContain('data-testid="mermaid-fallback-code"');
    expect(html).toContain("A[Start --&gt; B[End");
    expect(html).toContain('data-testid="mermaid-fallback-note"');
    expect(html).toContain("Diagram could not be drawn");
    expect(html).not.toMatch(/Mermaid Error|Parse error|Expecting/);
  });

  it("shows the placeholder, not the code, for a diagram still streaming", () => {
    const html = renderToStaticMarkup(
      <MermaidFallbackView chart={"flowchart TD\n    A[Divide (NIR"} incomplete />,
    );
    expect(html).toContain('data-testid="mermaid-pending"');
    expect(html).toContain("animate-spin");
    expect(html).not.toContain("Divide");
    expect(html).not.toContain("Diagram could not be drawn");
  });

  it("renders an unfinished mermaid fence in a streaming answer as the placeholder", () => {
    const html = render("Here it is:\n\n```mermaid\nflowchart TD\n    A[Divide (NIR", true);
    // Server render: the diagram area is still the empty reserved box.
    expect(html).toContain('data-streamdown="mermaid-block"');
    expect(html).not.toContain("Divide");
    expect(html).not.toMatch(/Mermaid Error|Parse error/);
    expect(html).not.toContain('data-testid="mermaid-fallback"');
  });

  it("self-heals an unfinished bold span while streaming", () => {
    const html = render("Partial **bold text");
    expect(html).toMatch(/<strong[^>]*>bold text<\/strong>/);
    expect(html).not.toContain("**");
  });

  it("holds an unclosed display block back while streaming, renders it once closed", () => {
    for (const partial of ["Intro\n\n$$\n\\text{Radiance} = \\frac{a}{", "Intro \\[ \\text{Radiance} ="]) {
      const html = render(partial, true);
      expect(html, partial).toContain(PENDING);
      expect(html, partial).toContain("Intro");
      expect(html, partial).not.toContain("Radiance");
      expect(html, partial).not.toContain("$$");
      expect(html, partial).not.toContain("\\[");
    }
    const closed = render("Intro \\[ \\text{Radiance} = \\frac{a}{b} \\]", true);
    expect(closed).not.toContain(PENDING);
    expect(closed).toContain('class="katex-display"');
  });

  it("holds unclosed inline math back while streaming, renders it once closed", () => {
    for (const partial of ["Energy $E = m", "Energy \\( E = m"]) {
      const html = render(partial, true);
      expect(html, partial).toContain(PENDING);
      expect(html, partial).not.toContain("E = m");
    }
    const closed = render("Energy \\( E = mc^2 \\) here", true);
    expect(closed).not.toContain(PENDING);
    expect(closed).toContain('class="katex"');
  });

  it("keeps an unclosed dollar as text once the answer is finished", () => {
    const html = render("It costs $5 per scene");
    expect(html).not.toContain(PENDING);
    expect(html).toContain("$5 per scene");
  });

  it("strips script tags, event handlers and javascript links", () => {
    const html = render(
      '<script>window.hacked = 1</script>\n\nText <span onclick="alert(1)">x</span> <iframe src="https://evil.example"></iframe> <a href="javascript:alert(1)">bad</a> ok',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("window.hacked");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("javascript:");
  });

  it("renders one katex copy for both renderers", async () => {
    const { createRequire } = await import("node:module");
    const path = await import("node:path");
    const require = createRequire(import.meta.url);
    const direct = require.resolve("katex/package.json");
    for (const pkg of ["@streamdown/math", "rehype-katex", "mermaid"]) {
      const resolved = require.resolve("katex/package.json", {
        paths: [path.resolve("node_modules", pkg)],
      });
      expect(resolved, pkg).toBe(direct);
    }
  });
});

describe("StreamdownText before the math chunk loads", () => {
  it("shows a placeholder for each formula, never the LaTeX source", async () => {
    vi.resetModules();
    const { default: Fresh } = await import("./StreamdownText");
    const html = renderToStaticMarkup(
      <Fresh text={"Inline $E = mc^2$ and\n\n\\[\\text{Radiance}\\]"} />,
    );
    expect(html.match(new RegExp(PENDING, "g"))).toHaveLength(2);
    expect(html).not.toContain("mc^2");
    expect(html).not.toContain("Radiance");
    expect(html).not.toContain("katex");
  });
});
