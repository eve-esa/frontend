import { useEffect, useMemo, useRef, useState } from "react";

type UseSmoothStreamOptions = {
  ratePerSecond?: number; // characters per second
  chunkSize?: number; // characters per tick
};

/**
 * Smoothes out uneven backend streaming by buffering new text and revealing it at a steady pace.
 * It assumes `sourceText` is append-only while streaming is active.
 */
// Module-level store to persist animation state across component remounts
type Persisted = {
  displayed: string;
  sourceLen: number;
  queue: string;
  lastTickMs?: number;
  budget?: number;
};
const PERSIST_STORE = new Map<string, Persisted>();

export const useSmoothStream = (
  sourceText: string,
  isActive: boolean,
  options?: UseSmoothStreamOptions,
  persistKey?: string
) => {
  const ratePerSecond = options?.ratePerSecond ?? 40; // default ~40 cps
  const chunkSize = Math.max(1, Math.floor(options?.chunkSize ?? 1));

  const intervalMs = useMemo(() => {
    const ms = 1000 / Math.max(1, ratePerSecond);
    return ms;
  }, [ratePerSecond]);

  const persisted = persistKey ? PERSIST_STORE.get(persistKey) : undefined;
  const [displayed, setDisplayed] = useState<string>(
    persisted ? persisted.displayed : isActive ? "" : sourceText
  );

  const sourceLenRef = useRef<number>(persisted ? persisted.sourceLen : sourceText.length);
  const queueRef = useRef<string>(persisted ? persisted.queue : "");
  // Persisted timing for smooth catch-up after unmounts or throttling
  const lastTickRef = useRef<number>(
    (persisted && typeof persisted.lastTickMs === "number" && persisted.lastTickMs) ||
      (typeof performance !== "undefined" ? performance.now() : Date.now())
  );
  const budgetRef = useRef<number>(persisted?.budget ?? 0);

  useEffect(() => {
    if (!persistKey) return;
    PERSIST_STORE.set(persistKey, {
      displayed,
      sourceLen: sourceLenRef.current,
      queue: queueRef.current,
      lastTickMs: lastTickRef.current,
      budget: budgetRef.current,
    });
  }, [persistKey, displayed]);

  // Do not flush on inactive; allow any remaining queued characters to finish animating.
  // Keep state as-is when isActive flips to false.
  useEffect(() => {
    if (isActive) return;
  }, [isActive]);

  // Whenever source grows, enqueue only the delta (even if inactive) so final chunks animate.
  useEffect(() => {
    const prevLen = sourceLenRef.current;
    const newLen = sourceText.length;
    if (newLen > prevLen) {
      queueRef.current += sourceText.slice(prevLen, newLen);
      sourceLenRef.current = newLen;
      if (persistKey) {
        PERSIST_STORE.set(persistKey, {
          displayed,
          sourceLen: sourceLenRef.current,
          queue: queueRef.current,
          lastTickMs: lastTickRef.current,
          budget: budgetRef.current,
        });
      }
    } else if (newLen < prevLen) {
      queueRef.current = "";
      sourceLenRef.current = newLen;
      setDisplayed((_) => sourceText.slice(0, 0));
      if (persistKey) {
        PERSIST_STORE.set(persistKey, {
          displayed: "",
          sourceLen: sourceLenRef.current,
          queue: queueRef.current,
          lastTickMs: lastTickRef.current,
          budget: budgetRef.current,
        });
      }
    }
  }, [sourceText]);

  // Reveal buffered characters at a steady pace regardless of active state
  // The interval is lightweight and only appends when there is a queue.
  useEffect(() => {
    const nowInit = typeof performance !== "undefined" ? performance.now() : Date.now();
    // On (re)mount, catch up by elapsed time since last tick so it looks continuous
    const elapsedOnMount = Math.max(0, nowInit - lastTickRef.current);
    const drainWithElapsed = (elapsedMs: number) => {
      if (queueRef.current.length === 0) return;
      budgetRef.current += (ratePerSecond * elapsedMs) / 1000;
      const maxBurst = Math.max(chunkSize * 50, 200);
      const toAppend = Math.min(queueRef.current.length, Math.floor(budgetRef.current), maxBurst);
      if (toAppend <= 0) return;
      const nextChunk = queueRef.current.slice(0, toAppend);
      queueRef.current = queueRef.current.slice(toAppend);
      budgetRef.current -= toAppend;
      setDisplayed((d) => d + nextChunk);
      if (persistKey) {
        PERSIST_STORE.set(persistKey, {
          displayed: (persistKey && PERSIST_STORE.get(persistKey)?.displayed
            ? PERSIST_STORE.get(persistKey)!.displayed + nextChunk
            : undefined) ?? "",
          sourceLen: sourceLenRef.current,
          queue: queueRef.current,
          lastTickMs: lastTickRef.current,
          budget: budgetRef.current,
        });
      }
    };

    if (elapsedOnMount > 0) {
      drainWithElapsed(elapsedOnMount);
    }
    lastTickRef.current = nowInit;

    const timer = setInterval(() => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsed = Math.max(0, now - lastTickRef.current);
      lastTickRef.current = now;
      drainWithElapsed(elapsed);
      if (persistKey) {
        PERSIST_STORE.set(persistKey, {
          displayed: PERSIST_STORE.get(persistKey)?.displayed ?? "",
          sourceLen: sourceLenRef.current,
          queue: queueRef.current,
          lastTickMs: lastTickRef.current,
          budget: budgetRef.current,
        });
      }
    }, intervalMs);

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        const elapsed = Math.max(0, now - lastTickRef.current);
        lastTickRef.current = now;
        drainWithElapsed(elapsed);
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [intervalMs, chunkSize, ratePerSecond, persistKey]);

  return displayed;
};


