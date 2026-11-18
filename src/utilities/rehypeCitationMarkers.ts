import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { MARKER_PATTERN } from "./citations";

/**
 * Turns the marker placeholders `markCitations` wrote into `<cite
 * data-eve-marker="k">` elements, and wraps every top-level block that holds
 * one in a `<div data-eve-block="k1 k2">`, so the source card can open in
 * place under that block. Runs after rehype-sanitize: the elements it adds are
 * ours, never the model's. Placeholders inside code go back to `[n]` text
 * through `restore`, since code renders its text verbatim.
 */
const markerElement = (key: number): Element => ({
  type: "element",
  tagName: "cite",
  properties: { dataEveMarker: String(key) },
  children: [],
});

const MATH_CLASS = /^(katex.*|math-inline|math-display|language-math)$/;

/**
 * Code and math render their text as it is: a placeholder there goes back to
 * `[n]`. Math is remark-math's `code.language-math` before KaTeX, or KaTeX
 * output and MathML when a renderer ran KaTeX first.
 */
const isVerbatim = (node: Element): boolean => {
  if (node.tagName === "code" || node.tagName === "pre" || node.tagName === "math" || node.tagName === "annotation") {
    return true;
  }
  const classes = node.properties?.className;
  return Array.isArray(classes) && classes.some((c) => MATH_CLASS.test(String(c)));
};

export const rehypeCitationMarkers =
  (options: { restore: (key: number) => string }) => () => (tree: Root) => {
    const splitText = (node: Text, inCode: boolean, found: number[]): ElementContent[] => {
      const value = node.value;
      MARKER_PATTERN.lastIndex = 0;
      if (!MARKER_PATTERN.test(value)) return [node];
      MARKER_PATTERN.lastIndex = 0;
      if (inCode) {
        return [{ type: "text", value: value.replace(MARKER_PATTERN, (_, k: string) => options.restore(Number(k))) }];
      }
      const out: ElementContent[] = [];
      let cursor = 0;
      for (const match of value.matchAll(MARKER_PATTERN)) {
        const start = match.index ?? 0;
        if (start > cursor) out.push({ type: "text", value: value.slice(cursor, start) });
        const key = Number(match[1]);
        found.push(key);
        out.push(markerElement(key));
        cursor = start + match[0].length;
      }
      if (cursor < value.length) out.push({ type: "text", value: value.slice(cursor) });
      return out;
    };

    // Inside a link: the placeholders leave the link text and are collected,
    // so their markers go right after the link (a button inside an `<a>`
    // would follow the link on click).
    const stripInto = (node: Element, keys: number[]) => {
      for (const child of node.children) {
        if (child.type === "text") {
          child.value = child.value.replace(MARKER_PATTERN, (_, k: string) => {
            keys.push(Number(k));
            return "";
          });
        } else if (child.type === "element") {
          stripInto(child, keys);
        }
      }
    };

    const walk = (parent: Element | Root, inCode: boolean, found: number[]) => {
      const next: (ElementContent | RootContent)[] = [];
      for (const child of parent.children) {
        if (child.type === "text") {
          next.push(...splitText(child, inCode, found));
        } else if (child.type === "element" && child.tagName === "a" && !inCode) {
          const keys: number[] = [];
          stripInto(child, keys);
          next.push(child, ...keys.map(markerElement));
          found.push(...keys);
        } else if (child.type === "element") {
          walk(child, inCode || isVerbatim(child), found);
          next.push(child);
        } else {
          next.push(child);
        }
      }
      parent.children = next as typeof parent.children;
    };

    tree.children = tree.children.map((child): RootContent => {
      if (child.type === "text") {
        // A loose placeholder at the top level: wrap it like a block.
        const found: number[] = [];
        const parts = splitText(child, false, found);
        if (found.length === 0) return child;
        return {
          type: "element",
          tagName: "div",
          properties: { dataEveBlock: found.join(" ") },
          children: parts,
        };
      }
      if (child.type !== "element") return child;
      const found: number[] = [];
      walk(child, isVerbatim(child), found);
      if (found.length === 0) return child;
      return {
        type: "element",
        tagName: "div",
        properties: { dataEveBlock: found.join(" ") },
        children: [child],
      };
    });
  };
