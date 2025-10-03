/**
 * @file hooks/useCacheManager.ts
 * @description React Query cache management utilities
 * @version 1.0.0
 * 
 * RELATED TO BUG #16: Centralized cache management
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@utils/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Cache invalidation options
 */
export interface InvalidateOptions {
  /** Whether to refetch active queries immediately */
  refetchActive?: boolean;
  /** Whether to refetch inactive queries */
  refetchInactive?: boolean;
  /** Specific query key to invalidate */
  queryKey?: string | string[];
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total number of cached queries */
  totalQueries: number;
  /** Number of active queries */
  activeQueries: number;
  /** Number of stale queries */
  staleQueries: number;
  /** Total cache size estimate (in bytes) */
  estimatedSize: number;
}

/**
 * Return type for useCacheManager hook
 */
export interface UseCacheManagerResult {
  /** Clear all cached data */
  clearAll: () => Promise<void>;
  /** Clear specific query cache */
  clearQuery: (queryKey: string | string[]) => Promise<void>;
  /** Invalidate queries to trigger refetch */
  invalidate: (options?: InvalidateOptions) => Promise<void>;
  /** Invalidate traffic events cache */
  invalidateTrafficEvents: () => Promise<void>;
  /** Get cache statistics */
  getStats: () => CacheStats;
  /** Remove stale queries */
  removeStaleQueries: () => void;
  /** Reset query error state */
  resetQueryErrors: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for managing React Query cache
 * 
 * Provides centralized cache management functionality including:
 * - Clear all cached data
 * - Clear specific queries
 * - Invalidate queries to trigger refetch
 * - Get cache statistics
 * - Remove stale queries
 * 
 * @returns Cache manager interface
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const {
 *     clearAll,
 *     invalidateTrafficEvents,
 *     getStats,
 *   } = useCacheManager();
 *   
 *   const handleClearCache = async () => {
 *     await clearAll();
 *     console.log('Cache cleared');
 *   };
 *   
 *   const handleRefresh = async () => {
 *     await invalidateTrafficEvents();
 *     console.log('Traffic events will refetch');
 *   };
 *   
 *   const stats = getStats();
 *   console.log(`Cached queries: ${stats.totalQueries}`);
 * }
 * ```
 */
export function useCacheManager(): UseCacheManagerResult {
  const queryClient = useQueryClient();

  /**
   * Clear all cached data
   */
  const clearAll = useCallback(async (): Promise<void> => {
    logger.info('Clearing all React Query cache');

    try {
      await queryClient.clear();
      logger.debug('Cache cleared successfully');
    } catch (error) {
      logger.error('Failed to clear cache', { error });
      throw error;
    }
  }, [queryClient]);

  /**
   * Clear specific query cache
   */
  const clearQuery = useCallback(
    async (queryKey: string | string[]): Promise<void> => {
      const key = Array.isArray(queryKey) ? queryKey : [queryKey];

      logger.info('Clearing specific query cache', { queryKey: key });

      try {
        await queryClient.removeQueries({ queryKey: key });
        logger.debug('Query cache cleared successfully', { queryKey: key });
      } catch (error) {
        logger.error('Failed to clear query cache', { error, queryKey: key });
        throw error;
      }
    },
    [queryClient]
  );

  /**
   * Invalidate queries to trigger refetch
   */
  const invalidate = useCallback(
    async (options: InvalidateOptions = {}): Promise<void> => {
      const {
        refetchActive = true,
        refetchInactive = false,
        queryKey,
      } = options;

      if (queryKey) {
        const key = Array.isArray(queryKey) ? queryKey : [queryKey];
        logger.info('Invalidating specific queries', { queryKey: key });

        await queryClient.invalidateQueries({
          queryKey: key,
          refetchType: refetchActive ? 'active' : refetchInactive ? 'all' : 'none',
        });
      } else {
        logger.info('Invalidating all queries');

        await queryClient.invalidateQueries({
          refetchType: refetchActive ? 'active' : refetchInactive ? 'all' : 'none',
        });
      }

      logger.debug('Queries invalidated successfully');
    },
    [queryClient]
  );

  /**
   * Invalidate traffic events cache specifically
   */
  const invalidateTrafficEvents = useCallback(async (): Promise<void> => {
    logger.info('Invalidating traffic events cache');

    await queryClient.invalidateQueries({
      queryKey: ['traffic-events'],
      refetchType: 'active',
    });

    logger.debug('Traffic events cache invalidated');
  }, [queryClient]);

  /**
   * Get cache statistics
   */
  const getStats = useCallback((): CacheStats => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    const activeQueries = queries.filter((q) => q.state.fetchStatus === 'fetching').length;
    const staleQueries = queries.filter((q) => q.isStale()).length;

    // Estimate cache size (rough approximation)
    const estimatedSize = queries.reduce((total, query) => {
      if (query.state.data) {
        try {
          return total + JSON.stringify(query.state.data).length;
        } catch {
          return total;
        }
      }
      return total;
    }, 0);

    return {
      totalQueries: queries.length,
      activeQueries,
      staleQueries,
      estimatedSize,
    };
  }, [queryClient]);

  /**
   * Remove stale queries from cache
   */
  const removeStaleQueries = useCallback((): void => {
    logger.info('Removing stale queries');

    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    let removedCount = 0;

    queries.forEach((query) => {
      if (query.isStale() && query.state.fetchStatus !== 'fetching') {
        cache.remove(query);
        removedCount++;
      }
    });

    logger.debug(`Removed ${removedCount} stale queries`);
  }, [queryClient]);

  /**
   * Reset query error states
   */
  const resetQueryErrors = useCallback((): void => {
    logger.info('Resetting query errors');

    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    let resetCount = 0;

    queries.forEach((query) => {
      if (query.state.status === 'error') {
        query.reset();
        resetCount++;
      }
    });

    logger.debug(`Reset ${resetCount} query errors`);
  }, [queryClient]);

  return {
    clearAll,
    clearQuery,
    invalidate,
    invalidateTrafficEvents,
    getStats,
    removeStaleQueries,
    resetQueryErrors,
  };
}

// ============================================================================
// ADDITIONAL UTILITY HOOKS
// ============================================================================

/**
 * Hook to automatically clear cache on specific events
 * 
 * @param event - Event to listen for
 * @param clearOnEvent - Whether to clear cache when event occurs
 * 
 * @example
 * ```typescript
 * // Clear cache when user logs out
 * useAutoClearCache('logout', true);
 * ```
 */
export function useAutoClearCache(event: string, clearOnEvent: boolean = true): void {
  const { clearAll } = useCacheManager();

  useCallback(() => {
    if (!clearOnEvent) return;

    const handleEvent = () => {
      logger.info(`Auto-clearing cache on ${event} event`);
      clearAll();
    };

    window.addEventListener(event, handleEvent);

    return () => {
      window.removeEventListener(event, handleEvent);
    };
  }, [event, clearOnEvent, clearAll]);
}

/**
 * Hook to get cache status information
 * 
 * @returns Cache status information
 */
export function useCacheStatus(): {
  isCaching: boolean;
  cacheSize: number;
  queryCount: number;
} {
  const { getStats } = useCacheManager();
  const stats = getStats();

  return {
    isCaching: stats.activeQueries > 0,
    cacheSize: stats.estimatedSize,
    queryCount: stats.totalQueries,
  };
}

/**
 * Hook to monitor cache size and auto-clear when threshold exceeded
 * 
 * @param maxSizeBytes - Maximum cache size in bytes
 */
export function useAutoCacheSizeLimit(maxSizeBytes: number = 10 * 1024 * 1024): void {
  const { getStats, clearAll } = useCacheManager();

  useCallback(() => {
    const interval = setInterval(() => {
      const stats = getStats();

      if (stats.estimatedSize > maxSizeBytes) {
        logger.warn('Cache size limit exceeded, clearing cache', {
          currentSize: stats.estimatedSize,
          maxSize: maxSizeBytes,
        });
        clearAll();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [maxSizeBytes, getStats, clearAll]);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default useCacheManager;
