/**
 * Rate Limiter Service
 * 
 * @module services/rateLimit/RateLimiter
 * @description Implements rate limiting for API requests to comply with 511.org limits.
 * Uses sliding window algorithm with burst protection and automatic backoff.
 * 
 * @author Senior Development Team
 * @since 1.0.0
 * @license MIT
 */

import { RATE_LIMIT_CONFIG, STORAGE_KEYS } from '@utils/constants';

/**
 * Request record for tracking
 */
export interface RequestRecord {
  timestamp: number;
  endpoint?: string;
  success: boolean;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  remaining: number;
  total: number;
  resetTime: number;
  retryAfter?: number;
  isLimited: boolean;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  maxBurst?: number;
  backoffMultiplier?: number;
  maxBackoffMs?: number;
  storageKey?: string;
}

/**
 * Rate limit statistics
 */
export interface RateLimitStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  averageRequestTime?: number;
  lastRequestTime?: number;
  windowStart: number;
  windowEnd: number;
}

/**
 * Rate Limiter Class
 * Implements sliding window rate limiting with persistent storage
 */
export class RateLimiter {
  private requests: RequestRecord[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxBurst: number;
  private readonly backoffMultiplier: number;
  private readonly maxBackoffMs: number;
  private readonly storageKey: string;
  private backoffUntil: number = 0;
  private stats: RateLimitStats;
  private static instance: RateLimiter | null = null;

  constructor(config: RateLimitConfig = {}) {
    this.maxRequests = config.maxRequests || RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_HOUR;
    this.windowMs = config.windowMs || RATE_LIMIT_CONFIG.WINDOW_MS;
    this.maxBurst = config.maxBurst || 5;
    this.backoffMultiplier = config.backoffMultiplier || 2;
    this.maxBackoffMs = config.maxBackoffMs || 60000;
    this.storageKey = config.storageKey || STORAGE_KEYS.RATE_LIMIT;
    
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      windowStart: Date.now(),
      windowEnd: Date.now() + this.windowMs,
    };
    
    this.loadFromStorage();
    this.setupAutoPrune();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: RateLimitConfig): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter(config);
    }
    return RateLimiter.instance;
  }

  /**
   * Check if a request can be made
   */
  canMakeRequest(): boolean {
    const now = Date.now();
    
    // Check if in backoff period
    if (this.backoffUntil > now) {
      return false;
    }
    
    // Prune old requests
    this.pruneOldRequests();
    
    // Check burst limit (requests in last minute)
    const recentRequests = this.requests.filter(
      r => r.timestamp > now - 60000
    );
    
    if (recentRequests.length >= this.maxBurst) {
      return false;
    }
    
    // Check window limit
    return this.requests.length < this.maxRequests;
  }

  /**
   * Record a request
   */
  recordRequest(endpoint?: string, success: boolean = true): void {
    const now = Date.now();
    const request: RequestRecord = {
      timestamp: now,
      endpoint,
      success,
    };
    
    this.requests.push(request);
    this.stats.totalRequests++;
    
    if (success) {
      this.stats.successfulRequests++;
      // Clear backoff on successful request
      this.backoffUntil = 0;
    } else {
      this.stats.failedRequests++;
      // Implement exponential backoff on failure
      this.applyBackoff();
    }
    
    this.stats.lastRequestTime = now;
    this.saveToStorage();
  }

  /**
   * Record a rate limited request
   */
  recordRateLimited(): void {
    this.stats.rateLimitedRequests++;
    this.applyBackoff();
    this.saveToStorage();
  }

  /**
   * Get rate limit information
   */
  getInfo(): RateLimitInfo {
    this.pruneOldRequests();
    const now = Date.now();
    const remaining = Math.max(0, this.maxRequests - this.requests.length);
    const resetTime = this.calculateResetTime();
    
    return {
      remaining,
      total: this.maxRequests,
      resetTime,
      retryAfter: this.backoffUntil > now ? this.backoffUntil - now : undefined,
      isLimited: remaining === 0 || this.backoffUntil > now,
    };
  }

  /**
   * Get formatted time until reset
   */
  getFormattedTimeUntilReset(): string {
    const resetTime = this.calculateResetTime();
    const now = Date.now();
    const diff = resetTime - now;
    
    if (diff <= 0) return 'now';
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Get rate limit statistics
   */
  getStats(): RateLimitStats {
    return {
      ...this.stats,
      averageRequestTime: this.calculateAverageRequestTime(),
    };
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.requests = [];
    this.backoffUntil = 0;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      windowStart: Date.now(),
      windowEnd: Date.now() + this.windowMs,
    };
    this.clearStorage();
  }

  /**
   * Prune requests outside the window
   */
  private pruneOldRequests(): void {
    const cutoff = Date.now() - this.windowMs;
    const originalLength = this.requests.length;
    
    this.requests = this.requests.filter(r => r.timestamp > cutoff);
    
    if (this.requests.length < originalLength) {
      this.saveToStorage();
    }
  }

  /**
   * Calculate reset time
   */
  private calculateResetTime(): number {
    if (this.requests.length === 0) {
      return Date.now();
    }
    
    const oldestRequest = this.requests[0];
    return oldestRequest.timestamp + this.windowMs;
  }

  /**
   * Apply exponential backoff
   */
  private applyBackoff(): void {
    const now = Date.now();
    
    if (this.backoffUntil <= now) {
      // Start with 1 second backoff
      this.backoffUntil = now + 1000;
    } else {
      // Exponential backoff
      const currentBackoff = this.backoffUntil - now;
      const newBackoff = Math.min(
        currentBackoff * this.backoffMultiplier,
        this.maxBackoffMs
      );
      this.backoffUntil = now + newBackoff;
    }
  }

  /**
   * Calculate average request time
   */
  private calculateAverageRequestTime(): number | undefined {
    if (this.requests.length < 2) return undefined;
    
    const times = this.requests.map(r => r.timestamp).sort((a, b) => a - b);
    let totalDiff = 0;
    
    for (let i = 1; i < times.length; i++) {
      totalDiff += times[i] - times[i - 1];
    }
    
    return totalDiff / (times.length - 1);
  }

  /**
   * Save state to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        requests: this.requests,
        backoffUntil: this.backoffUntil,
        stats: this.stats,
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save rate limit state:', error);
    }
  }

  /**
   * Load state from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.requests = parsed.requests || [];
        this.backoffUntil = parsed.backoffUntil || 0;
        this.stats = parsed.stats || this.stats;
        
        // Prune on load
        this.pruneOldRequests();
      }
    } catch (error) {
      console.warn('Failed to load rate limit state:', error);
    }
  }

  /**
   * Clear storage
   */
  private clearStorage(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to clear rate limit storage:', error);
    }
  }

  /**
   * Setup automatic pruning
   */
  private setupAutoPrune(): void {
    // Prune every minute
    setInterval(() => {
      this.pruneOldRequests();
    }, 60000);
  }
}

// Export singleton instance
export const rateLimiter = RateLimiter.getInstance();