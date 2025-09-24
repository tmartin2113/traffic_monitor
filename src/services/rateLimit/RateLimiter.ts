/**
 * Rate Limiter Service
 * Implements token bucket algorithm for API rate limiting
 */

import { RATE_LIMIT_CONFIG, STORAGE_KEYS } from '@/utils/constants';

interface RateLimitInfo {
  remaining: number;
  total: number;
  resetTime: number | null;
  isLimited: boolean;
  percentageUsed: number;
  timeUntilReset: number | null;
}

interface RateLimitState {
  requests: number[];
  lastReset: number;
  violations: number;
}

export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private requests: number[];
  private lastReset: number;
  private violations: number;
  private warningThreshold: number;
  private persistToStorage: boolean;
  private storageKey: string;

  constructor(
    maxRequests = RATE_LIMIT_CONFIG.MAX_REQUESTS,
    windowMs = RATE_LIMIT_CONFIG.WINDOW_MS,
    persistToStorage = true
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
    this.lastReset = Date.now();
    this.violations = 0;
    this.warningThreshold = RATE_LIMIT_CONFIG.WARNING_THRESHOLD;
    this.persistToStorage = persistToStorage && this.isStorageAvailable();
    this.storageKey = STORAGE_KEYS.RATE_LIMIT;

    // Load state from storage
    if (this.persistToStorage) {
      this.loadState();
    }

    // Set up periodic cleanup
    this.startCleanupInterval();
  }

  /**
   * Check if request can be made
   */
  canMakeRequest(): boolean {
    this.cleanup();
    return this.requests.length < this.maxRequests;
  }

  /**
   * Track a request
   */
  trackRequest(): boolean {
    this.cleanup();

    if (this.requests.length >= this.maxRequests) {
      this.violations++;
      this.saveState();
      return false;
    }

    const now = Date.now();
    this.requests.push(now);
    this.saveState();
    return true;
  }

  /**
   * Get rate limit information
   */
  getInfo(): RateLimitInfo {
    this.cleanup();

    const remaining = Math.max(0, this.maxRequests - this.requests.length);
    const percentageUsed = (this.requests.length / this.maxRequests) * 100;
    const resetTime = this.getResetTime();
    const timeUntilReset = resetTime ? resetTime - Date.now() : null;

    return {
      remaining,
      total: this.maxRequests,
      resetTime,
      isLimited: remaining === 0,
      percentageUsed,
      timeUntilReset: timeUntilReset && timeUntilReset > 0 ? timeUntilReset : null,
    };
  }

  /**
   * Get remaining requests
   */
  getRemainingRequests(): number {
    this.cleanup();
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  /**
   * Check if rate limit is exceeded
   */
  isRateLimited(): boolean {
    this.cleanup();
    return this.requests.length >= this.maxRequests;
  }

  /**
   * Check if warning threshold reached
   */
  isWarningThreshold(): boolean {
    const remaining = this.getRemainingRequests();
    return remaining <= this.warningThreshold && remaining > 0;
  }

  /**
   * Get reset time
   */
  getResetTime(): number | null {
    if (this.requests.length === 0) {
      return null;
    }

    const oldestRequest = Math.min(...this.requests);
    return oldestRequest + this.windowMs;
  }

  /**
   * Set reset time (for server-provided reset times)
   */
  setResetTime(resetTime: number): void {
    // Adjust internal state based on server reset time
    const now = Date.now();
    
    if (resetTime > now) {
      // Block all requests until reset time
      this.requests = Array(this.maxRequests).fill(now);
      this.saveState();
    }
  }

  /**
   * Reset rate limit
   */
  reset(): void {
    this.requests = [];
    this.lastReset = Date.now();
    this.violations = 0;
    this.saveState();
  }

  /**
   * Clean up expired requests
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    
    // Remove requests outside the window
    this.requests = this.requests.filter(timestamp => timestamp > cutoff);
    
    // Reset violations counter if window has passed
    if (now - this.lastReset > this.windowMs) {
      this.violations = 0;
      this.lastReset = now;
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    // Clean up every 10 seconds
    setInterval(() => {
      this.cleanup();
      this.saveState();
    }, 10000);
  }

  /**
   * Check if storage is available
   */
  private isStorageAvailable(): boolean {
    try {
      const test = '__rate_limit_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save state to storage
   */
  private saveState(): void {
    if (!this.persistToStorage) return;

    try {
      const state: RateLimitState = {
        requests: this.requests,
        lastReset: this.lastReset,
        violations: this.violations,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save rate limit state:', error);
    }
  }

  /**
   * Load state from storage
   */
  private loadState(): void {
    if (!this.persistToStorage) return;

    try {
      const stored = localStorage.getItem(this.storageKey);
      
      if (stored) {
        const state: RateLimitState = JSON.parse(stored);
        
        // Validate and restore state
        if (Array.isArray(state.requests)) {
          this.requests = state.requests;
          this.lastReset = state.lastReset || Date.now();
          this.violations = state.violations || 0;
          
          // Clean up old requests
          this.cleanup();
        }
      }
    } catch (error) {
      console.error('Failed to load rate limit state:', error);
      this.reset();
    }
  }

  /**
   * Get violation count
   */
  getViolationCount(): number {
    return this.violations;
  }

  /**
   * Get formatted time until reset
   */
  getFormattedTimeUntilReset(): string {
    const info = this.getInfo();
    
    if (!info.timeUntilReset) {
      return 'Ready';
    }

    const seconds = Math.ceil(info.timeUntilReset / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return remainingSeconds > 0 
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }

  /**
   * Update configuration
   */
  updateConfig(maxRequests?: number, windowMs?: number): void {
    if (maxRequests !== undefined && maxRequests > 0) {
      this.maxRequests = maxRequests;
    }

    if (windowMs !== undefined && windowMs > 0) {
      this.windowMs = windowMs;
    }

    this.cleanup();
    this.saveState();
  }

  /**
   * Get statistics
   */
  getStatistics() {
    this.cleanup();

    const info = this.getInfo();
    const requestsInLastMinute = this.requests.filter(
      t => t > Date.now() - 60000
    ).length;

    const requestsInLastHour = this.requests.filter(
      t => t > Date.now() - 3600000
    ).length;

    return {
      current: this.requests.length,
      remaining: info.remaining,
      total: this.maxRequests,
      percentageUsed: info.percentageUsed,
      violations: this.violations,
      isLimited: info.isLimited,
      isWarning: this.isWarningThreshold(),
      resetTime: info.resetTime,
      formattedResetTime: this.getFormattedTimeUntilReset(),
      requestsInLastMinute,
      requestsInLastHour,
      averageRequestsPerMinute: requestsInLastHour / 60,
    };
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
