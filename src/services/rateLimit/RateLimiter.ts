/**
 * Rate Limiter Service
 * Implements token bucket algorithm for API rate limiting
 */

import { RATE_LIMIT_CONFIG } from '@utils/constants';

export interface RateLimitInfo {
  remaining: number;
  resetTime: number | null;
  isLimited: boolean;
  nextAvailableTime: number | null;
}

export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private requests: number[] = [];
  private static instance: RateLimiter | null = null;

  constructor(
    maxRequests: number = RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_HOUR,
    windowMs: number = RATE_LIMIT_CONFIG.WINDOW_MS
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.loadState();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Check if a request can be made
   */
  canMakeRequest(): boolean {
    this.pruneOldRequests();
    return this.requests.length < this.maxRequests;
  }

  /**
   * Record a new request
   */
  recordRequest(): void {
    const now = Date.now();
    this.requests.push(now);
    this.saveState();
  }

  /**
   * Get detailed rate limit information
   */
  getInfo(): RateLimitInfo {
    this.pruneOldRequests();
    
    const remaining = Math.max(0, this.maxRequests - this.requests.length);
    const resetTime = this.getResetTime();
    const isLimited = remaining === 0;
    const nextAvailableTime = isLimited ? resetTime : null;

    return {
      remaining,
      resetTime,
      isLimited,
      nextAvailableTime,
    };
  }

  /**
   * Get the time when the rate limit resets
   */
  getResetTime(): number | null {
    if (this.requests.length === 0) return null;
    
    const oldestRequest = Math.min(...this.requests);
    return oldestRequest + this.windowMs;
  }

  /**
   * Get remaining requests count
   */
  getRemainingRequests(): number {
    this.pruneOldRequests();
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  /**
   * Wait until a request can be made
   */
  async waitForAvailability(): Promise<void> {
    while (!this.canMakeRequest()) {
      const resetTime = this.getResetTime();
      if (resetTime) {
        const waitTime = Math.max(0, resetTime - Date.now() + 1000);
        await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 5000)));
      } else {
        break;
      }
    }
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
    this.saveState();
  }

  /**
   * Remove requests outside the time window
   */
  private pruneOldRequests(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.requests = this.requests.filter(time => time > cutoff);
  }

  /**
   * Save state to localStorage
   */
  private saveState(): void {
    try {
      localStorage.setItem('rate_limiter_requests', JSON.stringify(this.requests));
    } catch (error) {
      console.warn('Failed to save rate limiter state:', error);
    }
  }

  /**
   * Load state from localStorage
   */
  private loadState(): void {
    try {
      const saved = localStorage.getItem('rate_limiter_requests');
      if (saved) {
        this.requests = JSON.parse(saved);
        this.pruneOldRequests();
      }
    } catch (error) {
      console.warn('Failed to load rate limiter state:', error);
      this.requests = [];
    }
  }

  /**
   * Get formatted time until reset
   */
  getFormattedTimeUntilReset(): string {
    const resetTime = this.getResetTime();
    if (!resetTime) return 'No limit';

    const now = Date.now();
    const diff = resetTime - now;
    
    if (diff <= 0) return 'Resetting...';

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }
}

// Export singleton instance
export const rateLimiter = RateLimiter.getInstance();
