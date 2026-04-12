interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

/**
 * Memoize a synchronous loader for a fixed TTL to avoid repeating expensive read-only work.
 */
export function memoizeForTtl<T>(ttlMs: number, load: () => T): () => T {
  let entry: CacheEntry<T> | null = null;

  return () => {
    const now = Date.now();
    if (entry && entry.expiresAt > now) {
      return entry.value;
    }

    const value = load();
    entry = {
      value,
      expiresAt: now + ttlMs,
    };

    return value;
  };
}
