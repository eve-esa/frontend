/**
 * Python power notation in an answer (`3**50 = 717897987691852588770249`)
 * opens markdown bold: the renderer shows "3" and a bold "50 = ...". Two stars
 * between two digits are escaped so they render literally. Bold always wraps
 * text (`**word**`), so it is never touched. Code (fenced, indented, inline,
 * `<pre>` and `<code>` blocks), formulas, HTML tags, autolinks and bare URLs
 * keep their text as written: a backslash there would show, or change a link.
 */
import { FENCE_OPEN, closingBackticks, closingFence, scanMath } from "./streamingMath";

const POWER_STARS = /(?<=\d)\*\*(?=\d)/g;

type Range = { start: number; end: number };

// Code fences (an unclosed one runs to the end, as while streaming) and
// inline code spans with a matching backtick run.
const codeRanges = (text: string): Range[] => {
  const ranges: Range[] = [];
  const n = text.length;
  let i = 0;
  let lineStart = true;
  while (i < n) {
    if (lineStart) {
      const fence = FENCE_OPEN.exec(text.slice(i, i + 40));
      if (fence) {
        const close = closingFence(text, i + fence[0].length, fence[1]);
        ranges.push({ start: i, end: close < 0 ? n : close });
        if (close < 0) return ranges;
        i = close;
        lineStart = false;
        continue;
      }
    }
    const c = text[i];
    if (c === "\n") {
      lineStart = true;
      i++;
      continue;
    }
    lineStart = false;
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "`") {
      let run = 1;
      while (text[i + run] === "`") run++;
      const close = closingBackticks(text, i + run, run);
      if (close >= 0) ranges.push({ start: i, end: close });
      i = close < 0 ? i + run : close;
      continue;
    }
    i++;
  }
  return ranges;
};

// A list item opener: inside a list, 4 spaces of indent continue the item,
// they do not start a code block.
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;
const INDENTED = /^(?: {4}|\t)/;

// Indented code blocks: lines indented by 4 spaces or a tab that start after a
// blank line (or the start of the text) outside a list, up to the next line
// that is neither blank nor indented.
const indentedCodeRanges = (text: string): Range[] => {
  const ranges: Range[] = [];
  let offset = 0;
  let prevBlank = true;
  let inList = false;
  let block: Range | null = null;
  for (const line of text.split("\n")) {
    const end = offset + line.length;
    const blank = line.trim() === "";
    const indented = !blank && INDENTED.test(line);
    if (block) {
      if (blank || indented) {
        if (indented) block.end = end;
      } else {
        ranges.push(block);
        block = null;
      }
    }
    if (!block && !blank) {
      if (indented && prevBlank && !inList) {
        block = { start: offset, end };
      } else if (LIST_ITEM.test(line)) {
        inList = true;
      } else if (!indented) {
        inList = false;
      }
    }
    prevBlank = blank;
    offset = end + 1;
  }
  if (block) ranges.push(block);
  return ranges;
};

// Raw HTML `<pre>` and `<code>` elements (an unclosed one runs to the end),
// then any other HTML tag or autolink: `<img alt="3**5">`,
// `<https://a.com/3**5>`, `<a@b.c>`. Quoted attribute values may hold `>`.
const HTML_CODE = /<(pre|code)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi;
const HTML_TAG_OR_AUTOLINK =
  /<(?:\/?[A-Za-z][A-Za-z0-9-]*(?:\s(?:[^>"']|"[^"]*"|'[^']*')*)?\/?|[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*|[^\s<>@]+@[^\s<>]+)>/g;
// Bare URLs, which GFM turns into links: `https://a.com/3**5`, `www.a.com/3**5`.
const BARE_URL = /\b(?:https?:\/\/|www\.)[^\s<>]*/gi;

const matchRanges = (text: string, pattern: RegExp): Range[] =>
  Array.from(text.matchAll(pattern), (m) => ({
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }));

export const escapePowerStars = (text: string): string => {
  if (!/\d\*\*\d/.test(text)) return text;
  const skip = [
    ...codeRanges(text),
    ...indentedCodeRanges(text),
    ...matchRanges(text, HTML_CODE),
    ...matchRanges(text, HTML_TAG_OR_AUTOLINK),
    ...matchRanges(text, BARE_URL),
    ...scanMath(text),
  ].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const { start, end } of skip) {
    if (end <= cursor) continue;
    if (start > cursor) out += text.slice(cursor, start).replace(POWER_STARS, "\\*\\*");
    out += text.slice(Math.max(start, cursor), end);
    cursor = end;
  }
  return out + text.slice(cursor).replace(POWER_STARS, "\\*\\*");
};
