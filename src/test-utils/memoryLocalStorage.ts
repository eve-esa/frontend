import { vi } from "vitest";

/**
 * Minimal in-memory Storage for vitest's plain Node environment (see
 * vitest.config.ts): enough of the Web Storage API for the utilities that
 * read and write localStorage directly.
 */
export class MemoryLocalStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

/** Install a fresh in-memory localStorage on globalThis and return it. */
export const installMemoryLocalStorage = (): MemoryLocalStorage => {
  const storage = new MemoryLocalStorage();
  vi.stubGlobal("localStorage", storage);
  return storage;
};
