/**
 * Converts LaTeX delimiters from \( \) and \[ \] format to $ and $$ format
 * for proper rendering with react-markdown and remark-math
 */
export const prepareLatexContent = (content: string): string => {
  // Normalize escaped newlines from serialized sources so markdown and math blocks break correctly
  let processedContent = content.replace(/\\n/g, "\n");

  // Sanitize common LaTeX issues to avoid KaTeX parse errors
  const sanitizeLatex = (latex: string): string => {
    let s = latex;

    // Convert commands that require braced arguments when given with parentheses, e.g., \bar(u) -> \bar{u}
    const needsBraces = [
      "bar",
      "hat",
      "tilde",
      "vec",
      "overline",
      "underline",
      "mathrm",
      "mathit",
      "mathbf",
      "mathsf",
      "mathtt",
      "operatorname",
      "mathcal",
    ];
    const parenArgPattern = new RegExp(
      `\\\\(${needsBraces.join("|")})\\s*\\(([^()]+)\\)`,
      "g"
    );
    s = s.replace(parenArgPattern, (_m, name, arg) => `\\${name}{${arg}}`);

    // Remove unterminated \text{... at end of block
    s = s.replace(/\\text\{[^}]*$/g, "");

    // Balance unmatched braces to reduce parse failures
    const opens = (s.match(/\{/g) || []).length;
    const closes = (s.match(/\}/g) || []).length;
    if (opens > closes) {
      s += "}".repeat(opens - closes);
    }

    // Fix misuse of sizing/paired delimiter commands given with braced arguments, e.g., \bigg{(} -> \bigg(
    // KaTeX expects sizing commands to be followed directly by a delimiter token, not a grouped {token}
    const sizedCmdPattern =
      /(\\(?:big|Big|bigg|Bigg))\s*\{\s*(\\[a-zA-Z]+|\\.|\{|\}|[()\[\]\|])\s*\}/g;
    s = s.replace(sizedCmdPattern, (_m, cmd, tok) => {
      const token = tok === "{" || tok === "}" ? `\\${tok}` : tok;
      return `${cmd}${token}`;
    });

    // Also fix \left{token} and \right{token} -> \left token (e.g., \left{(} -> \left()
    const leftRightPattern =
      /(\\(?:left|right))\s*\{\s*(\\[a-zA-Z]+|\\.|\{|\}|[()\[\]\|])\s*\}/g;
    s = s.replace(leftRightPattern, (_m, cmd, tok) => {
      const token = tok === "{" || tok === "}" ? `\\${tok}` : tok;
      return `${cmd} ${token}`;
    });
    return s;
  };

  // Ensure display math becomes block $$ with surrounding newlines
  processedContent = processedContent.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_m, latex) => {
      const sanitized = sanitizeLatex(latex);
      return `\n\n$$\n${sanitized}\n$$\n\n`;
    }
  );

  // Inline math: convert \( ... \) to $...$, but if it contains \tag (display-only), promote to block $$
  processedContent = processedContent.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_m, latex) => {
      const sanitized = sanitizeLatex(latex);
      if (/\\tag\b/.test(sanitized)) {
        return `\n\n$$\n${sanitized}\n$$\n\n`;
      }
      return `$${sanitized}$`;
    }
  );

  // Sanitize already-present $$ ... $$ display math blocks
  processedContent = processedContent.replace(
    /\$\$([\s\S]*?)\$\$/g,
    (_m, latex) => `$$\n${sanitizeLatex(latex)}\n$$`
  );

  // Convert LaTeX tabular environments to GitHub-Flavored Markdown tables so
  // ReactMarkdown can render them properly in Sources. KaTeX does not support
  // tabular, so we need to transform it beforehand.
  const convertTabularToMarkdown = (body: string): string => {
    // Remove horizontal lines and normalize whitespace
    let cleaned = body.replace(/\\hline/g, " ").replace(/\r/g, "");

    // Normalize row separators:
    // - `\\` (double backslash)
    // - `\\\s` (backslash followed by space/newline)
    cleaned = cleaned.replace(/\\\\\s*/g, "\n").replace(/\\\s+/g, "\n");

    const rawRows = cleaned
      .split(/\n+/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    if (rawRows.length === 0) return body;

    const rows = rawRows.map((r) =>
      r.split("&").map((c) => c.replace(/\\&/g, "&").trim())
    );

    const maxCols = Math.max(...rows.map((r) => r.length));
    if (!isFinite(maxCols) || maxCols <= 0) return body;

    const pad = (arr: string[]) =>
      arr.concat(Array(Math.max(0, maxCols - arr.length)).fill(""));

    const header = pad(rows[0] ?? []);
    const mdLines: string[] = [];
    mdLines.push(`| ${header.join(" | ")} |`);
    mdLines.push(`| ${Array(maxCols).fill("---").join(" | ")} |`);
    for (let i = 1; i < rows.length; i++) {
      const r = pad(rows[i]);
      mdLines.push(`| ${r.join(" | ")} |`);
    }

    return mdLines.join("\n");
  };

  // Replace full table environments first (if present)
  processedContent = processedContent.replace(
    /\\begin\{table\}[\s\S]*?\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}[\s\S]*?\\end\{table\}/g,
    (_match, body) => `\n\n${convertTabularToMarkdown(body)}\n\n`
  );

  // Also handle bare tabular environments (without surrounding table)
  processedContent = processedContent.replace(
    /\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g,
    (_match, body) => `\n\n${convertTabularToMarkdown(body)}\n\n`
  );

  return processedContent;
};
