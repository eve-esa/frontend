/**
 * Theme choice and resolution (FEATURE_THEME_SWITCH).
 *
 * The user picks System, Light or Dark; System follows `prefers-color-scheme`. The resolved
 * theme lands on `<html data-theme>`, which switches the token block in `index.css`, and on
 * `color-scheme`, which themes native controls. the inline script in `index.html` does the same before the
 * bundle runs, with the same storage key and the same rules: keep the two in step.
 */

import { LOCAL_STORAGE_THEME } from "./localStorage";

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

/** Matches when the operating system asks for a light theme. */
export const PREFERS_LIGHT_QUERY = "(prefers-color-scheme: light)";

/** A stored value, or System for anything missing or unknown. */
export const parseThemeChoice = (raw: string | null | undefined): ThemeChoice =>
  THEME_CHOICES.includes(raw as ThemeChoice) ? (raw as ThemeChoice) : "system";

export const resolveTheme = (
  choice: ThemeChoice,
  prefersLight: boolean
): ResolvedTheme => {
  if (choice === "system") return prefersLight ? "light" : "dark";
  return choice;
};

// Storage can be missing or throw (private mode, blocked site data): the
// choice then lasts for the session.
export const readThemeChoice = (storage: Storage | undefined): ThemeChoice => {
  try {
    return parseThemeChoice(storage?.getItem(LOCAL_STORAGE_THEME));
  } catch {
    return "system";
  }
};

export const writeThemeChoice = (
  storage: Storage | undefined,
  choice: ThemeChoice
): void => {
  try {
    storage?.setItem(LOCAL_STORAGE_THEME, choice);
  } catch {
    // Not persisted; the in-memory choice still applies.
  }
};

/** The subset of `HTMLElement` the theme writes to. */
export type ThemeRoot = {
  dataset: DOMStringMap;
  style: { colorScheme: string };
};

export const applyTheme = (root: ThemeRoot, theme: ResolvedTheme): void => {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};
