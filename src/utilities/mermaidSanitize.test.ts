import DOMPurify from "dompurify";
import { beforeAll, describe, expect, it } from "vitest";
import { hardenMermaidSvg, sanitizeMermaid } from "./mermaidSanitize";

// The diagram a model wrote on 2026-11-12: Mermaid answered "Parse error ...
// Expecting 'SQE'" because of the parentheses in the unquoted E label.
const LIVE = `flowchart TD
    A[Start] --> B[Input Red and NIR values]
    D --> E[Divide (NIR - Red) by (NIR + Red)]`;

// Mermaid's real parser. It sanitizes label text with DOMPurify, which needs
// a window this Node environment does not have: a pass-through stands in, the
// parse itself is untouched.
type Parse = (text: string) => Promise<unknown>;
let parse: Parse;
beforeAll(async () => {
  Object.assign(DOMPurify, {
    addHook: () => undefined,
    removeHook: () => undefined,
    removeHooks: () => undefined,
    sanitize: (text: string) => text,
  });
  const mermaid = (await import("mermaid")).default;
  parse = (text) => mermaid.parse(text);
});

describe("sanitizeMermaid", () => {
  it("quotes the live diagram's label so Mermaid parses it", async () => {
    await expect(parse(LIVE)).rejects.toThrow(/Parse error/);
    const fixed = sanitizeMermaid(LIVE);
    expect(fixed).toBe(`flowchart TD
    A[Start] --> B[Input Red and NIR values]
    D --> E["Divide (NIR - Red) by (NIR + Red)"]`);
    await expect(parse(fixed)).resolves.toBeTruthy();
  });

  it("leaves an already quoted label unchanged", () => {
    const quoted = `graph TD\n    A["Divide (NIR - Red)"] --> B["say #quot;hi#quot;"]`;
    expect(sanitizeMermaid(quoted)).toBe(quoted);
  });

  it("quotes the handled shapes and escapes inner double quotes", async () => {
    const fixed = sanitizeMermaid(
      'flowchart LR\n  A[[Sub (x)]] --> B((Sum (y))) --> C{ok?; yes} --> D(a "q" b) --> E[a|b]',
    );
    expect(fixed).toBe(
      'flowchart LR\n  A[["Sub (x)"]] --> B(("Sum (y)")) --> C{"ok?; yes"} --> D("a #quot;q#quot; b") --> E["a|b"]',
    );
    await expect(parse(fixed)).resolves.toBeTruthy();
  });

  it("leaves other shapes, edge labels and plain labels as written", () => {
    const valid =
      "flowchart LR\n  A[(db)] --> B([stadium]) --> C{{hex}} --> D[/para/] --> E(((dbl)))\n  E -->|yes| F[Plain text] & G(Round)\n  classDef warn fill:#f96;";
    expect(sanitizeMermaid(valid)).toBe(valid);
  });

  it("leaves other diagram types untouched", () => {
    const sequence = "sequenceDiagram\n    A->>B: call f(x)\n    Note over A: [draft]";
    expect(sanitizeMermaid(sequence)).toBe(sequence);
  });

  it("leaves an unbalanced label alone, so the diagram still fails", async () => {
    const broken = "flowchart TD\n    A[Start --> B[End";
    expect(sanitizeMermaid(broken)).toBe(broken);
    await expect(parse(sanitizeMermaid(broken))).rejects.toThrow();
  });
});

describe("hardenMermaidSvg", () => {
  it("opens a diagram link in a new tab without an opener", () => {
    const svg =
      '<svg><a xlink:href="https://example.com" href="https://example.com"><g class="node"></g></a></svg>';
    expect(hardenMermaidSvg(svg)).toBe(
      '<svg><a xlink:href="https://example.com" href="https://example.com" target="_blank" rel="noopener noreferrer"><g class="node"></g></a></svg>',
    );
  });

  it("replaces a same-tab target and an existing rel", () => {
    const out = hardenMermaidSvg(
      `<svg><a href="https://example.com" target="_self" rel='opener'>x</a><a target=_top href="#">y</a></svg>`,
    );
    expect(out).not.toContain("_self");
    expect(out).not.toContain("_top");
    expect(out).not.toContain("opener'");
    expect(out.match(/target="_blank"/g)).toHaveLength(2);
    expect(out.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
  });

  it("keeps a quoted > inside an attribute and leaves other tags alone", () => {
    const svg = '<svg><animate attributeName="x"/><a title="a > b" href="https://e.com"/></svg>';
    expect(hardenMermaidSvg(svg)).toBe(
      '<svg><animate attributeName="x"/><a title="a > b" href="https://e.com" target="_blank" rel="noopener noreferrer"/></svg>',
    );
  });

  it("leaves a diagram without links unchanged", () => {
    const svg = '<svg><g class="node"><text>A</text></g></svg>';
    expect(hardenMermaidSvg(svg)).toBe(svg);
  });
});
