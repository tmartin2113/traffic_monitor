import { useEffect, useCallback, useRef } from 'react';
import { logger } from '@/utils/logger';

/**
 * Cache statistics interface
 */
interface CacheStats {
  estimatedSize: number;
  itemCount: number;
  lastCleared?: Date;
}

/**
 * Cache manager operations interface
 */
interface CacheManager {
  getStats: () => CacheStats;
  clearAll: () => void;
  clearItem: (key: string) => void;
}

/**
 * Custom error class for cache-related errors
 */
class CacheError extends Error {
  constructor(message: string, public readonly context?: Record<string, unknown>) {
    super(message);
    this.name = 'CacheError';
    Object.setPrototypeOf(this, CacheError.prototype);
  }
}

/**
 * Validates that maxSizeBytes is a positive number
 * @throws {CacheError} If maxSizeBytes is invalid
 */
function validateMaxSize(maxSizeBytes: number): void {
  if (!Number.isFinite(maxSizeBytes)) {
    throw new CacheError('maxSizeBytes must be a finite number', { 
      provided: maxSizeBytes,
      type: typeof maxSizeBytes 
    });
  }
  
  if (maxSizeBytes <= 0) {
    throw new CacheError('maxSizeBytes must be greater than 0', { 
      provided: maxSizeBytes 
    });
  }
  
  if (maxSizeBytes > Number.MAX_SAFE_INTEGER) {
    throw new CacheError('maxSizeBytes exceeds maximum safe integer', { 
      provided: maxSizeBytes,
      max: Number.MAX_SAFE_INTEGER
    });
  }
}

/**
 * Automatically manages cache size by periodically checking and clearing when limit is exceeded.
 * 
 * This hook sets up an interval that runs every minute to monitor cache size. If the cache
 * exceeds the specified size limit, it automatically clears all cached data and logs a warning.
 * 
 * **IMPORTANT:** This hook uses useEffect to properly set up and tear down the interval.
 * The previous buggy version used useCallback, which never executed the interval setup.
 * 
 * @param maxSizeBytes - Maximum allowed cache size in bytes. Default: 10MB (10 * 1024 * 1024)
 *                       Must be a positive finite number.
 * @param checkIntervalMs - How often to check cache size in milliseconds. Default: 60000 (1 minute)
 *                          Must be at least 1000ms to prevent excessive checking.
 * 
 * @throws {CacheError} If maxSizeBytes or checkIntervalMs are invalid
 * 
 * @example
 * ```typescript
 * // Use default 10MB limit with 1-minute checks
 * useAutoCacheSizeLimit();
 * 
 * // Use custom 50MB limit
 * useAutoCacheSizeLimit(50 * 1024 * 1024);
 * 
 * // Use 25MB limit with 30-second checks
 * useAutoCacheSizeLimit(25 * 1024 * 1024, 30000);
 * ```
 */
export function useAutoCacheSizeLimit(
  maxSizeBytes: number = 10 * 1024 * 1024,
  checkIntervalMs: number = 60000
): void {
  const { getStats, clearAll } = useCacheManager();
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef<boolean>(true);
  
  // Track the last time we cleared to prevent rapid successive clears
  const lastClearTimeRef = useRef<number>(0);
  const MIN_CLEAR_INTERVAL_MS = 5000; // Minimum 5 seconds between clears

  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Validate inputs on mount and when they change
    try {
      validateMaxSize(maxSizeBytes);
      
      if (!Number.isFinite(checkIntervalMs) || checkIntervalMs < 1000) {
        throw new CacheError('checkIntervalMs must be at least 1000ms', { 
          provided: checkIntervalMs 
        });
      }
    } catch (error) {
      logger.error('Invalid cache size limit configuration', {
        error: error instanceof Error ? error.message : String(error),
        maxSizeBytes,
        checkIntervalMs,
      });
      // Re-throw to make the error visible in development
      throw error;
    }

    // Set up the interval to periodically check cache size
    const interval = setInterval(() => {
      // Skip if component unmounted
      if (!isMountedRef.current) {
        return;
      }

      try {
        const stats = getStats();
        
        // Validate stats object
        if (!stats || typeof stats.estimatedSize !== 'number') {
          logger.error('Invalid cache stats received', { stats });
          return;
        }

        // Check if cache exceeds limit
        if (stats.estimatedSize > maxSizeBytes) {
          const now = Date.now();
          const timeSinceLastClear = now - lastClearTimeRef.current;
          
          // Prevent rapid successive clears
          if (timeSinceLastClear < MIN_CLEAR_INTERVAL_MS) {
            logger.debug('Skipping cache clear - too soon since last clear', {
              timeSinceLastClear,
              minInterval: MIN_CLEAR_INTERVAL_MS,
            });
            return;
          }

          logger.warn('Cache size limit exceeded, clearing cache', {
            currentSize: stats.estimatedSize,
            maxSize: maxSizeBytes,
            utilizationPercent: ((stats.estimatedSize / maxSizeBytes) * 100).toFixed(2),
            itemCount: stats.itemCount,
            timestamp: new Date().toISOString(),
          });

          clearAll();
          lastClearTimeRef.current = now;
          
          logger.info('Cache cleared successfully', {
            clearedAt: new Date().toISOString(),
          });
        } else {
          // Log debug info periodically to confirm monitoring is working
          logger.debug('Cache size check passed', {
            currentSize: stats.estimatedSize,
            maxSize: maxSizeBytes,
            utilizationPercent: ((stats.estimatedSize / maxSizeBytes) * 100).toFixed(2),
            itemCount: stats.itemCount,
          });
        }
      } catch (error) {
        // Catch and log any errors during cache check to prevent interval from breaking
        logger.error('Error during cache size check', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          maxSizeBytes,
        });
      }
    }, checkIntervalMs);

    // Log that monitoring has started
    logger.info('Cache size monitoring started', {
      maxSizeBytes,
      checkIntervalMs,
      maxSizeMB: (maxSizeBytes / (1024 * 1024)).toFixed(2),
      checkIntervalSeconds: (checkIntervalMs / 1000).toFixed(0),
    });

    // Cleanup function: clear the interval when component unmounts or dependencies change
    return () => {
      clearInterval(interval);
      logger.info('Cache size monitoring stopped', {
        maxSizeBytes,
        checkIntervalMs,
      });
    };
  }, [maxSizeBytes, checkIntervalMs, getStats, clearAll]);
}

/**
 * Mock implementation of useCacheManager for demonstration.
 * Replace this with your actual cache manager implementation.
 */
function useCacheManager(): CacheManager {
  const getStats = useCallback((): CacheStats => {
    // This is a mock implementation
    // Replace with your actual cache stats logic
    return {
      estimatedSize: 0,
      itemCount: 0,
      lastCleared: undefined,
    };
  }, []);

  const clearAll = useCallback((): void => {
    // This is a mock implementation
    // Replace with your actual cache clearing logic
    logger.info('Cache cleared');
  }, []);

  const clearItem = useCallback((key: string): void => {
    // This is a mock implementation
    logger.info('Cache item cleared', { key });
  }, []);

  return {
    getStats,
    clearAll,
    clearItem,
  };
}
