type CacheEntry = {
  expiresAt: number;
  value: string;
};

const cache = new Map<string, CacheEntry>();

export async function cacheJson<T>(key: string, ttlSeconds: number, loader: () => Promise<T>) {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return JSON.parse(cached.value) as T;
  }

  const value = await loader();
  cache.set(key, {
    expiresAt: Date.now() + ttlSeconds * 1000,
    value: JSON.stringify(value)
  });
  return value;
}

export async function readCacheJson<T>(key: string) {
  const cached = cache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return JSON.parse(cached.value) as T;
}

export async function writeCacheJson(key: string, value: unknown, ttlSeconds: number) {
  cache.set(key, {
    expiresAt: Date.now() + ttlSeconds * 1000,
    value: JSON.stringify(value)
  });
}

export async function deleteCacheKeys(keys: string[]) {
  for (const key of keys) cache.delete(key);
}
