import { redactString } from "./redact";

export type ConsoleEntry = {
  level: "error" | "warn";
  message: string;
  at: string;
};

export const CONSOLE_RING_SIZE = 20;
const MAX_ENTRY_LENGTH = 2000;

/** Fixed size buffer that keeps the newest `size` entries, oldest first. */
export class RingBuffer<T> {
  private readonly items: T[] = [];

  constructor(private readonly size: number) {}

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.size) {
      this.items.splice(0, this.items.length - this.size);
    }
  }

  snapshot(): T[] {
    return [...this.items];
  }

  clear(): void {
    this.items.length = 0;
  }
}

const stringify = (arg: unknown): string => {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
};

/** One console call as a redacted, clipped buffer entry. */
export const toConsoleEntry = (
  level: ConsoleEntry["level"],
  args: unknown[],
  now: Date = new Date(),
): ConsoleEntry => ({
  level,
  message: redactString(args.map(stringify).join(" ")).slice(
    0,
    MAX_ENTRY_LENGTH,
  ),
  at: now.toISOString(),
});

const ring = new RingBuffer<ConsoleEntry>(CONSOLE_RING_SIZE);
let installed = false;

/**
 * Wraps console.error and console.warn so the last entries are available to a
 * bug report. The original methods still run first and unchanged; a failure
 * while buffering is swallowed.
 */
export const installConsoleRing = (target: Console = console): void => {
  if (installed) return;
  installed = true;
  for (const level of ["error", "warn"] as const) {
    const original = target[level].bind(target);
    target[level] = (...args: unknown[]) => {
      original(...args);
      try {
        ring.push(toConsoleEntry(level, args));
      } catch {
        // Never let buffering break logging.
      }
    };
  }
};

/** The newest console errors and warnings, oldest first, already redacted. */
export const getRecentConsoleErrors = (): ConsoleEntry[] => ring.snapshot();
