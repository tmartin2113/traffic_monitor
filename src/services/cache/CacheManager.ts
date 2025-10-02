/**
 * @file services/cache/CacheManager.ts
 * @description Production-ready cache manager with memory and storage management
 * @version 2.0.0
 * 
 * Features:
 * - Memory and localStorage caching
 * - LRU eviction policy
 * - TTL-based expiration
 * - Quota management with retry limits
 * - Differential caching support
 * - Statistics tracking
 * - Automatic cleanup
 */

import { TrafficEvent } from '@types/api.types';

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

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_POLICY: CachePolicy = {
  maxMemorySize: 50 * 1024 * 1024, // 50MB
  maxStorageSize: 10 * 1024 * 1024, // 10MB
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  cleanupInterval: 60 * 1000, // 1 minute
  persistToStorage: true,
  evictionPolicy: 'lru',
};

const MAX_STORAGE_RETRIES = 3;
const STORAGE_RETRY_DELAY = 100; // milliseconds
const STORAGE_QUOTA_THRESHOLD = 0.9; // 90% of quota

// ============================================================================
// CACHE MANAGER CLASS
// ============================================================================

export class CacheManager {
  private static instance: CacheManager | null = null;

  // Cache storage
  private memoryCache: Map<string, CacheEntry>;
  private differentialCache: Map<string, DifferentialEntry>;
  
  // Policy and configuration
  private policy: CachePolicy;
  
  // Memory tracking
  private currentMemoryUsage: number;
  private storageQuota: number;
  
