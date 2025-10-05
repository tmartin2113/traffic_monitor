/**
 * @file services/cache/CacheManager.ts
 * @description Production-ready cache manager with memory and storage management
 * @version 3.0.0 - ALL BUGS FIXED ✅
 * 
 * FIXES APPLIED:
 * ✅ BUG FIX #1: Replaced console.log in initialize() with logger.info
 * ✅ BUG FIX #2: Replaced console.error in initialize() with logger.error
 * ✅ BUG FIX #3: Replaced console.warn in updateStorageQuota() with logger.warn
 * ✅ BUG FIX #4: Replaced console.warn in initializeFromStorage() with logger.warn (entry load)
 * ✅ BUG FIX #5: Replaced console.warn in initializeFromStorage() with logger.warn (initialization failed)
 * ✅ BUG FIX #6: Replaced console.error in set() with logger.error
 * ✅ BUG FIX #7: Replaced console.log in evict() with logger.info
 * ✅ BUG FIX #8: Replaced console.log in prune() with logger.info
 * ✅ BUG FIX #9: Replaced console.error in saveToStorageWithRetry() with logger.error (storage error)
 * ✅ BUG FIX #10: Replaced console.error in saveToStorageWithRetry() with logger.error (max retries)
 * ✅ BUG FIX #11: Replaced console.warn in getFromStorage() with logger.warn
 * ✅ BUG FIX #12: Replaced console.warn in removeFromStorage() with logger.warn
 * ✅ BUG FIX #13: Replaced console.error in clear() with logger.error
 * 
 * PRODUCTION STANDARDS:
 * - NO console.* statements (uses logger utility)
 * - Comprehensive error handling
 * - Type-safe throughout
 * - Memory and storage quota management
 * - LRU eviction policy
 * - Differential caching support
 * - Performance optimized
 * 
 * Features:
 * - Memory and localStorage caching
 * - LRU eviction policy
 * - TTL-based expiration
 * - Quota management with retry limits
 * - Differential caching support
 * - Statistics tracking
 * - Automatic cleanup
 * 
 * @author Senior Development Team
 * @since 3.0.0
 */

import { TrafficEvent } from '@types/api.types';
import { logger } from '@utils/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
  size: number;
  hits: number;
  lastAccessed: number;
}

/**
 * Differential cache entry for incremental updates
 */
export interface DifferentialEntry<T = any> {
  baseVersion: string;
  delta: Partial<T>;
  timestamp: number;
  size: number;
  checksum?: string;
}

/**
 * Cache policy configuration
 */
export interface CachePolicy {
  maxMemorySize: number;
  maxStorageSize: number;
  defaultTTL: number;
  cleanupInterval: number;
  persistToStorage: boolean;
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
}

/**
 * Cache statistics
 */
export interface CacheStats {
  memoryEntries: number;
  memorySize: number;
  storageEntries: number;
  storageSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  oldestEntry: number | null;
  newestEntry: number | null;
  averageTTL: number;
  differentialCount: number;
  differentialMemory: number;
  differentialHitRate: number;
}

/**
 * Storage operation result
 */
interface StorageOperationResult {
  success: boolean;
  error?: string;
  retriesUsed?: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  maxSize?: number;
  defaultTTL?: number;
  persistToStorage?: boolean;
}

/**
 * Cache options for set operations
 */
export interface CacheOptions {
  ttl?: number;
  tags?: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_POLICY: CachePolicy = {
  maxMemorySize: 50 * 1024 * 1024, // 50 MB
  maxStorageSize: 500 * 1024 * 1024, // 500 MB
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  cleanupInterval: 60 * 1000, // 1 minute
  persistToStorage: true,
  evictionPolicy: 'lru',
};

const STORAGE_RETRY_DELAY = 100; // ms
const MAX_STORAGE_RETRIES = 3;
const MAX_CONSECUTIVE_FAILURES = 5;

// ============================================================================
// CACHE MANAGER CLASS
// ============================================================================

export class CacheManager {
  private static instance: CacheManager | null = null;

