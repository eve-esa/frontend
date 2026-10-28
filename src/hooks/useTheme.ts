import { useSyncExternalStore } from "react";
import { THEME_SWITCH_ENABLED } from "@/utilities/features";
import {
  applyTheme,
  PREFERS_LIGHT_QUERY,
  readThemeChoice,
  resolveTheme,
  writeThemeChoice,
  type ResolvedTheme,
  type ThemeChoice,
} from "@/utilities/theme";

type ThemeState = { choice: ThemeChoice; resolved: ResolvedTheme };

// Flag off: the app is dark and nothing is written to the document.
const FLAG_OFF_STATE: ThemeState = { choice: "dark", resolved: "dark" };

// One store for the whole app, so the profile menu and the toaster agree
// without a provider.
let state: ThemeState | null = null;
const listeners = new Set<() => void>();

const storage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

// One MediaQueryList for the app, so the listener added on subscribe is the
// one removed on unsubscribe. Created on first use: node tests have no window.
let prefersLightQuery: MediaQueryList | null | undefined;
const prefersLight = (): MediaQueryList | null => {
  if (prefersLightQuery === undefined) {
    prefersLightQuery =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(PREFERS_LIGHT_QUERY)
        : null;
  }
  return prefersLightQuery;
};

const compute = (choice: ThemeChoice): ThemeState => ({
  choice,
  resolved: resolveTheme(choice, prefersLight()?.matches ?? false),
});

const getState = (): ThemeState => {
  if (!state) state = compute(readThemeChoice(storage()));
  return state;
};

// The OS listener runs only while someone is mounted and the choice is System.
let listening = false;
const syncSystemListener = () => {
  const want = listeners.size > 0 && getState().choice === "system";
  if (want === listening) return;
  listening = want;
  const query = prefersLight();
  if (want) query?.addEventListener("change", onSystemChange);
  else query?.removeEventListener("change", onSystemChange);
};

const publish = (next: ThemeState) => {
  state = next;
  applyTheme(document.documentElement, next.resolved);
  syncSystemListener();
  listeners.forEach((listener) => listener());
};

// System follows the operating system while the app is open.
function onSystemChange() {
  if (getState().choice === "system") publish(compute("system"));
}

const subscribe = (listener: () => void) => {
  const first = listeners.size === 0;
  listeners.add(listener);
  if (first) {
    // The inline script in index.html already set the attribute; apply again
    // in case it could not run (blocked script, stale cached index.html).
    publish(compute(getState().choice));
  }
  return () => {
    listeners.delete(listener);
    syncSystemListener();
  };
};

const unsubscribeFlagOff = () => undefined;
const subscribeFlagOff = () => unsubscribeFlagOff;
const getFlagOffState = () => FLAG_OFF_STATE;

const setChoice = (choice: ThemeChoice) => {
  if (!THEME_SWITCH_ENABLED) return;
  writeThemeChoice(storage(), choice);
  publish(compute(choice));
};

/**
 * The theme the user chose (System, Light, Dark) and the one in effect. With
 * FEATURE_THEME_SWITCH off it is always dark and `setChoice` does nothing.
 */
export const useTheme = () => {
  const current = useSyncExternalStore(
    THEME_SWITCH_ENABLED ? subscribe : subscribeFlagOff,
    THEME_SWITCH_ENABLED ? getState : getFlagOffState,
    // Server render (tests): no window to read, dark like the flag off.
    getFlagOffState
  );
  return {
    enabled: THEME_SWITCH_ENABLED,
    choice: current.choice,
    resolved: current.resolved,
    setChoice,
  };
};
