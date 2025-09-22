/**
 * Cache Manager Service
 * Implements in-memory and localStorage caching with TTL support
 */

import { CACHE_CONFIG } from '@utils/constants';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

export class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>>;
  private hits: number = 0;
  private misses: number = 0;
  private maxSize: number;
  private defaultTTL: number;
  private static instance: CacheManager | null = null;

  constructor(
    maxSize: number = CACHE_CONFIG.MAX_CACHE_SIZE,
    defaultTTL: number = CACHE_CONFIG.DEFAULT_TTL_MS
  ) {
    this.memoryCache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.loadFromLocalStorage();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    
    if (memoryEntry) {
      const now = Date.now();
      const age = now - memoryEntry.timestamp;
      
      if (age <= memoryEntry.ttl) {
        // Cache hit
        memoryEntry.hits++;
        this.hits++;
        return memoryEntry.value as T;
      } else {
        // Expired
        this.memoryCache.delete(key);
      }
    }

    // Check localStorage
    const localEntry = this.getFromLocalStorage<T>(key);
    if (localEntry) {
      // Restore to memory cache
      this.memoryCache.set(key, localEntry);
      this.hits++;
      return localEntry.value;
    }

    // Cache miss
    this.misses++;
    return null;
  }

  /**
   * Set cache value
   */
  async set<T>(
    key: string, 
    value: T, 
    ttl: number = this.defaultTTL
  ): Promise<void> {
    // Enforce cache size limit
    if (this.memoryCache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl,
      hits: 0,
    };

    this.memoryCache.set(key, entry);
    this.saveToLocalStorage(key, entry);
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.memoryCache.delete(key);
    this.removeFromLocalStorage(key);
    return deleted;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.clearLocalStorage();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return false;
    
    const now = Date.now();
    const age = now - entry.timestamp;
    
    if (age > entry.ttl) {
      this.memoryCache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.memoryCache.values());
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      size: this.memoryCache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / Math.max(1, this.hits + this.misses),
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null,
    };
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    
    for (const [key, entry] of this.memoryCache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        this.memoryCache.delete(key);
        this.removeFromLocalStorage(key);
        pruned++;
      }
    }
    
    return pruned;
  }

  /**
   * Get all valid cache keys
   */
  keys(): string[] {
    this.prune();
    return Array.from(this.memoryCache.keys());
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruHits = Infinity;
    let lruTimestamp = Infinity;
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.hits < lruHits || 
         (entry.hits === lruHits && entry.timestamp < lruTimestamp)) {
        lruKey = key;
        lruHits = entry.hits;
        lruTimestamp = entry.timestamp;
      }
    }
    
    if (lruKey) {
      this.memoryCache.delete(lruKey);
      this.removeFromLocalStorage(lruKey);
    }
  }

  /**
   * Save to localStorage
   */
  private saveToLocalStorage<T>(key: string, entry: CacheEntry<T>): void {
    try {
      const storageKey = `cache:${key}`;
      const data = JSON.stringify(entry);
      localStorage.setItem(storageKey, data);
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
      // If localStorage is full, clear old cache entries
      this.clearOldLocalStorageEntries();
    }
  }

  /**
   * Get from localStorage
   */
  private getFromLocalStorage<T>(key: string): CacheEntry<T> | null {
    try {
      const storageKey = `cache:${key}`;
      const data = localStorage.getItem(storageKey);
      
      if (!data) return null;
      
      const entry = JSON.parse(data) as CacheEntry<T>;
      const now = Date.now();
      const age = now - entry.timestamp;
      
      if (age > entry.ttl) {
        localStorage.removeItem(storageKey);
        return null;
      }
      
      return entry;
    } catch (error) {
      console.warn('Failed to get from localStorage:', error);
      return null;
    }
  }

  /**
   * Remove from localStorage
   */
  private removeFromLocalStorage(key: string): void {
    try {
      const storageKey = `cache:${key}`;
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  }

  /**
   * Load cache from localStorage on init
   */
  private loadFromLocalStorage(): void {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('cache:'));
      const now = Date.now();
      
      for (const storageKey of keys) {
        const key = storageKey.replace('cache:', '');
        const data = localStorage.getItem(storageKey);
        
        if (data) {
          try {
            const entry = JSON.parse(data) as CacheEntry<any>;
            const age = now - entry.timestamp;
            
            if (age <= entry.ttl && this.memoryCache.size < this.maxSize) {
              this.memoryCache.set(key, entry);
            } else {
              localStorage.removeItem(storageKey);
            }
          } catch {
            localStorage.removeItem(storageKey);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error);
    }
  }

  /**
   * Clear all cache from localStorage
   */
  private clearLocalStorage(): void {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('cache:'));
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear localStorage cache:', error);
    }
  }

  /**
   * Clear old localStorage cache entries when space is needed
   */
  private clearOldLocalStorageEntries(): void {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('cache:'));
      const entries: Array<{ key: string; timestamp: number }> = [];
      
      for (const key of keys) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const entry = JSON.parse(data) as CacheEntry<any>;
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
      console.warn('Failed to clear old localStorage entries:', error);
    }
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();
