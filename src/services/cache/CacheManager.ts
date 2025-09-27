/**
 * Cache Manager Service with Differential Support
 * Implements multi-tier caching with TTL, compression, and differential updates
 * 
 * @module services/cache/CacheManager
 * @version 2.0.0
 */

import { CACHE_CONFIG } from '@utils/constants';
import { TrafficEvent } from '@types/api.types';

// ============================================================================
// Type Definitions
// ============================================================================

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
  compressed: boolean;
  etag?: string;
  version?: string;
  checksum?: string;
}

interface DifferentialEntry<T> {
  baseKey: string;
  differential: Differential<T>;
  timestamp: number;
  size: number;
}

export interface Differential<T> {
  added: T[];
  updated: T[];
  deleted: string[];
  timestamp: string;
  metadata?: {
    baseVersion: string;
    targetVersion: string;
    compressed: boolean;
    size: number;
  };
}

export interface CacheStats {
  // Basic stats
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  
  // Memory stats
  memoryUsage: number;
  maxMemory: number;
  compressionRatio: number;
  
  // Timing stats
  oldestEntry: number | null;
  newestEntry: number | null;
  averageTTL: number;
  
  // Differential stats
  differentialCount: number;
  differentialMemory: number;
  differentialHitRate: number;
}

interface CachePolicy {
  maxSize: number;
  maxMemory: number;
  defaultTTL: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
  compressionThreshold: number;
  enableDifferential: boolean;
  persistToStorage: boolean;
}

interface EvictionCandidate {
  key: string;
  score: number;
  size: number;
  age: number;
}

// ============================================================================
// Compression Utilities
// ============================================================================

class CompressionUtil {
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();

  /**
   * Compress data using built-in compression
   */
  async compress(data: string): Promise<Uint8Array> {
    const input = this.textEncoder.encode(data);
    
    // Use CompressionStream API if available (modern browsers)
    if ('CompressionStream' in globalThis) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(input);
          controller.close();
        }
      });
      
      const compressedStream = stream.pipeThrough(
        new (globalThis as any).CompressionStream('gzip')
      );
      
      const chunks: Uint8Array[] = [];
      const reader = compressedStream.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return result;
    }
    
    // Fallback: Simple RLE compression for older environments
    return this.simpleCompress(input);
  }

  /**
   * Decompress data
   */
  async decompress(compressed: Uint8Array): Promise<string> {
    if ('DecompressionStream' in globalThis) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(compressed);
          controller.close();
        }
      });
      
      const decompressedStream = stream.pipeThrough(
        new (globalThis as any).DecompressionStream('gzip')
      );
      
      const chunks: Uint8Array[] = [];
      const reader = decompressedStream.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return this.textDecoder.decode(result);
    }
    
    // Fallback decompression
    return this.textDecoder.decode(this.simpleDecompress(compressed));
  }

  /**
   * Simple compression fallback
   */
  private simpleCompress(input: Uint8Array): Uint8Array {
    const output: number[] = [];
    let i = 0;
    
    while (i < input.length) {
      let runLength = 1;
      const currentByte = input[i];
      
      while (i + runLength < input.length && 
             input[i + runLength] === currentByte && 
             runLength < 255) {
        runLength++;
      }
      
      if (runLength > 3) {
        output.push(0xFF, runLength, currentByte);
        i += runLength;
      } else {
        output.push(currentByte);
        i++;
      }
    }
    
    return new Uint8Array(output);
  }

  /**
   * Simple decompression fallback
   */
  private simpleDecompress(compressed: Uint8Array): Uint8Array {
    const output: number[] = [];
    let i = 0;
    
    while (i < compressed.length) {
      if (compressed[i] === 0xFF && i + 2 < compressed.length) {
        const runLength = compressed[i + 1];
        const byte = compressed[i + 2];
        
        for (let j = 0; j < runLength; j++) {
          output.push(byte);
        }
        i += 3;
      } else {
        output.push(compressed[i]);
        i++;
      }
    }
    
    return new Uint8Array(output);
  }
}

