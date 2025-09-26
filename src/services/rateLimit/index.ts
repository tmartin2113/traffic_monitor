/**
 * Rate Limiting Service Exports
 * 
 * @module services/rateLimit
 * @description Centralized export point for rate limiting functionality.
 * Manages API request throttling and compliance with 511.org rate limits.
 * 
 * @author Senior Development Team
 * @since 1.0.0
 * @license MIT
 */

// Service Exports
export { RateLimiter, rateLimiter } from './RateLimiter';

// Type Exports
export type {
  RateLimitInfo,
  RateLimitConfig,
  RateLimitStats,
  RequestRecord,
} from './RateLimiter';

// Re-import for namespace
import { rateLimiter, RateLimiter } from './RateLimiter';

/**
 * Rate Limiting namespace
 * @namespace RateLimit
 */
export const RateLimit = {
  instance: rateLimiter,
  class: RateLimiter,
} as const;

/**
 * Rate limit configuration defaults
 */
export const RATE_LIMIT_DEFAULTS = {
  MAX_REQUESTS_PER_HOUR: 60,
  MAX_REQUESTS_PER_MINUTE: 10,
  WINDOW_MS: 3600000, // 1 hour
  BURST_LIMIT: 5,
  BACKOFF_MULTIPLIER: 2,
  MAX_BACKOFF_MS: 60000,
} as const;

/**
 * Helper function to calculate remaining time until rate limit reset
 * @param resetTime - Unix timestamp of reset time
 * @returns Formatted time string
 */
export function getTimeUntilReset(resetTime: number): string {
  const now = Date.now();
  const diff = resetTime - now;
  
  if (diff <= 0) return 'now';
  
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Helper function to check if rate limited
 * @returns True if currently rate limited
 */
export function isRateLimited(): boolean {
  return !rateLimiter.canMakeRequest();
}

/**
 * Helper function to get current rate limit status
 * @returns Current rate limit information
 */
export function getRateLimitStatus() {
  return rateLimiter.getInfo();
}

// Version information
export const RATE_LIMIT_VERSION = '1.0.0' as const;
