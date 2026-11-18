/**
 * Finds the formulas of an answer (after prepareLatexContent) so StreamdownText
 * can swap them for a placeholder: while the math chunk loads, and while a turn
 * streams a formula whose closing delimiter has not arrived yet. Code fences and
 * inline code are skipped, so a `$` in code is never taken for math.
 */

export type MathKind = "display" | "inline";

export type MathSegment = {
  start: number;
  /** Exclusive. An unclosed segment runs to the end of the text. */
  end: number;
  kind: MathKind;
  closed: boolean;
};

// Raw HTML the sanitizer keeps (className is allowed on every tag); the `span`
// component of StreamdownText turns it into the placeholder element.
export const MATH_PENDING_CLASS = "eve-math-pending";
export const MATH_PENDING_DISPLAY_CLASS = "eve-math-pending-display";
const INLINE_PLACEHOLDER = `<span class="${MATH_PENDING_CLASS}"></span>`;
const DISPLAY_PLACEHOLDER = `<span class="${MATH_PENDING_CLASS} ${MATH_PENDING_DISPLAY_CLASS}"></span>`;

export const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const BLANK_LINE = /^\n[ \t]*\n/;

const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

export const closingFence = (text: string, from: number, fence: string): number => {
  const re = new RegExp(`\\n {0,3}${fence[0]}{${fence.length},}[ \\t]*(?=\\n|$)`, "g");
  re.lastIndex = from;
  const match = re.exec(text);
  return match ? match.index + match[0].length : -1;
};

export const closingBackticks = (text: string, from: number, run: number): number => {
  const re = new RegExp(`(?<!\`)\`{${run}}(?!\`)`, "g");
  re.lastIndex = from;
  const match = re.exec(text);
  return match ? match.index + run : -1;
};

export const scanMath = (text: string): MathSegment[] => {
  const segments: MathSegment[] = [];
  const n = text.length;
  let i = 0;
  let lineStart = true;

  while (i < n) {
    if (lineStart) {
      const fence = FENCE_OPEN.exec(text.slice(i, i + 40));
      if (fence) {
        const close = closingFence(text, i + fence[0].length, fence[1]);
        if (close < 0) return segments; // the rest of the text is code
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

    if (c === "`") {
      let run = 1;
      while (text[i + run] === "`") run++;
      const close = closingBackticks(text, i + run, run);
      i = close < 0 ? i + run : close;
      continue;
    }

    if (c === "\\") {
      const next = text[i + 1];
      if (next === "[" || next === "(") {
        const kind: MathKind = next === "[" ? "display" : "inline";
        const close = text.indexOf(next === "[" ? "\\]" : "\\)", i + 2);
        if (close < 0) {
          segments.push({ start: i, end: n, kind, closed: false });
          return segments;
        }
        segments.push({ start: i, end: close + 2, kind, closed: true });
        i = close + 2;
        continue;
      }
      i += 2; // an escaped character, `\$` included
      continue;
    }

    if (c === "$") {
      if (text[i + 1] === "$") {
        const close = text.indexOf("$$", i + 2);
        if (close < 0) {
          segments.push({ start: i, end: n, kind: "display", closed: false });
          return segments;
        }
        segments.push({ start: i, end: close + 2, kind: "display", closed: true });
        i = close + 2;
        continue;
      }
      // Inline math opens only on a `$` followed by a non-space (the pandoc
      // rule), so "costs $ 5" is never held back.
      if (isSpace(text[i + 1])) {
        i++;
        continue;
      }
      let j = i + 1;
      let close = -1;
      while (j < n) {
        const d = text[j];
        if (d === "\\") {
          j += 2;
          continue;
        }
        if (d === "\n" && BLANK_LINE.test(text.slice(j, j + 8))) break;
        if (d === "$") {
          close = j;
          break;
        }
        j++;
      }
      if (close >= 0) {
        segments.push({ start: i, end: close + 1, kind: "inline", closed: true });
        i = close + 1;
        continue;
      }
      if (j >= n) {
        segments.push({ start: i, end: n, kind: "inline", closed: false });
        return segments;
      }
      i++; // the paragraph ended first: a literal dollar
      continue;
    }

    i++;
  }
  return segments;
};

/**
 * Replaces formulas with a placeholder: a closed one while the math plugin is
 * not loaded, an unclosed one while the turn streams (its delimiter may still
 * arrive). A finished answer keeps an unclosed formula as text: hiding it would
 * lose content.
 */
export const withMathPlaceholders = (
  text: string,
  segments: MathSegment[],
  { streaming, mathReady }: { streaming: boolean; mathReady: boolean },
): string => {
  let out = "";
  let cursor = 0;
  for (const segment of segments) {
    const keep = segment.closed ? mathReady : !streaming;
    if (keep) continue;
    out += text.slice(cursor, segment.start);
    out += segment.kind === "display" ? DISPLAY_PLACEHOLDER : INLINE_PLACEHOLDER;
    cursor = segment.end;
  }
  return cursor === 0 ? text : out + text.slice(cursor);
};
