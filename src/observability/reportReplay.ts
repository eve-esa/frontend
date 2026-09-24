import { resolveTelemetryConfig, startReplayOnDemand } from "./telemetry";

/**
 * How long a "Report a bug" click waits for the on demand replay to start
 * before the dialog opens anyway.
 */
export const REPLAY_START_TIMEOUT_MS = 1000;

/**
 * Opens the bug report dialog. In the `on_demand` privacy mode it first starts
 * the session replay, so the recording that replaces a screenshot covers what
 * the user does from here on, and waits at most `timeoutMs` for it: a slow or
 * failed start never keeps the dialog closed. In the other modes the replay
 * is already on (or off by choice) and `open` runs right away.
 */
export const openBugReport = async (
  open: () => void,
  timeoutMs: number = REPLAY_START_TIMEOUT_MS,
): Promise<void> => {
  try {
    if (resolveTelemetryConfig()?.privacyMode === "on_demand") {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        startReplayOnDemand().catch(() => false),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, timeoutMs);
        }),
      ]);
      clearTimeout(timer);
    }
  } catch {
    // Telemetry never keeps the dialog closed.
  }
  open();
};
