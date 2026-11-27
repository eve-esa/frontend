import { useSyncExternalStore } from "react";

// A turn whose new files did not fit the user's storage ends normally; the
// backend says so once with a `notice` frame (code storage_quota_exceeded,
// with the counter and the cap) and again in `final.notices`. The composer
// shows one line per conversation until the user dismisses it or frees space.

export type StorageNotice = {
  /** The counter when the backend refused, when the frame carried it. */
  usedBytes?: number;
  maxBytes?: number;
  /** When this conversation's notice was last set. An older usage refetch does not clear it. */
  setAt: number;
};

const notices = new Map<string, StorageNotice>();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const getStorageNotice = (conversationId: string): StorageNotice | null =>
  notices.get(conversationId) ?? null;

/** Keeps known byte counts when a later signal (`final.notices`) carries none. */
export const setStorageNotice = (
  conversationId: string,
  next: Partial<StorageNotice> = {},
) => {
  const prev = notices.get(conversationId);
  notices.set(conversationId, {
    usedBytes: next.usedBytes ?? prev?.usedBytes,
    maxBytes: next.maxBytes ?? prev?.maxBytes,
    setAt: next.setAt ?? Date.now(),
  });
  emit();
};

export const clearStorageNotice = (conversationId?: string) => {
  if (conversationId === undefined) {
    if (notices.size === 0) return;
    notices.clear();
  } else if (!notices.delete(conversationId)) {
    return;
  }
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useStorageNotice = (
  conversationId?: string,
): StorageNotice | null => {
  const read = () => (conversationId ? getStorageNotice(conversationId) : null);
  return useSyncExternalStore(subscribe, read, read);
};

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** The byte counts of a `notice` frame, tolerating a frame without them. */
export const storageNoticeFromFrame = (
  evt: Record<string, unknown>,
): Pick<StorageNotice, "usedBytes" | "maxBytes"> => ({
  usedBytes: finiteNumber(evt.used_bytes),
  maxBytes: finiteNumber(evt.max_bytes),
});
