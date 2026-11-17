/** A hand-written Python tokenizer for the sandbox step: enough to colour
 * keywords, strings, numbers and comments; everything else stays plain. */
export type CodeTokenKind = "keyword" | "string" | "number" | "comment" | "plain";
export type CodeToken = { kind: CodeTokenKind; text: string };

const KEYWORDS: ReadonlySet<string> = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class",
  "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global",
  "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
  "return", "try", "while", "with", "yield",
]);

// Order matters: comments and strings before words, so a "#" or a quote
// inside one never starts another token. Triple quotes before single ones.
const TOKEN_RE =
  /(#[^\n]*)|([rbfRBF]{0,2}(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?))|(\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([A-Za-z_]\w*)/g;

export const tokenizePython = (code: string): CodeToken[] => {
  const tokens: CodeToken[] = [];
  const push = (kind: CodeTokenKind, text: string) => {
    if (!text) return;
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind && kind === "plain") last.text += text;
    else tokens.push({ kind, text });
  };
  let at = 0;
  for (const match of code.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    push("plain", code.slice(at, index));
    const [text, comment, string, number, word] = match;
    if (comment) push("comment", text);
    else if (string) push("string", text);
    else if (number) push("number", text);
    else if (word) push(KEYWORDS.has(word) ? "keyword" : "plain", text);
    at = index + text.length;
  }
  push("plain", code.slice(at));
  return tokens;
};

/** The sandbox footer line "[Command succeeded with exit code N]" (or failed)
 * taken off the output, with its exit code; null code when absent. */
export const splitExitCode = (output: string): { body: string; exitCode: number | null } => {
  const match = /\n*\[Command (?:succeeded|failed) with exit code (-?\d+)\]\s*$/.exec(output);
  if (!match) return { body: output, exitCode: null };
  return { body: output.slice(0, match.index).replace(/\s+$/, ""), exitCode: Number(match[1]) };
};

/** JSON token kinds, coloured with the trace panel's JSON tokens. */
export type JsonTokenKind = "key" | "string" | "number" | "boolean" | "null" | "plain";
export type JsonToken = { kind: JsonTokenKind; text: string };

// A string followed by a colon is a key; then strings, numbers, literals.
const JSON_RE = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|\b(true|false)\b|\b(null)\b/g;

/** Tokens of JSON text (`JSON.stringify` output); the text joins back unchanged. */
export const highlightJson = (text: string): JsonToken[] => {
  const tokens: JsonToken[] = [];
  const push = (kind: JsonTokenKind, part: string) => {
    if (!part) return;
    const last = tokens[tokens.length - 1];
    if (last && last.kind === "plain" && kind === "plain") last.text += part;
    else tokens.push({ kind, text: part });
  };
  let at = 0;
  for (const match of text.matchAll(JSON_RE)) {
    const index = match.index ?? 0;
    push("plain", text.slice(at, index));
    const [whole, string, colon, number, bool, nul] = match;
    if (string) {
      push(colon ? "key" : "string", string);
      if (colon) push("plain", colon);
    } else if (number) push("number", number);
    else if (bool) push("boolean", bool);
    else if (nul) push("null", nul);
    at = index + whole.length;
  }
  push("plain", text.slice(at));
  return tokens;
};

/** One stream of a sandbox output. */
export type SandboxStream = { stream: "stdout" | "stderr"; text: string };

const STREAM_RE = /<(stdout|stderr)>([\s\S]*?)(?:<\/\1>|$)/g;

/** Blank lines out, edges trimmed: the sandbox doubles every line break. */
const tidy = (text: string): string =>
  text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n");

/**
 * The output of a sandbox command split into its streams. The sandbox wraps
 * them in `<stdout>` and `<stderr>`; the wrappers go, blank lines go, empty
 * streams go. Output with no wrapper is stdout.
 */
export const sandboxStreams = (output: string): SandboxStream[] => {
  const streams: SandboxStream[] = [];
  let at = 0;
  const pushPlain = (text: string) => {
    const clean = tidy(text);
    if (clean) streams.push({ stream: "stdout", text: clean });
  };
  for (const match of output.matchAll(STREAM_RE)) {
    pushPlain(output.slice(at, match.index ?? 0));
    const clean = tidy(match[2]);
    if (clean) streams.push({ stream: match[1] as SandboxStream["stream"], text: clean });
    at = (match.index ?? 0) + match[0].length;
  }
  pushPlain(output.slice(at));
  return streams;
};