// ============================================================================
// Main Cache Manager Class
// ============================================================================

export class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>>;
  private differentialCache: Map<string, DifferentialEntry<any>>;
  private compressionUtil: CompressionUtil;
  private policy: CachePolicy;
  private stats: {
    hits: number;
    misses: number;
    differentialHits: number;
    differentialMisses: number;
  };
  private currentMemoryUsage: number = 0;
  private accessOrder: Map<string, number>;
  private static instance: CacheManager | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private storageQuota: number = 50 * 1024 * 1024; // 50MB default

  constructor(policy?: Partial<CachePolicy>) {
    this.policy = {
      maxSize: CACHE_CONFIG.MAX_CACHE_SIZE || 1000,
      maxMemory: CACHE_CONFIG.MAX_MEMORY_MB ? CACHE_CONFIG.MAX_MEMORY_MB * 1024 * 1024 : 100 * 1024 * 1024,
      defaultTTL: CACHE_CONFIG.DEFAULT_TTL_MS || 30000,
      evictionPolicy: 'lru',
      compressionThreshold: 1024, // Compress entries larger than 1KB
      enableDifferential: true,
      persistToStorage: true,
      ...policy
    };

    this.memoryCache = new Map();
    this.differentialCache = new Map();
    this.compressionUtil = new CompressionUtil();
    this.accessOrder = new Map();
    
    this.stats = {
      hits: 0,
      misses: 0,
      differentialHits: 0,
      differentialMisses: 0
    };

    this.initializeStorage();
    this.startCleanupInterval();
  }

  /**
   * Get singleton instance
   */
  static getInstance(policy?: Partial<CachePolicy>): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(policy);
    }
    return CacheManager.instance;
  }

  /**
   * Get cached value with differential support
   */
  async get<T>(key: string, options?: { 
    allowDifferential?: boolean; 
    baseKey?: string;
  }): Promise<T | null> {
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key);
    
    if (memoryEntry) {
      const now = Date.now();
      const age = now - memoryEntry.timestamp;
      
      if (age <= memoryEntry.ttl) {
        // Cache hit
        memoryEntry.hits++;
        this.stats.hits++;
        this.updateAccessOrder(key);
        
        // Decompress if needed
        if (memoryEntry.compressed) {
          const decompressed = await this.compressionUtil.decompress(memoryEntry.value);
          return JSON.parse(decompressed) as T;
        }
        
        return memoryEntry.value as T;
      } else {
        // Expired - remove it
        this.memoryCache.delete(key);
        this.currentMemoryUsage -= memoryEntry.size;
      }
    }

    // Try differential cache if enabled
    if (options?.allowDifferential && options.baseKey) {
      const differential = await this.getDifferentialValue<T>(options.baseKey, key);
      if (differential) {
        this.stats.differentialHits++;
        return differential;
      }
      this.stats.differentialMisses++;
    }

    // Try localStorage
    if (this.policy.persistToStorage) {
      const storageEntry = await this.getFromStorage<T>(key);
      if (storageEntry) {
        // Restore to memory cache
        this.memoryCache.set(key, storageEntry);
        this.currentMemoryUsage += storageEntry.size;
        this.stats.hits++;
        
        // Decompress if needed
        if (storageEntry.compressed) {
          const decompressed = await this.compressionUtil.decompress(storageEntry.value);
          return JSON.parse(decompressed) as T;
        }
        
        return storageEntry.value;
      }
    }

    // Cache miss
    this.stats.misses++;
    return null;
  }

  /**
   * Set cache value with optional compression
   */
  async set<T>(
    key: string, 
    value: T, 
    ttl: number = this.policy.defaultTTL,
    options?: {
      etag?: string;
      version?: string;
      compress?: boolean;
    }
  ): Promise<void> {
    // Calculate size
    const serialized = JSON.stringify(value);
    const size = new Blob([serialized]).size;
    
    // Enforce memory limit
    if (this.currentMemoryUsage + size > this.policy.maxMemory) {
      await this.evictEntries(size);
    }

    // Compress if needed
    let storedValue: any = value;
    let compressed = false;
    
    if ((options?.compress !== false) && size > this.policy.compressionThreshold) {
      try {
        const compressedData = await this.compressionUtil.compress(serialized);
        if (compressedData.length < size) {
          storedValue = compressedData;
          compressed = true;
        }
      } catch (error) {
        console.warn('Compression failed, storing uncompressed:', error);
      }
    }

    const entry: CacheEntry<T> = {
      value: storedValue,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      size: compressed ? storedValue.length : size,
      compressed,
      etag: options?.etag,
      version: options?.version,
      checksum: this.generateChecksum(serialized)
    };

    // Store in memory
    this.memoryCache.set(key, entry);
    this.currentMemoryUsage += entry.size;
    this.updateAccessOrder(key);

    // Store in localStorage if enabled
    if (this.policy.persistToStorage) {
      await this.saveToStorage(key, entry);
    }

    // Enforce size limit
    if (this.memoryCache.size > this.policy.maxSize) {
      await this.evictEntries(0);
    }
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<boolean> {
    const entry = this.memoryCache.get(key);
    if (entry) {
      this.currentMemoryUsage -= entry.size;
      this.memoryCache.delete(key);
      this.accessOrder.delete(key);
      
      if (this.policy.persistToStorage) {
        await this.removeFromStorage(key);
      }
      
      return true;
    }
    return false;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.differentialCache.clear();
    this.accessOrder.clear();
    this.currentMemoryUsage = 0;
    
    this.stats = {
      hits: 0,
      misses: 0,
      differentialHits: 0,
      differentialMisses: 0
    };
    
    if (this.policy.persistToStorage) {
      await this.clearStorage();
    }
  }

  /**
   * Get or compute differential between two cache states
   */
  async getDifferential<T extends { id: string; version?: string }>(
    oldKey: string,
    newKey: string,
    options?: { cache?: boolean }
  ): Promise<Differential<T> | null> {
    // Check differential cache
    const diffKey = `diff:${oldKey}:${newKey}`;
    const cached = this.differentialCache.get(diffKey);
    
    if (cached) {
      this.stats.differentialHits++;
      return cached.differential;
    }

    const oldData = await this.get<T[]>(oldKey);
    const newData = await this.get<T[]>(newKey);
    
    if (!oldData || !newData) {
      return null;
    }

    const differential = this.computeDifferential(oldData, newData);
    
    // Cache the differential if requested
    if (options?.cache !== false) {
      const size = new Blob([JSON.stringify(differential)]).size;
      
      this.differentialCache.set(diffKey, {
        baseKey: oldKey,
        differential,
        timestamp: Date.now(),
        size
      });
      
      // Limit differential cache size
      if (this.differentialCache.size > 50) {
        this.pruneDifferentialCache();
      }
    }

    return differential;
  }

  /**
   * Compute differential between two datasets
   */
  private computeDifferential<T extends { id: string; version?: string }>(
    oldData: T[],
    newData: T[]
  ): Differential<T> {
    const oldMap = new Map(oldData.map(item => [item.id, item]));
    const newMap = new Map(newData.map(item => [item.id, item]));
    
    const added: T[] = [];
    const updated: T[] = [];
    const deleted: string[] = [];
    
    // Find additions and updates
    for (const [id, newItem] of newMap) {
      const oldItem = oldMap.get(id);
      
      if (!oldItem) {
        added.push(newItem);
      } else if (this.hasChanged(oldItem, newItem)) {
        updated.push(newItem);
      }
    }
    
    // Find deletions
    for (const [id] of oldMap) {
      if (!newMap.has(id)) {
        deleted.push(id);
      }
    }
    
    return {
      added,
      updated,
      deleted,
      timestamp: new Date().toISOString(),
      metadata: {
        baseVersion: this.getDataVersion(oldData),
        targetVersion: this.getDataVersion(newData),
        compressed: false,
        size: new Blob([JSON.stringify({ added, updated, deleted })]).size
      }
    };
  }

  /**
   * Merge differential into cached dataset
   */
  async mergeDifferential<T extends { id: string }>(
    baseKey: string,
    differential: Differential<T>,
    options?: { 
      ttl?: number; 
      createNewKey?: boolean;
      validate?: (data: T[]) => boolean;
    }
  ): Promise<{ key: string; data: T[] }> {
    const baseData = await this.get<T[]>(baseKey) || [];
    const dataMap = new Map(baseData.map(item => [item.id, item]));
    
    // Apply deletions
    for (const id of differential.deleted) {
      dataMap.delete(id);
    }
    
    // Apply additions and updates
    for (const item of [...differential.added, ...differential.updated]) {
      dataMap.set(item.id, item);
    }
    
    const mergedData = Array.from(dataMap.values());
    
    // Validate if requested
    if (options?.validate && !options.validate(mergedData)) {
      throw new Error('Merged data validation failed');
    }
    
    // Determine storage key
    const targetKey = options?.createNewKey 
      ? `${baseKey}:${Date.now()}`
      : baseKey;
    
    // Store merged result
    await this.set(targetKey, mergedData, options?.ttl);
    
    return { key: targetKey, data: mergedData };
  }

  /**
   * Get differential value by applying differentials
   */
  private async getDifferentialValue<T extends { id: string }>(
    baseKey: string,
    targetKey: string
  ): Promise<T[] | null> {
    // Find path from base to target through differentials
    const path = this.findDifferentialPath(baseKey, targetKey);
    
    if (!path || path.length === 0) {
      return null;
    }

    // Get base data
    let currentData = await this.get<T[]>(baseKey);
    if (!currentData) {
      return null;
    }

    // Apply differentials in sequence
    for (const diffKey of path) {
      const diffEntry = this.differentialCache.get(diffKey);
      if (!diffEntry) {
        return null;
      }

      const result = await this.mergeDifferential(
        baseKey,
        diffEntry.differential,
        { createNewKey: false }
      );
      
      currentData = result.data;
    }

    return currentData;
  }

  /**
   * Find path through differential cache
   */
  private findDifferentialPath(baseKey: string, targetKey: string): string[] | null {
    // Simple implementation - could be enhanced with graph traversal
    const directKey = `diff:${baseKey}:${targetKey}`;
    
    if (this.differentialCache.has(directKey)) {
      return [directKey];
    }

    // TODO: Implement multi-hop differential path finding
    return null;
  }

  /**
   * Check if data has changed
   */
  private hasChanged<T>(oldItem: T, newItem: T): boolean {
    // Check version if available
    if ('version' in oldItem && 'version' in newItem) {
      return (oldItem as any).version !== (newItem as any).version;
    }
    
    // Check updated timestamp if available
    if ('updated' in oldItem && 'updated' in newItem) {
      return (oldItem as any).updated !== (newItem as any).updated;
    }
    
    // Deep comparison
    return JSON.stringify(oldItem) !== JSON.stringify(newItem);
  }

  /**
   * Get data version
   */
  private getDataVersion<T>(data: T[]): string {
    if (data.length === 0) return '0';
    
    // Create version from data characteristics
    const characteristics = {
      count: data.length,
      firstId: (data[0] as any).id || '',
      lastId: (data[data.length - 1] as any).id || '',
      timestamp: Date.now()
    };
    
    return Buffer.from(JSON.stringify(characteristics))
      .toString('base64')
      .substring(0, 12);
  }

  /**
   * Generate checksum for data integrity
   */
  private generateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Evict cache entries based on policy
   */
  private async evictEntries(requiredSpace: number): Promise<void> {
    const candidates = this.getEvictionCandidates();
    let freedSpace = 0;
    
    for (const candidate of candidates) {
      if (freedSpace >= requiredSpace && this.memoryCache.size <= this.policy.maxSize) {
        break;
      }
      
      const entry = this.memoryCache.get(candidate.key);
      if (entry) {
        this.memoryCache.delete(candidate.key);
        this.accessOrder.delete(candidate.key);
        this.currentMemoryUsage -= entry.size;
        freedSpace += entry.size;
        
        if (this.policy.persistToStorage) {
          await this.removeFromStorage(candidate.key);
        }
      }
    }
  }

  /**
   * Get eviction candidates based on policy
   */
  private getEvictionCandidates(): EvictionCandidate[] {
    const candidates: EvictionCandidate[] = [];
    const now = Date.now();
    
    for (const [key, entry] of this.memoryCache.entries()) {
      const age = now - entry.timestamp;
      const lastAccess = this.accessOrder.get(key) || entry.timestamp;
      
      let score: number;
      
      switch (this.policy.evictionPolicy) {
        case 'lru':
          score = now - lastAccess;
          break;
        case 'lfu':
          score = 1 / (entry.hits + 1);
          break;
        case 'fifo':
          score = age;
          break;
        case 'ttl':
          score = entry.ttl - age;
          break;
        default:
          score = age;
      }
      
      candidates.push({
        key,
        score,
        size: entry.size,
        age
      });
    }
    
    // Sort by score (higher score = better eviction candidate)
    return candidates.sort((a, b) => b.score - a.score);
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    this.accessOrder.set(key, Date.now());
    
    // Limit access order map size
    if (this.accessOrder.size > this.policy.maxSize * 2) {
      const entries = Array.from(this.accessOrder.entries());
      entries.sort((a, b) => a[1] - b[1]);
      
      // Remove oldest half
      const toRemove = Math.floor(entries.length / 2);
      for (let i = 0; i < toRemove; i++) {
        this.accessOrder.delete(entries[i][0]);
      }
    }
  }

  /**
   * Prune differential cache
   */
  private pruneDifferentialCache(): void {
    const entries = Array.from(this.differentialCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest half
    const toRemove = Math.floor(entries.length / 2);
    for (let i = 0; i < toRemove; i++) {
      this.differentialCache.delete(entries[i][0]);
    }
  }

  /**
   * Initialize storage
   */
  private async initializeStorage(): Promise<void> {
    if (!this.policy.persistToStorage) return;
    
    try {
      // Check storage quota
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        this.storageQuota = estimate.quota || this.storageQuota;
      }
      
      // Load persisted entries
      const keys = this.getStorageKeys();
      for (const key of keys) {
        if (this.memoryCache.size >= this.policy.maxSize) break;
        
        const entry = await this.getFromStorage(key.replace('cache:', ''));
        if (entry && this.isValidEntry(entry)) {
          this.memoryCache.set(key.replace('cache:', ''), entry);
          this.currentMemoryUsage += entry.size;
        }
      }
    } catch (error) {
      console.warn('Storage initialization failed:', error);
    }
  }

  /**
   * Save to storage
   */
  private async saveToStorage<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.policy.persistToStorage) return;
    
    try {
      const storageKey = `cache:${key}`;
      const data = JSON.stringify(entry);
      
      // Check storage quota
      const size = new Blob([data]).size;
      const used = await this.getStorageUsage();
      
      if (used + size > this.storageQuota * 0.9) {
        // Clear old entries if approaching quota
        await this.clearOldStorageEntries();
      }
      
      localStorage.setItem(storageKey, data);
    } catch (error) {
      // Handle quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        await this.clearOldStorageEntries();
        try {
          const storageKey = `cache:${key}`;
          localStorage.setItem(storageKey, JSON.stringify(entry));
        } catch (retryError) {
          console.warn('Failed to save to storage after cleanup:', retryError);
        }
      }
    }
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
      localStorage.removeItem(`cache:${key}`);
    } catch (error) {
      console.warn('Failed to remove from storage:', error);
    }
  }

  /**
   * Clear storage
   */
  private async clearStorage(): Promise<void> {
    if (!this.policy.persistToStorage) return;
    
    try {
      const keys = this.getStorageKeys();
      for (const key of keys) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('Failed to clear storage:', error);
    }
  }

  /**
   * Get all storage keys
   */
  private getStorageKeys(): string[] {
    const keys: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cache:')) {
        keys.push(key);
      }
    }
    
    return keys;
  }

  /**
   * Get storage usage
   */
  private async getStorageUsage(): Promise<number> {
    let total = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cache:')) {
        const value = localStorage.getItem(key);
        if (value) {
          total += new Blob([key, value]).size;
        }
      }
    }
    
    return total;
  }

  /**
   * Clear old storage entries
   */
  private async clearOldStorageEntries(): Promise<void> {
    const entries: Array<{ key: string; timestamp: number }> = [];
    
    for (const key of this.getStorageKeys()) {
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
  }

  /**
   * Validate cache entry
   */
  private isValidEntry(entry: CacheEntry<any>): boolean {
    if (!entry.timestamp || !entry.ttl) return false;
    
    const age = Date.now() - entry.timestamp;
    return age <= entry.ttl;
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.prune();
    }, 60000); // Run every minute
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
        this.accessOrder.delete(key);
        this.currentMemoryUsage -= entry.size;
        
        if (this.policy.persistToStorage) {
          this.removeFromStorage(key);
        }
        
        pruned++;
      }
    }
    
    // Prune old differentials
    for (const [key, entry] of this.differentialCache.entries()) {
      const age = now - entry.timestamp;
      if (age > 300000) { // 5 minutes
        this.differentialCache.delete(key);
        pruned++;
      }
    }
    
    return pruned;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.memoryCache.values());
    const timestamps = entries.map(e => e.timestamp);
    const ttls = entries.map(e => e.ttl);
    
    const hitRate = this.stats.hits / Math.max(1, this.stats.hits + this.stats.misses);
    const differentialHitRate = this.stats.differentialHits / 
      Math.max(1, this.stats.differentialHits + this.stats.differentialMisses);
    
    const compressionRatio = entries.reduce((acc, entry) => {
      if (entry.compressed) {
        return acc + (entry.size / entry.value.length);
      }
      return acc;
    }, 0) / Math.max(1, entries.filter(e => e.compressed).length);
    
    return {
      size: this.memoryCache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      memoryUsage: this.currentMemoryUsage,
      maxMemory: this.policy.maxMemory,
      compressionRatio: compressionRatio || 1,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null,
      averageTTL: ttls.length > 0 ? ttls.reduce((a, b) => a + b, 0) / ttls.length : 0,
      differentialCount: this.differentialCache.size,
      differentialMemory: Array.from(this.differentialCache.values())
        .reduce((acc, entry) => acc + entry.size, 0),
      differentialHitRate
    };
  }

  /**
   * Get all valid cache keys
   */
  keys(): string[] {
    this.prune();
    return Array.from(this.memoryCache.keys());
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
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

  /**
   * Get memory usage for specific key
   */
  getKeySize(key: string): number {
    const entry = this.memoryCache.get(key);
    return entry ? entry.size : 0;
  }

  /**
   * Export cache for debugging
   */
  async export(): Promise<{
    entries: Array<{ key: string; entry: CacheEntry<any> }>;
    differentials: Array<{ key: string; entry: DifferentialEntry<any> }>;
    stats: CacheStats;
  }> {
    return {
      entries: Array.from(this.memoryCache.entries()).map(([key, entry]) => ({
        key,
        entry
      })),
      differentials: Array.from(this.differentialCache.entries()).map(([key, entry]) => ({
        key,
        entry
      })),
      stats: this.getStats()
    };
  }

  /**
   * Import cache (for debugging/migration)
   */
  async import(data: {
    entries: Array<{ key: string; entry: CacheEntry<any> }>;
    differentials?: Array<{ key: string; entry: DifferentialEntry<any> }>;
  }): Promise<void> {
    // Clear existing cache
    await this.clear();
    
    // Import entries
    for (const { key, entry } of data.entries) {
      this.memoryCache.set(key, entry);
      this.currentMemoryUsage += entry.size;
    }
    
    // Import differentials if provided
    if (data.differentials) {
      for (const { key, entry } of data.differentials) {
        this.differentialCache.set(key, entry);
      }
    }
  }

  /**
   * Destroy cache manager and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.clear();
    CacheManager.instance = null;
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();
