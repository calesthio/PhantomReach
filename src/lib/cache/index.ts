/**
 * Cache manager that uses Upstash Redis or falls back to in-memory cache
 */

import { redisGet, redisSet, redisDel, isRedisConfigured } from "./redis";
import { memoryCache } from "./memory";

// Default TTL: 1 hour
const DEFAULT_TTL_SECONDS = 3600;

class CacheManager {
  private useRedis: boolean;

  constructor() {
    this.useRedis = isRedisConfigured();
    if (this.useRedis) {
      console.log("Cache: Using Upstash Redis");
    } else {
      console.log("Cache: Using in-memory cache (Redis not configured)");
    }
  }

  /**
   * Get a value from the cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.useRedis) {
      return redisGet<T>(key);
    }
    return memoryCache.get<T>(key);
  }

  /**
   * Set a value in the cache with optional TTL
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds = DEFAULT_TTL_SECONDS
  ): Promise<void> {
    if (this.useRedis) {
      return redisSet<T>(key, value, ttlSeconds);
    }
    return memoryCache.set<T>(key, value, ttlSeconds);
  }

  /**
   * Delete a key from the cache
   */
  async del(key: string): Promise<void> {
    if (this.useRedis) {
      return redisDel(key);
    }
    return memoryCache.del(key);
  }

  /**
   * Get a value from cache or fetch it if not found
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds = DEFAULT_TTL_SECONDS
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch and cache
    const value = await fetcher();
    await this.set<T>(key, value, ttlSeconds);
    return value;
  }

  /**
   * Check if using Redis
   */
  isUsingRedis(): boolean {
    return this.useRedis;
  }

  /**
   * Get cache stats (mainly useful for memory cache)
   */
  getStats() {
    if (this.useRedis) {
      return { backend: "redis" };
    }
    return { backend: "memory", ...memoryCache.getStats() };
  }
}

// Export singleton instance
export const cache = new CacheManager();

// Export the class as well
export { CacheManager };
