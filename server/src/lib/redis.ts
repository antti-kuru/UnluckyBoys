import { Redis } from "ioredis";
import { config } from "../config.js";

export const redis = new Redis(config.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 2
});

redis.on("error", (error: Error) => {
  console.warn("Redis unavailable:", error.message);
});

export async function cacheJson<T>(key: string, ttlSeconds: number, loader: () => Promise<T>) {
  try {
    if (redis.status === "wait") {
      await redis.connect();
    }
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    const value = await loader();
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    return value;
  } catch {
    return loader();
  }
}
