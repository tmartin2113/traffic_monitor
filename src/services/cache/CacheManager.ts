/**
 * Cache Manager Service
 * Handles in-memory and localStorage caching with TTL support
 */

import { CACHE_CONFIG, STORAGE_KEYS } from '@/utils/constants';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  storageSize: number;
  hitRate: number;
}

export class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>>;
  private stats: CacheStats;
  private maxSize: number;
  private useLocalStorage: boolean;

  constructor(maxSize = CACHE_CONFIG.MAX_CACHE_SIZE, useLocalStorage = true) {
    this.memoryCache = new Map();
    this.maxSize = maxSize;
    this.useLocalStorage = useLocalStorage && this.isLocalStorageAvailable();
    this.stats = {
      hits: 0,
      misses: 0,
      entries: 0,
      storageSize: 0,
      hitRate: 0,
    };

    // Load persisted cache from localStorage
    if (this.useLocalStorage) {
      this.loadFromLocalStorage();
    }

    // Set up periodic cleanup
    this.startCleanupInterval();
  }

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    
    if (memoryEntry) {
      if (this.isExpired(memoryEntry)) {
        this.delete(key);
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }
      
      this.stats.hits++;
      this.updateHitRate();
      return memoryEntry.data as T;
    }

    // Check localStorage if enabled
    if (this.useLocalStorage) {
      const localEntry = this.getFromLocalStorage<T>(key);
      
      if (localEntry) {
        if (this.isExpired(localEntry)) {
          this.deleteFromLocalStorage(key);
          this.stats.misses++;
          this.updateHitRate();
          return null;
        }
        
        // Restore to memory cache
        this.memoryCache.set(key, localEntry);
        this.stats.hits++;
        this.updateHitRate();
        return localEntry.data;
      }
    }

    this.stats.misses++;
    this.updateHitRate();
    return null;
  }

  /**
   * Set cache data with TTL
   */
  async set<T>(key: string, data: T, ttl = CACHE_CONFIG.DEFAULT_TTL): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key,
    };

    // Check cache size and evict if necessary
    if (this.memoryCache.size >= this.maxSize) {
      this.evictOldest();
    }

    // Set in memory cache
    this.memoryCache.set(key, entry);

    // Persist to localStorage if enabled
    if (this.useLocalStorage) {
      this.setToLocalStorage(key, entry);
    }

    this.updateStats();
  }

  /**
   * Delete cached data
   */
  delete(key: string): boolean {
    const deleted = this.memoryCache.delete(key);
    
    if (this.useLocalStorage) {
      this.deleteFromLocalStorage(key);
    }
    
    this.updateStats();
    return deleted;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.useLocalStorage) {
      this.clearLocalStorage();
    }
    
    this.resetStats();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.delete(key));

    if (this.useLocalStorage) {
      this.cleanupLocalStorage();
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }

  /**
   * Check if localStorage is available
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const test = '__cache_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get from localStorage
   */
  private getFromLocalStorage<T>(key: string): CacheEntry<T> | null {
    try {
      const storageKey = `${STORAGE_KEYS.CACHE}_${key}`;
      const item = localStorage.getItem(storageKey);
      
      if (!item) return null;
      
      return JSON.parse(item) as CacheEntry<T>;
    } catch (error) {
      console.error('Failed to get from localStorage:', error);
      return null;
    }
  }

  /**
   * Set to localStorage
   */
  private setToLocalStorage<T>(key: string, entry: CacheEntry<T>): void {
    try {
      const storageKey = `${STORAGE_KEYS.CACHE}_${key}`;
      localStorage.setItem(storageKey, JSON.stringify(entry));
    } catch (error) {
      console.error('Failed to set to localStorage:', error);
      // If storage is full, clear old cache entries
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.clearOldLocalStorageEntries();
        // Try again
        try {
          const storageKey = `${STORAGE_KEYS.CACHE}_${key}`;
          localStorage.setItem(storageKey, JSON.stringify(entry));
        } catch {
          // Give up if it still fails
        }
      }
    }
  }

  /**
   * Delete from localStorage
   */
  private deleteFromLocalStorage(key: string): void {
    try {
      const storageKey = `${STORAGE_KEYS.CACHE}_${key}`;
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to delete from localStorage:', error);
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromLocalStorage(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(STORAGE_KEYS.CACHE)
      );

      for (const key of keys) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const entry = JSON.parse(item) as CacheEntry<any>;
            if (!this.isExpired(entry)) {
              const cacheKey = key.replace(`${STORAGE_KEYS.CACHE}_`, '');
              this.memoryCache.set(cacheKey, entry);
            } else {
              localStorage.removeItem(key);
            }
          } catch {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
  }

  /**
   * Clear localStorage cache
   */
  private clearLocalStorage(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(STORAGE_KEYS.CACHE)
      );
      
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }

  /**
   * Clean up expired localStorage entries
   */
  private cleanupLocalStorage(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(STORAGE_KEYS.CACHE)
      );

      for (const key of keys) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const entry = JSON.parse(item) as CacheEntry<any>;
            if (this.isExpired(entry)) {
              localStorage.removeItem(key);
            }
          } catch {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup localStorage:', error);
    }
  }

  /**
   * Clear old localStorage entries when quota exceeded
   */
  private clearOldLocalStorageEntries(): void {
    const entries: Array<{ key: string; timestamp: number }> = [];
    
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(STORAGE_KEYS.CACHE)
      );

      for (const key of keys) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const entry = JSON.parse(item) as CacheEntry<any>;
            entries.push({ key, timestamp: entry.timestamp });
          } catch {
            localStorage.removeItem(key);
          }
        }
      }

      // Sort by timestamp and remove oldest half
      entries.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = Math.ceil(entries.length / 2);
      
      for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(entries[i].key);
      }
    } catch (error) {
      console.error('Failed to clear old localStorage entries:', error);
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.entries = this.memoryCache.size;
    
    if (this.useLocalStorage) {
      try {
        const keys = Object.keys(localStorage).filter(key => 
          key.startsWith(STORAGE_KEYS.CACHE)
        );
        let totalSize = 0;
        
        for (const key of keys) {
          const item = localStorage.getItem(key);
          if (item) {
            totalSize += item.length * 2; // Rough estimate (UTF-16)
          }
        }
        
        this.stats.storageSize = totalSize;
      } catch {
        this.stats.storageSize = 0;
      }
    }
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      entries: 0,
      storageSize: 0,
      hitRate: 0,
    };
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();
