/**
 * Quote flowchart node labels that Mermaid cannot parse unquoted.
 *
 * Models often write `E[Divide (NIR - Red) by (NIR + Red)]`: an unquoted label
 * with parentheses, brackets, braces, quotes, pipes or semicolons is a parse
 * error. This turns it into `E["Divide (NIR - Red) by (NIR + Red)"]`, with
 * inner double quotes escaped as `#quot;`, for the shapes `[]`, `()`, `{}`,
 * `[[ ]]` and `(( ))`. Other diagram types, other shapes (`[( )]`, `([ ])`,
 * `{{ }}`, `[/ /]`, `((( )))`), already quoted labels and labels without those
 * characters are left as written. A label whose brackets never balance is left
 * too: the diagram then fails and the answer shows its source.
 */

const NEEDS_QUOTES = /[()[\]{}"|;]/;
const CLOSER: Record<string, string> = { "[": "]", "(": ")", "{": "}" };
// Lines that hold no node definitions.
const SKIP_LINE = /^\s*(%%|classDef\b|class\b|style\b|linkStyle\b|click\b|direction\b)/;
// Shapes left alone: their opener starts like one of the handled ones.
const OTHER_SHAPES = ["(((", "[(", "([", "{{", "[/", "[\\"];

const isFlowchart = (source: string): boolean => {
  let inFrontmatter = false;
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (line === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter || line === "" || line.startsWith("%%")) continue;
    return /^(flowchart|graph)\b/i.test(line);
  }
  return false;
};

/** End index (exclusive) of a shape opened at `start`, or -1 if unbalanced. */
const shapeEnd = (line: string, start: number, open: string, width: number): number => {
  const close = CLOSER[open];
  let depth = width;
  for (let i = start + width; i < line.length; i++) {
    if (line[i] === open) depth++;
    else if (line[i] === close && --depth === 0) return i + 1;
  }
  return -1;
};

const quoteLabel = (label: string): string => {
  const trimmed = label.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) return label;
  if (!NEEDS_QUOTES.test(label)) return label;
  return `"${trimmed.replace(/"/g, "#quot;")}"`;
};

const sanitizeLine = (line: string): string => {
  let out = "";
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    // Quoted text and edge labels (`-->|text|`) are copied as they are.
    if (ch === '"' || ch === "|") {
      const end = line.indexOf(ch, i + 1);
      const stop = end === -1 ? line.length : end + 1;
      out += line.slice(i, stop);
      i = stop;
      continue;
    }
    const id = /^[A-Za-z0-9_]+/.exec(line.slice(i));
    const startsWord = i === 0 || !/[A-Za-z0-9_]/.test(line[i - 1]);
    if (!id || !startsWord) {
      out += ch;
      i++;
      continue;
    }
    const after = i + id[0].length;
    out += id[0];
    i = after;
    const open = line[after];
    if (!(open in CLOSER) || OTHER_SHAPES.some((s) => line.startsWith(s, after))) continue;
    const width = line[after + 1] === open && open !== "{" ? 2 : 1;
    const end = shapeEnd(line, after, open, width);
    if (end === -1 || line.slice(end - width, end) !== CLOSER[open].repeat(width)) continue;
    const label = line.slice(after + width, end - width);
    out += open.repeat(width) + quoteLabel(label) + CLOSER[open].repeat(width);
    i = end;
  }
  return out;
};

export const sanitizeMermaid = (source: string): string => {
  if (!isFlowchart(source)) return source;
  let header = true;
  let inFrontmatter = false;
  return source
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (header) {
        if (trimmed === "---") inFrontmatter = !inFrontmatter;
        else if (!inFrontmatter && /^(flowchart|graph)\b/i.test(trimmed)) header = false;
        return line;
      }
      return SKIP_LINE.test(line) ? line : sanitizeLine(line);
    })
    .join("\n");
};

// One opening <a> tag; quoted attribute values may hold `>`.
const ANCHOR_OPEN = /<a\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/gi;
const TARGET_OR_REL = /\s(?:target|rel)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+)/gi;

/**
 * Make every link in a rendered diagram open in a new tab.
 *
 * With `securityLevel: "strict"` Mermaid disables click callbacks and passes
 * URLs through its sanitizer, but `click A "https://..."` (or a `_self` target)
 * still becomes an SVG `<a>` that replaces the app in the same tab. The
 * diagram text can come from the model, a source document or a tool, so every
 * anchor gets `target="_blank"` and `rel="noopener noreferrer"`, whatever the
 * diagram asked for.
 */
export const hardenMermaidSvg = (svg: string): string =>
  svg.replace(ANCHOR_OPEN, (_tag, attrs: string, selfClose: string) => {
    const kept = attrs.replace(TARGET_OR_REL, "");
    return `<a${kept} target="_blank" rel="noopener noreferrer"${selfClose}>`;
  });
