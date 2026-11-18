import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Streamdown's components carry shadcn colour utilities (bg-muted,
// border-border, ...) that this app has no tokens for. index.css maps each
// one to an existing token under `.streamdown`. This test reads the classes
// from the installed package, so an upgrade that adds one fails here.
const SHADCN_TOKENS = [
  "border", "muted", "muted-foreground", "foreground", "background", "sidebar",
  "primary", "primary-foreground", "secondary", "secondary-foreground", "accent",
  "accent-foreground", "destructive", "destructive-foreground", "ring", "input",
  "card", "card-foreground", "popover", "popover-foreground",
].join("|");
const COLOUR_CLASS = new RegExp(
  String.raw`(?<![\w-])(?:[a-z0-9\[\]&_:>.*()=-]+:)*` +
    String.raw`(?:bg|text|border|border-[trblxy]|ring|ring-offset|outline|fill|stroke|divide|from|to|via|decoration|shadow|placeholder|caret|accent)` +
    `-(?:${SHADCN_TOKENS})` +
    String.raw`(?:/\d+)?(?![\w-])`,
  "g",
);

const distDir = path.resolve("node_modules/streamdown/dist");
const dist = readdirSync(distDir)
  .filter((file) => file.endsWith(".js"))
  .map((file) => readFileSync(path.join(distDir, file), "utf8"))
  .join("\n");
const css = readFileSync(path.resolve(__dirname, "../../index.css"), "utf8");
const blockStart = css.indexOf("/* Streamdown's own colour utilities");
const block = css.slice(blockStart, css.indexOf("/* JSON tree (", blockStart));

const escapeClass = (name: string) => name.replace(/[:/[\]]/g, (c) => `\\${c}`);
const streamdownClasses = [...new Set(dist.match(COLOUR_CLASS) ?? [])].sort();

describe("Streamdown colour classes", () => {
  it("finds the classes in the installed package", () => {
    expect(streamdownClasses).toContain("bg-muted");
    expect(streamdownClasses).toContain("border-border");
  });

  it.each(streamdownClasses)("%s is mapped under .streamdown", (name) => {
    expect(block).toContain(`.streamdown .${escapeClass(name)}`);
  });

  it("maps only to tokens the dark theme defines", () => {
    const used = [...new Set([...block.matchAll(/var\((--color-[\w-]+)\)/g)].map((m) => m[1]))];
    expect(used.length).toBeGreaterThan(0);
    const theme = css.slice(css.indexOf("@theme {"), css.indexOf("/* Custom breakpoints */"));
    for (const token of used) expect(theme, token).toContain(`${token}:`);
  });

  it("sets no literal colour", () => {
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\(/i);
  });
});
