/**
 * @file providers/DataProvider.ts
 * @description Production-ready data provider implementation with caching, retry logic, and monitoring
 * @version 1.0.0
 */

import {
  DataProvider,
  DataProviderConfig,
  TrafficEvent,
  DataProviderError,
  EventAdapter,
  FetchOptions,
  ProviderMetrics
} from '../types/TrafficEvent';

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  etag?: string;
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2
};

/**
 * Production-ready base data provider class
 */
export abstract class BaseDataProvider implements DataProvider {
  protected cache: Map<string, CacheEntry<TrafficEvent[]>> = new Map();
  protected metrics: ProviderMetrics;
  protected retryConfig: RetryConfig;
  protected requestQueue: Array<() => Promise<void>> = [];
  protected isProcessingQueue = false;
  
  constructor(
    public config: DataProviderConfig,
    protected adapter: EventAdapter,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    this.metrics = {
      provider: config.name,
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0
    };
    
    // Validate configuration on instantiation
    if (!this.validateConfig()) {
      throw new Error(`Invalid configuration for provider ${config.name}`);
    }
  }
  
  /**
   * Validate provider configuration
   */
  validateConfig(): boolean {
    if (!this.config.name || typeof this.config.name !== 'string') {
      console.error('Provider name is required and must be a string');
      return false;
    }
    
    if (!this.config.baseUrl || typeof this.config.baseUrl !== 'string') {
      console.error('Base URL is required and must be a string');
      return false;
    }
    
    try {
      new URL(this.config.baseUrl);
    } catch {
      console.error(`Invalid base URL: ${this.config.baseUrl}`);
      return false;
    }
    
    if (this.config.timeout && this.config.timeout <= 0) {
      console.error('Timeout must be a positive number');
      return false;
    }
    
    return true;
  }
  
  /**
   * Health check for the provider
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(this.config.baseUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: this.config.headers
      });
      
      clearTimeout(timeoutId);
      return response.ok || response.status === 405; // Some APIs don't support HEAD
    } catch (error) {
      console.error(`Health check failed for ${this.config.name}:`, error);
      return false;
    }
  }
  
  /**
   * Fetch events with caching, retry logic, and rate limiting
   */
  async fetchEvents(options?: FetchOptions): Promise<TrafficEvent[]> {
    const cacheKey = this.getCacheKey();
    
    // Check cache unless force refresh is requested
    if (!options?.forceRefresh) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    // Apply rate limiting if configured
    if (this.config.rateLimit) {
      await this.enforceRateLimit();
    }
    
    const startTime = performance.now();
    
    try {
      // Fetch with retry logic
      const rawData = await this.fetchWithRetry(options?.signal);
      
      // Process and adapt the data
      const events = await this.processRawData(rawData, options?.includeRaw);
      
      // Update cache
      this.updateCache(cacheKey, events);
      
      // Update metrics
      this.updateMetrics(performance.now() - startTime, true);
      
      return events;
    } catch (error) {
      this.updateMetrics(performance.now() - startTime, false, error);
      throw error;
    }
  }
  
  /**
   * Abstract method to fetch raw data - must be implemented by specific providers
   */
  protected abstract fetchRawData(signal?: AbortSignal): Promise<unknown>;
  
  /**
   * Fetch with exponential backoff retry
   */
  private async fetchWithRetry(signal?: AbortSignal): Promise<unknown> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await this.fetchRawData(signal);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on abort
        if (signal?.aborted) {
          throw lastError;
        }
        
        // Don't retry on client errors (4xx)
        if (error instanceof Response && error.status >= 400 && error.status < 500) {
          throw new DataProviderError(
            `Client error: ${error.status} ${error.statusText}`,
            this.config.name,
            error
          );
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelay
        );
        
        console.warn(
          `Retry attempt ${attempt}/${this.retryConfig.maxAttempts} for ${this.config.name} after ${delay}ms`,
          lastError.message
        );
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new DataProviderError(
      `Failed after ${this.retryConfig.maxAttempts} attempts: ${lastError?.message}`,
      this.config.name,
      lastError
    );
  }
  
  /**
   * Process raw data through the adapter
   */
  protected async processRawData(rawData: unknown, includeRaw = false): Promise<TrafficEvent[]> {
    if (!Array.isArray(rawData)) {
      throw new DataProviderError(
        'Expected array of events from API',
        this.config.name
      );
    }
    
    const events: TrafficEvent[] = [];
    const errors: Array<{ index: number; error: unknown }> = [];
    
    for (let i = 0; i < rawData.length; i++) {
      try {
        const event = this.adapter(rawData[i]);
        
        // Validate required fields
        if (!event.id || !event.headline || !event.geometry) {
          throw new Error('Missing required fields in adapted event');
        }
        
        // Remove raw data if not requested
        if (!includeRaw && event.rawData) {
          delete event.rawData;
        }
        
        events.push(event);
      } catch (error) {
        errors.push({ index: i, error });
      }
    }
    
    // Log adaptation errors but don't fail entirely
    if (errors.length > 0) {
      const errorRate = (errors.length / rawData.length) * 100;
      console.warn(
        `${this.config.name}: Failed to adapt ${errors.length} of ${rawData.length} events (${errorRate.toFixed(1)}%)`,
        errors.slice(0, 5) // Log first 5 errors for debugging
      );
      
      // If too many failures, throw error
      if (errorRate > 50) {
        throw new DataProviderError(
          `Too many adaptation failures: ${errorRate.toFixed(1)}%`,
          this.config.name
        );
      }
    }
    
    return events;
  }
  
  /**
   * Get cache key for current request
   */
  protected getCacheKey(): string {
    const params = JSON.stringify(this.config.defaultParams || {});
    return `${this.config.name}:${params}`;
  }
  
  /**
   * Get data from cache if valid
   */
  protected getFromCache(key: string): TrafficEvent[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Default cache duration: 30 seconds
    const cacheDuration = this.config.timeout || 30000;
    const isExpired = Date.now() - entry.timestamp > cacheDuration;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Update cache with new data
   */
  protected updateCache(key: string, data: TrafficEvent[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Implement simple cache size limit
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }
  
  /**
   * Enforce rate limiting
   */
  protected async enforceRateLimit(): Promise<void> {
    if (!this.config.rateLimit) return;
    
    return new Promise((resolve) => {
      this.requestQueue.push(async () => {
        await new Promise(r => setTimeout(r, this.config.rateLimit!.windowMs / this.config.rateLimit!.maxRequests));
        resolve();
      });
      
      this.processQueue();
    });
  }
  
  /**
   * Process rate limit queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const task = this.requestQueue.shift();
      if (task) {
        await task();
      }
    }
    
    this.isProcessingQueue = false;
  }
  
  /**
   * Update provider metrics
   */
  protected updateMetrics(responseTime: number, success: boolean, error?: unknown): void {
    this.metrics.requestCount++;
    
    if (!success) {
      this.metrics.errorCount++;
      this.metrics.lastError = error instanceof Error ? error.message : String(error);
    } else {
      this.metrics.lastSuccessfulFetch = new Date().toISOString();
    }
    
    // Update average response time
    const prevAvg = this.metrics.averageResponseTime;
    const count = this.metrics.requestCount;
    this.metrics.averageResponseTime = (prevAvg * (count - 1) + responseTime) / count;
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
