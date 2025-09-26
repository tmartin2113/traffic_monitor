/**
 * Cache Management Service Exports
 * 
 * @module services/cache
 * @description Centralized export point for caching functionality.
 * Provides in-memory and localStorage caching with TTL support.
 * 
 * @author Senior Development Team
 * @since 1.0.0
 * @license MIT
 */

// Service Exports
export { CacheManager, cacheManager } from './CacheManager';

// Type Exports
export type {
  CacheEntry,
  CacheStats,
  CacheConfig,
  CacheOptions,
} from './CacheManager';

// Re-import for namespace
import { cacheManager, CacheManager } from './CacheManager';

/**
 * Cache namespace
 * @namespace Cache
 */
export const Cache = {
  instance: cacheManager,
  class: CacheManager,
} as const;

/**
 * Cache configuration defaults
 */
export const CACHE_DEFAULTS = {
  MAX_SIZE: 100,
  DEFAULT_TTL_MS: 30000, // 30 seconds
  MEMORY_ONLY: false,
  USE_LOCAL_STORAGE: true,
  AUTO_PRUNE: true,
  PRUNE_INTERVAL_MS: 60000, // 1 minute
} as const;

/**
 * Cache key generators
 */
export const CacheKeys = {
  /**
   * Generate cache key for API requests
   * @param endpoint - API endpoint
   * @param params - Request parameters
   * @returns Cache key
   */
  api: (endpoint: string, params: Record<string, any> = {}): string => {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        if (params[key] !== undefined && params[key] !== null) {
          acc[key] = params[key];
        }
        return acc;
      }, {} as Record<string, any>);
    
    return `api:${endpoint}:${JSON.stringify(sortedParams)}`;
  },
  
  /**
   * Generate cache key for geofence data
   * @param bounds - Geofence bounds
   * @returns Cache key
   */
  geofence: (bounds: { north: number; south: number; east: number; west: number }): string => {
    return `geofence:${bounds.north},${bounds.south},${bounds.east},${bounds.west}`;
  },
  
  /**
   * Generate cache key for event data
   * @param eventId - Event identifier
   * @returns Cache key
   */
  event: (eventId: string): string => {
    return `event:${eventId}`;
  },
  
  /**
   * Generate cache key for user preferences
   * @param userId - User identifier
   * @returns Cache key
   */
  user: (userId: string): string => {
    return `user:${userId}`;
  },
} as const;

/**
 * Cache utilities
 */
export const CacheUtils = {
  /**
   * Clear all caches
   */
  clearAll: async (): Promise<void> => {
    await cacheManager.clear();
  },
  
  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getStats: (): any => {
    return cacheManager.getStats();
  },
  
  /**
   * Check if cache has key
   * @param key - Cache key
   * @returns True if key exists
   */
  has: (key: string): boolean => {
    return cacheManager.has(key);
  },
  
  /**
   * Prune expired entries
   * @returns Number of entries pruned
   */
  prune: (): number => {
    return cacheManager.prune();
  },
  
  /**
   * Get all cache keys
   * @returns Array of cache keys
   */
  keys: (): string[] => {
    return cacheManager.keys();
  },
} as const;

/**
 * Cache decorators for methods
 */
export function Cacheable(ttl: number = CACHE_DEFAULTS.DEFAULT_TTL_MS) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      // Check cache
      const cached = await cacheManager.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
      
      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Cache result
      await cacheManager.set(cacheKey, result, ttl);
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Clear cache decorator
 */
export function CacheClear(pattern?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      
      if (pattern) {
        const keys = cacheManager.keys();
        const matchingKeys = keys.filter(key => key.includes(pattern));
        for (const key of matchingKeys) {
          await cacheManager.delete(key);
        }
      } else {
        await cacheManager.clear();
      }
      
      return result;
    };
    
    return descriptor;
  };
}

// Version information
export const CACHE_VERSION = '1.0.0' as const;
