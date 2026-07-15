/** Simple in-memory TTL cache for read-heavy API responses (per serverless instance). */

const store = new Map();

/**
 * @param {string} key
 * @param {() => Promise<T>} loader
 * @param {number} ttlMs
 * @template T
 * @returns {Promise<T>}
 */
export async function cached(key, loader, ttlMs = 300_000) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** @param {string} key */
export function invalidateCache(key) {
  store.delete(key);
}

/** @param {string} [prefix] */
export function invalidateCachePrefix(prefix) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
