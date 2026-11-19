/**
 * A deploy flips the release pointer and the old hashed chunks are gone. A tab
 * opened before the flip asks for a chunk the edge no longer has (403) the next
 * time it lazy-loads something. The fix is a reload, which fetches the new
 * index.html and its chunks. Vite fires `vite:preloadError` for these; a lazy
 * route or component that fails to import throws the same family of errors.
 */

const GUARD_KEY = "eve:stale-chunk-reload-at";

/** No second reload inside this window: a chunk that is still missing after a
 *  reload must show the error page, not loop. */
export const RELOAD_GUARD_MS = 10_000;

const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

/** Chrome, Firefox and Safari word a failed dynamic import differently. */
export const isChunkLoadError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return CHUNK_ERROR_PATTERN.test(message);
};

type GuardStorage = Pick<Storage, "getItem" | "setItem">;

const defaultStorage = (): GuardStorage | null => {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
};

/**
 * Reloads the page unless it already did so within RELOAD_GUARD_MS. Returns
 * whether a reload was started. Storage that throws (private mode, blocked
 * cookies) is treated as "no record" for the read and the write is skipped, so
 * the worst case is one reload per page load, never a loop inside one page.
 */
export const reloadOnce = (
  reload: () => void = () => window.location.reload(),
  storage: GuardStorage | null = defaultStorage(),
  now: number = Date.now(),
): boolean => {
  try {
    const last = Number(storage?.getItem(GUARD_KEY));
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_GUARD_MS) {
      return false;
    }
  } catch {
    // unreadable storage: fall through
  }
  try {
    storage?.setItem(GUARD_KEY, String(now));
  } catch {
    // unwritable storage: still reload once
  }
  reload();
  return true;
};

/**
 * Listens to `vite:preloadError`. When the reload starts the error is
 * swallowed (the page is going away); inside the guard window it is left to
 * throw so the router error page shows.
 */
export const installPreloadErrorHandler = (
  target: EventTarget = window,
  reload?: () => void,
  storage?: GuardStorage | null,
): void => {
  target.addEventListener("vite:preloadError", (event) => {
    if (reloadOnce(reload, storage)) event.preventDefault();
  });
};
