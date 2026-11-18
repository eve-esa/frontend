import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LIGHT_MERMAID_TOKENS, mermaidConfigFor, readRootToken } from "./mermaidTheme";

const css = readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
const lightBlock = css.slice(css.indexOf(':root[data-theme="light"] {'));
// The light value of a token, as index.css declares it.
const lightToken = (name: string) =>
  new RegExp(`${name}:\\s*([^;]+);`).exec(lightBlock)?.[1].trim() ?? "";

describe("mermaidConfigFor", () => {
  it("keeps Mermaid's dark theme in dark, without reading tokens", () => {
    const read = () => {
      throw new Error("dark must not read tokens");
    };
    expect(mermaidConfigFor("dark", read)).toEqual({ theme: "dark" });
    expect(mermaidConfigFor("dark", read)).toBe(mermaidConfigFor("dark", read));
  });

  it("paints light diagrams with the light tokens: Deep Space text, Silver edges, white nodes", () => {
    const { theme, themeVariables } = mermaidConfigFor("light", lightToken);
    expect(theme).toBe("base");
    expect(themeVariables?.primaryTextColor).toBe("#003247");
    expect(themeVariables?.textColor).toBe("#003247");
    expect(themeVariables?.lineColor).toBe("#8197a6");
    expect(themeVariables?.primaryBorderColor).toBe("#8197a6");
    expect(themeVariables?.primaryColor).toBe("#ffffff");
    expect(themeVariables?.clusterBkg).toBe("#e8ecef");
  });

  it("uses only tokens the light theme declares, so no variable is left without a value", () => {
    for (const token of new Set(Object.values(LIGHT_MERMAID_TOKENS))) {
      expect(lightToken(token), token).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("leaves out a token that reads empty instead of passing an invalid colour", () => {
    const { themeVariables } = mermaidConfigFor("light", (name) =>
      name === "--color-natural-100" ? "" : "#ffffff",
    );
    expect(themeVariables).not.toHaveProperty("textColor");
    expect(themeVariables?.lineColor).toBe("#ffffff");
  });

  it("reads nothing without a document", () => {
    expect(readRootToken("--color-natural-100")).toBe("");
  });
});
