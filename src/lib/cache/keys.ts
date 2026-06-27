/**
 * Cache key builders for different types of cached data
 */

/**
 * Normalize a string for use in cache keys
 * - Convert to lowercase
 * - Trim whitespace
 * - Replace spaces with hyphens
 * - Remove special characters except hyphens
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Hash a string using a simple algorithm
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Build cache key for business audit results
 */
export function auditCacheKey(businessName: string, city?: string): string {
  const normalized = normalizeString(businessName);
  const cityPart = city ? `-${normalizeString(city)}` : "";
  return `audit:${normalized}${cityPart}`;
}

/**
 * Build cache key for SerpAPI search results
 */
export function serpApiCacheKey(query: string): string {
  const hash = simpleHash(query);
  return `serp:${hash}`;
}

/**
 * Build cache key for PageSpeed Insights results
 */
export function pageSpeedCacheKey(url: string): string {
  const normalized = normalizeString(url);
  return `psi:${normalized}`;
}

/**
 * Build cache key for business reviews
 */
export function reviewsCacheKey(businessName: string, city?: string): string {
  const normalized = normalizeString(businessName);
  const cityPart = city ? `-${normalizeString(city)}` : "";
  return `reviews:${normalized}${cityPart}`;
}

/**
 * Export utility function for normalizing strings
 */
export { normalizeString, simpleHash };