  // Statistics
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
    differentialHits: number;
    differentialMisses: number;
  };
  
  // Cleanup
  private cleanupInterval: NodeJS.Timeout | null;
  
  // Retry tracking
  private retryAttempts: Map<string, number>;

  /**
   * Private constructor for singleton pattern
   */
  private constructor(policy: Partial<CachePolicy> = {}) {
    this.memoryCache = new Map();
    this.differentialCache = new Map();
    this.policy = { ...DEFAULT_POLICY, ...policy };
    this.currentMemoryUsage = 0;
    this.storageQuota = this.policy.maxStorageSize;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      differentialHits: 0,
      differentialMisses: 0,
    };
    this.cleanupInterval = null;
    this.retryAttempts = new Map();

    this.initialize();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(policy?: Partial<CachePolicy>): CacheManager {
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
   */
  private async initialize(): Promise<void> {
    try {
      // Load storage quota
      await this.updateStorageQuota();
      
      // Initialize from storage
      await this.initializeFromStorage();
      
      // Start cleanup interval
      this.startCleanupInterval();
      
      console.log('CacheManager initialized', {
        memoryLimit: this.formatBytes(this.policy.maxMemorySize),
        storageQuota: this.formatBytes(this.storageQuota),
      });
    } catch (error) {
      console.error('Failed to initialize CacheManager:', error);
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
      console.warn('Failed to get storage quota:', error);
    }
  }

  /**
   * Initialize cache from localStorage
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
          console.warn(`Failed to load cache entry ${storageKey}:`, error);
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.warn('Storage initialization failed:', error);
    }
  }

  // ============================================================================
  // CORE CACHE OPERATIONS
  // ============================================================================

  /**
   * Set cache entry
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
      console.error(`Failed to set cache entry ${key}:`, error);
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
        console.error('Failed to clear storage cache:', error);
      }
    }
  }

  // ============================================================================
  // STORAGE OPERATIONS WITH RETRY LOGIC
  // ============================================================================

  /**
   * Save to storage with retry logic (FIXES INFINITE LOOP BUG)
   */
  private async saveToStorageWithRetry<T>(
    key: string,
    entry: CacheEntry<T>
  ): Promise<StorageOperationResult> {
    if (!this.policy.persistToStorage) {
      return { success: true };
    }

    const storageKey = `cache:${key}`;
    let retries = 0;
    const maxRetries = MAX_STORAGE_RETRIES;

    while (retries < maxRetries) {
      try {
        const data = JSON.stringify(entry);
        const size = new Blob([data]).size;

        // Check storage quota before attempting to save
        const used = await this.getStorageUsage();
        if (used + size > this.storageQuota * STORAGE_QUOTA_THRESHOLD) {
          console.warn(
            `Storage approaching quota (${this.formatBytes(used)}/${this.formatBytes(this.storageQuota)})`
          );
          
          // Try to clear old entries
          const cleared = await this.clearOldStorageEntries();
          
          if (!cleared) {
            console.error('Failed to free storage space, skipping storage persist');
            return { 
              success: false, 
              error: 'Storage quota exceeded',
              retriesUsed: retries 
            };
          }
        }

        // Attempt to save
        localStorage.setItem(storageKey, data);
        this.retryAttempts.delete(key);
        return { success: true, retriesUsed: retries };

      } catch (error) {
        retries++;

        // Handle quota exceeded error
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.warn(
            `QuotaExceededError on attempt ${retries}/${maxRetries} for key ${key}`
          );

          // Try to free space
          const cleared = await this.clearOldStorageEntries();
          
          if (!cleared && retries >= maxRetries) {
            console.error(
              `Failed to save ${key} after ${retries} attempts. Storage quota persistently exceeded.`
            );
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
          console.error(`Storage error for ${key}:`, error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            retriesUsed: retries 
          };
        }
      }
    }

    // Max retries reached
    console.error(
      `Failed to save ${key} to storage after ${maxRetries} attempts`
    );
    this.retryAttempts.set(key, (this.retryAttempts.get(key) || 0) + 1);
    
    return { 
      success: false, 
      error: `Max retries (${maxRetries}) exceeded`,
      retriesUsed: retries 
    };
  }

  /**
   * Get from storage
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
      console.warn('Failed to get from storage:', error);
    }

    return null;
  }

  /**
   * Remove from storage
   */
  private async removeFromStorage(key: string): Promise<void> {
    if (!this.policy.persistToStorage) return;

    try {
      const storageKey = `cache:${key}`;
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn(`Failed to remove ${key} from storage:`, error);
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
            entries.push({
              key: storageKey.replace('cache:', ''),
              entry,
              storageKey,
            });
          }
        } catch (error) {
          // Invalid entry, remove it
          localStorage.removeItem(storageKey);
        }
      }

      // Sort by last accessed time
      entries.sort((a, b) => a.entry.lastAccessed - b.entry.lastAccessed);

      // Remove oldest 25% of entries
      const toRemove = Math.max(1, Math.floor(entries.length * 0.25));
      let removed = 0;

      for (let i = 0; i < toRemove && i < entries.length; i++) {
        try {
          localStorage.removeItem(entries[i].storageKey);
          this.memoryCache.delete(entries[i].key);
          removed++;
        } catch (error) {
          console.warn(`Failed to remove ${entries[i].storageKey}:`, error);
        }
      }

      console.log(`Cleared ${removed} old storage entries`);
      return removed > 0;

    } catch (error) {
      console.error('Failed to clear old storage entries:', error);
      return false;
    }
  }

  /**
   * Get current storage usage
   */
  private async getStorageUsage(): Promise<number> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return estimate.usage || 0;
      }

      // Fallback: estimate from localStorage
      let total = 0;
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value) {
          total += key.length + value.length;
        }
      }
      return total * 2; // UTF-16 encoding
    } catch (error) {
      console.warn('Failed to get storage usage:', error);
      return 0;
    }
  }

  // ============================================================================
  // EVICTION POLICIES
  // ============================================================================

  /**
   * Evict entries to make space
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

    console.log(`Evicted ${toEvict.length} entries, freed ${this.formatBytes(freedSpace)}`);
  }

  /**
   * Prune expired entries
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

    if (toDelete.length > 0) {
      console.log(`Pruned ${toDelete.length} expired entries`);
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
  ): void {
    const size = this.estimateSize(delta);
    const entry: DifferentialEntry<T> = {
      baseVersion,
      delta,
      timestamp: Date.now(),
      size,
      checksum,
    };

    this.differentialCache.set(key, entry);
  }

  /**
   * Get differential cache entry
   */
  public getDifferential<T>(key: string): DifferentialEntry<T> | null {
    const entry = this.differentialCache.get(key) as DifferentialEntry<T> | undefined;

    if (entry) {
      this.stats.differentialHits++;
      return entry;
    }

    this.stats.differentialMisses++;
    return null;
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Validate cache entry
   */
  private isValidEntry(entry: CacheEntry): boolean {
    const now = Date.now();
    const age = now - entry.timestamp;
    return (
      entry &&
      typeof entry === 'object' &&
      'data' in entry &&
      'timestamp' in entry &&
      'ttl' in entry &&
      age <= entry.ttl
    );
  }

  /**
   * Estimate data size in bytes
   */
  private estimateSize(data: any): number {
    try {
      const json = JSON.stringify(data);
      return new Blob([json]).size;
    } catch (error) {
      // Rough estimation if stringify fails
      return 1024; // 1KB default
    }
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    const memoryEntries = this.memoryCache.size;
    const storageEntries = this.getStorageEntryCount();
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    const timestamps = Array.from(this.memoryCache.values()).map(e => e.timestamp);
    const ttls = Array.from(this.memoryCache.values()).map(e => e.ttl);

    const differentialTotal = this.stats.differentialHits + this.stats.differentialMisses;
    const differentialHitRate = differentialTotal > 0 
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