  private memoryCache: Map<string, CacheEntry> = new Map();
  private differentialCache: Map<string, DifferentialEntry> = new Map();
  private currentMemoryUsage: number = 0;
  private storageQuota: number = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private retryAttempts: Map<string, number> = new Map();

  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    differentialHits: 0,
    differentialMisses: 0,
  };

  private policy: CachePolicy;

  // ============================================================================
  // CONSTRUCTOR & SINGLETON
  // ============================================================================

  /**
   * Private constructor for singleton pattern
   */
  private constructor(policy: Partial<CachePolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
    this.initialize();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(policy: Partial<CachePolicy> = {}): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(policy);
    }
    return CacheManager.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (CacheManager.instance) {
      CacheManager.instance.destroy();
      CacheManager.instance = null;
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize cache manager
   * FIXED: Replaced console.log and console.error with logger
   */
  private async initialize(): Promise<void> {
    try {
      // Load storage quota
      await this.updateStorageQuota();
      
      // Initialize from storage
      await this.initializeFromStorage();
      
      // Start cleanup interval
      this.startCleanupInterval();
      
      // FIXED BUG #1: Replaced console.log with logger.info
      logger.info('CacheManager initialized successfully', {
        memoryLimit: this.formatBytes(this.policy.maxMemorySize),
        storageQuota: this.formatBytes(this.storageQuota),
        evictionPolicy: this.policy.evictionPolicy,
        defaultTTL: this.policy.defaultTTL,
      });
    } catch (error) {
      // FIXED BUG #2: Replaced console.error with logger.error
      logger.error('Failed to initialize CacheManager', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.prune();
    }, this.policy.cleanupInterval);
  }

  /**
   * Update storage quota information
   * FIXED: Replaced console.warn with logger.warn
   */
  private async updateStorageQuota(): Promise<void> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota) {
          this.storageQuota = Math.min(
            estimate.quota,
            this.policy.maxStorageSize
          );
        }
      }
    } catch (error) {
      // FIXED BUG #3: Replaced console.warn with logger.warn
      logger.warn('Failed to retrieve storage quota', {
        error: error instanceof Error ? error.message : String(error),
        fallbackQuota: this.policy.maxStorageSize,
      });
    }
  }

  /**
   * Initialize cache from localStorage
   * FIXED: Replaced console.warn statements with logger.warn
   */
  private async initializeFromStorage(): Promise<void> {
    if (!this.policy.persistToStorage) return;

    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => key.startsWith('cache:'));

      for (const storageKey of cacheKeys) {
        try {
          const data = localStorage.getItem(storageKey);
          if (data) {
            const entry = JSON.parse(data) as CacheEntry;
            const key = storageKey.replace('cache:', '');

            if (this.isValidEntry(entry)) {
              this.memoryCache.set(key, entry);
              this.currentMemoryUsage += entry.size;
            } else {
              localStorage.removeItem(storageKey);
            }
          }
        } catch (error) {
          // FIXED BUG #4: Replaced console.warn with logger.warn
          logger.warn('Failed to load cache entry from storage', {
            storageKey,
            error: error instanceof Error ? error.message : String(error),
          });
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      // FIXED BUG #5: Replaced console.warn with logger.warn
      logger.warn('Storage initialization failed', {
        error: error instanceof Error ? error.message : String(error),
        persistToStorage: this.policy.persistToStorage,
      });
    }
  }

  // ============================================================================
  // CORE CACHE OPERATIONS
  // ============================================================================

  /**
   * Set cache entry
   * FIXED: Replaced console.error with logger.error
   */
  public async set<T>(
    key: string,
    data: T,
    ttl: number = this.policy.defaultTTL
  ): Promise<boolean> {
    try {
      const size = this.estimateSize(data);
      const entry: CacheEntry<T> = {
        key,
        data,
        timestamp: Date.now(),
        ttl,
        size,
        hits: 0,
        lastAccessed: Date.now(),
      };

      // Check if we need to evict entries
      if (this.currentMemoryUsage + size > this.policy.maxMemorySize) {
        await this.evict(size);
      }

      // Set in memory cache
      this.memoryCache.set(key, entry);
      this.currentMemoryUsage += size;

      // Save to storage with retry logic
      await this.saveToStorageWithRetry(key, entry);

      return true;
    } catch (error) {
      // FIXED BUG #6: Replaced console.error with logger.error
      logger.error('Failed to set cache entry', {
        key,
        error: error instanceof Error ? error.message : String(error),
        ttl,
        dataSize: this.estimateSize(data),
      });
      return false;
    }
  }

  /**
   * Get cache entry
   */
  public async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;

    if (entry) {
      // Check if expired
      const age = Date.now() - entry.timestamp;
      if (age > entry.ttl) {
        await this.delete(key);
        this.stats.misses++;
        return null;
      }

      // Update stats
      entry.hits++;
      entry.lastAccessed = Date.now();
      this.stats.hits++;
      
      return entry.data;
    }

    // Try storage cache
    const storageEntry = await this.getFromStorage<T>(key);
    if (storageEntry) {
      // Restore to memory cache
      this.memoryCache.set(key, storageEntry);
      this.currentMemoryUsage += storageEntry.size;
      this.stats.hits++;
      return storageEntry.data;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Delete cache entry
   */
  public async delete(key: string): Promise<boolean> {
    const entry = this.memoryCache.get(key);
    
    if (entry) {
      this.memoryCache.delete(key);
      this.currentMemoryUsage -= entry.size;
    }

    await this.removeFromStorage(key);
    this.retryAttempts.delete(key);
    
    return true;
  }

  /**
   * Clear all cache
   * FIXED: Replaced console.error with logger.error
   */
  public async clear(): Promise<void> {
    this.memoryCache.clear();
    this.differentialCache.clear();
    this.currentMemoryUsage = 0;
    this.stats.evictions = 0;
    this.retryAttempts.clear();

    if (this.policy.persistToStorage) {
      try {
        const keys = Object.keys(localStorage);
        const cacheKeys = keys.filter(key => key.startsWith('cache:'));
        cacheKeys.forEach(key => localStorage.removeItem(key));
      } catch (error) {
        // FIXED BUG #13: Replaced console.error with logger.error
        logger.error('Failed to clear storage cache', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // ============================================================================
  // EVICTION & CLEANUP
  // ============================================================================

  /**
   * Evict entries to make space
   * FIXED: Replaced console.log with logger.info
   */
  private async evict(requiredSpace: number): Promise<void> {
    const entries = Array.from(this.memoryCache.entries());

    if (entries.length === 0) return;

    // Sort based on eviction policy
    switch (this.policy.evictionPolicy) {
      case 'lru':
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        break;
      case 'lfu':
        entries.sort((a, b) => a[1].hits - b[1].hits);
        break;
      case 'fifo':
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        break;
    }

    // Evict entries until we have enough space
    let freedSpace = 0;
    const toEvict: string[] = [];

    for (const [key, entry] of entries) {
      toEvict.push(key);
      freedSpace += entry.size;
      this.stats.evictions++;

      if (freedSpace >= requiredSpace) {
        break;
      }
    }

    // Remove evicted entries
    for (const key of toEvict) {
      await this.delete(key);
    }

    // FIXED BUG #7: Replaced console.log with logger.info
    logger.info('Cache eviction completed', {
      entriesEvicted: toEvict.length,
      spaceFreed: this.formatBytes(freedSpace),
      requiredSpace: this.formatBytes(requiredSpace),
      evictionPolicy: this.policy.evictionPolicy,
    });
  }

  /**
   * Prune expired entries
   * FIXED: Replaced console.log with logger.info
   */
  public prune(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.delete(key);
    }

    // FIXED BUG #8: Replaced console.log with logger.info
    if (toDelete.length > 0) {
      logger.info('Cache pruning completed', {
        entriesExpired: toDelete.length,
        totalEntries: this.memoryCache.size,
        memoryUsage: this.formatBytes(this.currentMemoryUsage),
      });
    }
  }

  // ============================================================================
  // STORAGE OPERATIONS WITH RETRY LOGIC
  // ============================================================================

  /**
   * Save to storage with retry logic
   * FIXED: Replaced console.error statements with logger.error
   */
  private async saveToStorageWithRetry(
    key: string,
    entry: CacheEntry
  ): Promise<StorageOperationResult> {
    if (!this.policy.persistToStorage) {
      return { success: true };
    }

    const storageKey = `cache:${key}`;
    const maxRetries = MAX_STORAGE_RETRIES;
    const failureCount = this.retryAttempts.get(key) || 0;

    if (failureCount >= MAX_CONSECUTIVE_FAILURES) {
      return {
        success: false,
        error: 'Max consecutive failures exceeded',
      };
    }

    let retries = 0;
    while (retries < maxRetries) {
      retries++;

      try {
        localStorage.setItem(storageKey, JSON.stringify(entry));
        this.retryAttempts.delete(key);
        return { success: true, retriesUsed: retries };
      } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          const cleared = await this.clearOldStorageEntries();
          if (!cleared) {
            // FIXED BUG #9: Replaced console.error with logger.error
            logger.error('Storage quota exceeded and unable to free space', {
              key,
              entrySize: entry.size,
              storageQuota: this.formatBytes(this.storageQuota),
              retriesUsed: retries,
            });
            return { 
              success: false, 
              error: 'QuotaExceededError - unable to free space',
              retriesUsed: retries 
            };
          }

          // Wait before retry
          if (retries < maxRetries) {
            await this.delay(STORAGE_RETRY_DELAY * retries);
          }
        } else {
          // Non-quota error, don't retry
          // No separate console.error here as this wasn't in the original bug count
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            retriesUsed: retries 
          };
        }
      }
    }

    // Max retries reached
    // FIXED BUG #10: Replaced console.error with logger.error
    logger.error('Failed to save cache entry to storage after max retries', {
      key,
      maxRetries,
      retriesUsed: retries,
      failureCount: this.retryAttempts.get(key) || 0,
    });
    
    this.retryAttempts.set(key, failureCount + 1);
    
    return { 
      success: false, 
      error: `Max retries (${maxRetries}) exceeded`,
      retriesUsed: retries 
    };
  }

  /**
   * Get from storage
   * FIXED: Replaced console.warn with logger.warn
   */
  private async getFromStorage<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.policy.persistToStorage) return null;

    try {
      const storageKey = `cache:${key}`;
      const data = localStorage.getItem(storageKey);

      if (data) {
        const entry = JSON.parse(data) as CacheEntry<T>;

        // Validate entry
        if (this.isValidEntry(entry)) {
          return entry;
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      // FIXED BUG #11: Replaced console.warn with logger.warn
      logger.warn('Failed to retrieve entry from storage', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }

  /**
   * Remove from storage
   * FIXED: Replaced console.warn with logger.warn
   */
  private async removeFromStorage(key: string): Promise<void> {
    if (!this.policy.persistToStorage) return;

    try {
      const storageKey = `cache:${key}`;
      localStorage.removeItem(storageKey);
    } catch (error) {
      // FIXED BUG #12: Replaced console.warn with logger.warn
      logger.warn('Failed to remove entry from storage', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clear old storage entries to free space
   */
  private async clearOldStorageEntries(): Promise<boolean> {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => key.startsWith('cache:'));

      if (cacheKeys.length === 0) {
        return false;
      }

      // Sort by timestamp (oldest first)
      const entries: Array<{ key: string; entry: CacheEntry; storageKey: string }> = [];

      for (const storageKey of cacheKeys) {
        try {
          const data = localStorage.getItem(storageKey);
          if (data) {
            const entry = JSON.parse(data) as CacheEntry;
            entries.push({ key: entry.key, entry, storageKey });
          }
        } catch (error) {
          // Silent fail for individual entries
          localStorage.removeItem(storageKey);
        }
      }

      entries.sort((a, b) => a.entry.timestamp - b.entry.timestamp);

      // Remove oldest 25% of entries
      const toRemove = Math.max(1, Math.floor(entries.length * 0.25));
      for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(entries[i].storageKey);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // DIFFERENTIAL CACHING
  // ============================================================================

  /**
   * Set differential cache entry
   */
  public setDifferential<T>(
    key: string,
    baseVersion: string,
    delta: Partial<T>,
    checksum?: string
  ): boolean {
    try {
      const size = this.estimateSize(delta);
      const entry: DifferentialEntry<T> = {
        baseVersion,
        delta,
        timestamp: Date.now(),
        size,
        checksum,
      };

      this.differentialCache.set(key, entry);
      return true;
    } catch (error) {
      logger.error('Failed to set differential cache entry', {
        key,
        baseVersion,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get differential cache entry
   */
  public getDifferential<T>(
    key: string,
    baseVersion: string
  ): Partial<T> | null {
    const entry = this.differentialCache.get(key);

    if (entry && entry.baseVersion === baseVersion) {
      this.stats.differentialHits++;
      return entry.delta as Partial<T>;
    }

    this.stats.differentialMisses++;
    return null;
  }

  /**
   * Clear differential cache
   */
  public clearDifferential(): void {
    this.differentialCache.clear();
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Estimate size of data in bytes
   */
  private estimateSize(data: any): number {
    try {
      const str = JSON.stringify(data);
      return new Blob([str]).size;
    } catch (error) {
      // Fallback estimation
      return JSON.stringify(data).length * 2;
    }
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Validate cache entry
   */
  private isValidEntry(entry: any): entry is CacheEntry {
    return (
      entry &&
      typeof entry.key === 'string' &&
      entry.data !== undefined &&
      typeof entry.timestamp === 'number' &&
      typeof entry.ttl === 'number' &&
      typeof entry.size === 'number'
    );
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // STATISTICS & MONITORING
  // ============================================================================

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    const timestamps: number[] = [];
    const ttls: number[] = [];

    for (const entry of this.memoryCache.values()) {
      timestamps.push(entry.timestamp);
      ttls.push(entry.ttl);
    }

    const memoryEntries = this.memoryCache.size;
    const storageEntries = this.getStorageEntryCount();
    const hitRate = 
      this.stats.hits + this.stats.misses > 0
        ? this.stats.hits / (this.stats.hits + this.stats.misses)
        : 0;

    const differentialTotal = 
      this.stats.differentialHits + this.stats.differentialMisses;
    const differentialHitRate = 
      differentialTotal > 0
        ? this.stats.differentialHits / differentialTotal 
        : 0;

    return {
      memoryEntries,
      memorySize: this.currentMemoryUsage,
      storageEntries,
      storageSize: this.getStorageSize(),
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      evictions: this.stats.evictions,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null,
      averageTTL: ttls.length > 0 ? ttls.reduce((a, b) => a + b, 0) / ttls.length : 0,
      differentialCount: this.differentialCache.size,
      differentialMemory: Array.from(this.differentialCache.values())
        .reduce((acc, entry) => acc + entry.size, 0),
      differentialHitRate,
    };
  }

  /**
   * Get storage entry count
   */
  private getStorageEntryCount(): number {
    try {
      const keys = Object.keys(localStorage);
      return keys.filter(key => key.startsWith('cache:')).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get storage size
   */
  private getStorageSize(): number {
    try {
      let total = 0;
      const keys = Object.keys(localStorage).filter(key => key.startsWith('cache:'));
      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value) {
          total += (key.length + value.length) * 2; // UTF-16
        }
      }
      return total;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get all valid cache keys
   */
  public keys(): string[] {
    this.prune();
    return Array.from(this.memoryCache.keys());
  }

  /**
   * Check if key exists and is valid
   */
  public has(key: string): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.memoryCache.delete(key);
      this.currentMemoryUsage -= entry.size;
      return false;
    }

    return true;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Destroy cache manager and cleanup
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.clear();
    this.retryAttempts.clear();
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const cacheManager = CacheManager.getInstance();

export default cacheManager;
