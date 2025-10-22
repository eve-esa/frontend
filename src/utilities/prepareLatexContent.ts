/**
 * Converts LaTeX delimiters from \( \) and \[ \] format to $ and $$ format
 * for proper rendering with react-markdown and remark-math
 */
export const prepareLatexContent = (content: string): string => {
  let processedContent = content.replace(/\\\[([\s\S]*?)\\\]/g, (_, latex) => {
    return `$$${latex}$$`;
  });
  processedContent = processedContent.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_, latex) => {
      return `$${latex}$`;
    }
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
