/**
 * Mermaid configuration for the app theme (FEATURE_STREAMDOWN).
 *
 * Dark keeps Mermaid's own dark theme, as before the theme switch. Light uses
 * Mermaid's `base` theme with every colour read from the `index.css` tokens at
 * render time (docs/BRAND.md light rows): text Deep Space, edges and borders
 * Silver, nodes white like the cards, clusters and notes the Silver tint.
 * Mermaid computes derived shades from these values, so they must be real
 * colours, not `var()` references: they are read from the document root.
 */

import type { ResolvedTheme } from "./theme";

export type MermaidThemeConfig = {
  theme: string;
  themeVariables?: Record<string, string>;
};

/** Mermaid theme variable to the token that paints it in light. */
export const LIGHT_MERMAID_TOKENS: Readonly<Record<string, string>> = {
  // Text: Deep Space (natural-100 in light).
  primaryTextColor: "--color-natural-100",
  secondaryTextColor: "--color-natural-100",
  tertiaryTextColor: "--color-natural-100",
  textColor: "--color-natural-100",
  titleColor: "--color-natural-100",
  nodeTextColor: "--color-natural-100",
  noteTextColor: "--color-natural-100",
  actorTextColor: "--color-natural-100",
  signalTextColor: "--color-natural-100",
  labelTextColor: "--color-natural-100",
  loopTextColor: "--color-natural-100",
  // Edges, arrows and borders: Silver, the card edge (primary-400 in light).
  lineColor: "--color-primary-400",
  primaryBorderColor: "--color-primary-400",
  secondaryBorderColor: "--color-primary-400",
  tertiaryBorderColor: "--color-primary-400",
  nodeBorder: "--color-primary-400",
  clusterBorder: "--color-primary-400",
  noteBorderColor: "--color-primary-400",
  actorBorder: "--color-primary-400",
  actorLineColor: "--color-primary-400",
  signalColor: "--color-primary-400",
  labelBoxBorderColor: "--color-primary-400",
  // Surfaces: white like the cards (natural-900 in light).
  background: "--color-natural-900",
  mainBkg: "--color-natural-900",
  primaryColor: "--color-natural-900",
  edgeLabelBackground: "--color-natural-900",
  actorBkg: "--color-natural-900",
  labelBoxBkgColor: "--color-natural-900",
  // Second-level fills (clusters, notes, alternate nodes): the Silver tint.
  secondaryColor: "--color-highlight",
  tertiaryColor: "--color-highlight",
  clusterBkg: "--color-highlight",
  noteBkgColor: "--color-highlight",
};

const DARK_CONFIG: MermaidThemeConfig = { theme: "dark" };

/** A custom property of the document root, or "" without a document. */
export const readRootToken = (name: string): string =>
  typeof document === "undefined"
    ? ""
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * The Mermaid config for a resolved app theme. A token that reads empty is
 * left out, so Mermaid's `base` default fills it instead of an invalid colour.
 */
export const mermaidConfigFor = (
  theme: ResolvedTheme,
  readToken: (name: string) => string = readRootToken,
): MermaidThemeConfig => {
  if (theme === "dark") return DARK_CONFIG;
  const themeVariables: Record<string, string> = {};
  for (const [variable, token] of Object.entries(LIGHT_MERMAID_TOKENS)) {
    const value = readToken(token);
    if (value) themeVariables[variable] = value;
  }
  return { theme: "base", themeVariables };
};
