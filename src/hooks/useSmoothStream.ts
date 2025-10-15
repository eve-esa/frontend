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
type Persisted = { displayed: string; sourceLen: number; queue: string };
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

  useEffect(() => {
    if (!persistKey) return;
    PERSIST_STORE.set(persistKey, {
      displayed,
      sourceLen: sourceLenRef.current,
      queue: queueRef.current,
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
        });
      }
    }
  }, [sourceText]);

  // Reveal buffered characters at a steady pace regardless of active state
  // The interval is lightweight and only appends when there is a queue.
  useEffect(() => {
    const timer = setInterval(() => {
      if (queueRef.current.length === 0) return;
      const take = Math.min(chunkSize, queueRef.current.length);
      const nextChunk = queueRef.current.slice(0, take);
      queueRef.current = queueRef.current.slice(take);
      setDisplayed((d) => d + nextChunk);
      if (persistKey) {
        PERSIST_STORE.set(persistKey, {
          displayed: (persistKey && PERSIST_STORE.get(persistKey)?.displayed
            ? PERSIST_STORE.get(persistKey)!.displayed + nextChunk
            : undefined) ?? "",
          sourceLen: sourceLenRef.current,
          queue: queueRef.current,
        });
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs, chunkSize]);

  return displayed;
};


