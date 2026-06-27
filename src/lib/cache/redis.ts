/**
 * Upstash Redis client using fetch-based REST API
 */

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const isConfigured = () => {
  return !!UPSTASH_REDIS_REST_URL && !!UPSTASH_REDIS_REST_TOKEN;
};

const headers = {
  Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
  "Content-Type": "application/json",
};

/**
 * Get a value from Redis
 */
export async function redisGet<T>(key: string): Promise<T | null> {
  if (!isConfigured()) {
    return null;
  }

  try {
    const url = `${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { result: string | null };
    
    if (!data.result) {
      return null;
    }

    // Values are stored as JSON strings, so parse them back
    return JSON.parse(data.result) as T;
  } catch (error) {
    console.error(`Redis GET error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set a value in Redis with optional TTL
 */
export async function redisSet<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  if (!isConfigured()) {
    return;
  }

  try {
    // Serialize the value as JSON
    const serialized = JSON.stringify(value);
    const encodedValue = encodeURIComponent(serialized);

    let url = `${UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}/${encodedValue}`;
    
    // Add TTL if specified
    if (ttlSeconds && ttlSeconds > 0) {
      url += `/ex/${ttlSeconds}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      console.error(`Redis SET error for key ${key}: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`Redis SET error for key ${key}:`, error);
  }
}

/**
 * Delete a key from Redis
 */
export async function redisDel(key: string): Promise<void> {
  if (!isConfigured()) {
    return;
  }

  try {
    const url = `${UPSTASH_REDIS_REST_URL}/del/${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      console.error(`Redis DEL error for key ${key}: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`Redis DEL error for key ${key}:`, error);
  }
}

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return isConfigured();
}
