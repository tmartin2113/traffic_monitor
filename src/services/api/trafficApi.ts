/**
 * @file services/api/trafficApi.ts
 * @description Production-ready 511 Traffic API client with exponential backoff retry
 * @version 3.0.0
 * 
 * FIXES BUG #19: Implements automatic retry logic with exponential backoff
 * 
 * Production Standards:
 * - Automatic retry with exponential backoff for transient failures
 * - Configurable retry behavior (attempts, delays, status codes)
 * - Proper error handling and classification
 * - AbortSignal support for request cancellation
 * - Comprehensive logging
 * - Type-safe API responses
 * - Rate limiting integration
 */

import { envConfig } from '@config/env';
import { logger } from '@utils/logger';
import { rateLimiter } from '@services/rateLimit/RateLimiter';
import type { TrafficEvent, EventType, EventSeverity } from '@types/api.types';
import { z } from 'zod';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Retry configuration for API requests
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  baseDelay: number;
  /** Maximum delay cap in milliseconds */
  maxDelay: number;
  /** Backoff multiplier (typically 2 for exponential backoff) */
  backoffMultiplier: number;
  /** HTTP status codes that should trigger a retry */
  retryableStatusCodes: number[];
  /** Whether to add jitter to prevent thundering herd */
  useJitter: boolean;
}

/**
 * Fetch options for API requests
 */
export interface FetchOptions {
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
  /** Custom timeout in milliseconds */
  timeout?: number;
  /** Override retry configuration */
  retryConfig?: Partial<RetryConfig>;
  /** Skip rate limiting check */
  skipRateLimit?: boolean;
}

/**
 * Query parameters for fetchEvents
 */
export interface EventQueryParams {
  /** Limit number of results */
  limit?: number;
  /** Filter by event types */
  eventTypes?: EventType[];
  /** Filter by severity levels */
  severities?: EventSeverity[];
  /** Filter by status */
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
  /** Custom parameters */
  [key: string]: any;
}

/**
 * API Error class for detailed error information
 */
export class TrafficAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'TrafficAPIError';
  }
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default retry configuration following industry best practices
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  useJitter: true,
};

// ============================================================================
// TRAFFIC API CLASS
// ============================================================================

/**
 * Production-ready Traffic API Client
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Rate limiting integration
 * - Request timeout handling
 * - Comprehensive error handling
 * - AbortSignal support
 * - Type-safe responses
 */
class TrafficAPI {
  private apiKey: string | null = null;
  private baseURL: string;
  private defaultTimeout: number;
  private retryConfig: RetryConfig;

  constructor() {
    this.baseURL = envConfig.VITE_API_BASE_URL;
    this.defaultTimeout = envConfig.VITE_API_TIMEOUT;
    this.retryConfig = DEFAULT_RETRY_CONFIG;

    // Initialize with environment API key if available
    if (envConfig.VITE_511_API_KEY) {
      this.apiKey = envConfig.VITE_511_API_KEY;
    }
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Set API key for authenticated requests
   */
  public setApiKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new TrafficAPIError('Invalid API key provided');
    }
    this.apiKey = key.trim();
    logger.debug('API key updated');
  }

  /**
   * Get current API key
   */
  public getApiKey(): string | null {
    return this.apiKey;
  }

  /**
   * Update retry configuration
   */
  public setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
    logger.debug('Retry configuration updated', this.retryConfig);
  }

  /**
   * Fetch traffic events with automatic retry
   * 
   * @param params - Query parameters for filtering events
   * @param options - Fetch options including signal and timeout
   * @returns Promise resolving to array of traffic events
   * @throws TrafficAPIError on failure after all retries
   */
  public async fetchEvents(
    params: EventQueryParams = {},
    options: FetchOptions = {}
  ): Promise<TrafficEvent[]> {
    if (!this.apiKey) {
      throw new TrafficAPIError('API key not configured', 401, false);
    }

    // Check rate limit unless explicitly skipped
    if (!options.skipRateLimit) {
      const canProceed = await rateLimiter.checkLimit();
      if (!canProceed) {
        throw new TrafficAPIError(
          'Rate limit exceeded. Please wait before making more requests.',
          429,
          true
        );
      }
    }

    // Build request URL
    const url = this.buildURL('/traffic/events', {
      api_key: this.apiKey,
      format: 'json',
      ...params,
    });

    // Execute request with retry logic
    const response = await this.fetchWithRetry(url, options);

    // Parse and validate response
    return this.parseEventsResponse(response);
  }

  /**
   * Fetch events within a geographic boundary
   */
  public async fetchGeofencedEvents(
    params: EventQueryParams & {
      bbox?: [number, number, number, number];
    } = {},
    options: FetchOptions = {}
  ): Promise<TrafficEvent[]> {
    return this.fetchEvents(params, options);
  }

  /**
   * Test API connection and key validity
   */
  public async healthCheck(options: FetchOptions = {}): Promise<boolean> {
    try {
      await this.fetchEvents({ limit: 1 }, { ...options, skipRateLimit: true });
      return true;
    } catch (error) {
      logger.warn('Health check failed', { error });
      return false;
    }
  }

  // ==========================================================================
  // PRIVATE RETRY LOGIC
  // ==========================================================================

  /**
   * Execute HTTP request with exponential backoff retry
   * 
   * Implements industry-standard retry logic:
   * 1. Attempts request
   * 2. On failure, determines if error is retryable
   * 3. Calculates exponential backoff delay with optional jitter
   * 4. Retries up to maxAttempts times
   * 5. Throws error if all attempts fail
   */
  private async fetchWithRetry(
    url: string,
    options: FetchOptions = {}
  ): Promise<any> {
    const config = { ...this.retryConfig, ...options.retryConfig };
    const timeout = options.timeout || this.defaultTimeout;
    
    let lastError: TrafficAPIError | null = null;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        logger.debug(`API request attempt ${attempt}/${config.maxAttempts}`, { url });

        // Create timeout controller
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // Link external abort signal if provided
        if (options.signal) {
          options.signal.addEventListener('abort', () => controller.abort());
        }

        try {
          // Execute fetch
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'TrafficMonitor/1.0',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Handle HTTP errors
          if (!response.ok) {
            const isRetryable = config.retryableStatusCodes.includes(response.status);
            const errorBody = await response.text().catch(() => 'No error body');
            
            throw new TrafficAPIError(
              `HTTP ${response.status}: ${response.statusText}. ${errorBody}`,
              response.status,
              isRetryable,
              response
            );
          }

          // Parse JSON response
          const data = await response.json();
          
          // Record success metrics
          const duration = Date.now() - startTime;
          logger.debug(`API request successful after ${attempt} attempt(s)`, {
            duration,
            attempts: attempt,
          });

          return data;

        } catch (fetchError) {
          clearTimeout(timeoutId);

          // Handle abort
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new TrafficAPIError(
              'Request aborted or timed out',
              408,
              true,
              fetchError
            );
          }

          throw fetchError;
        }

      } catch (error) {
        lastError = this.normalizeError(error);

        // Don't retry if not retryable or if this was the last attempt
        if (!lastError.retryable || attempt === config.maxAttempts) {
          logger.error(`API request failed after ${attempt} attempt(s)`, {
            error: lastError.message,
            statusCode: lastError.statusCode,
            totalDuration: Date.now() - startTime,
          });
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateBackoffDelay(attempt, config);
        
        logger.warn(
          `API request failed (attempt ${attempt}/${config.maxAttempts}), retrying in ${delay}ms`,
          {
            error: lastError.message,
            statusCode: lastError.statusCode,
            nextAttempt: attempt + 1,
          }
        );

        // Wait before retry (unless aborted)
        await this.sleep(delay, options.signal);
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError || new TrafficAPIError('Request failed with unknown error');
  }

  /**
   * Calculate exponential backoff delay with optional jitter
   * 
   * Formula: min(maxDelay, baseDelay * (backoffMultiplier ^ (attempt - 1)))
   * Jitter: Add random variance to prevent thundering herd problem
   */
  private calculateBackoffDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelay * Math.pow(
      config.backoffMultiplier,
      attempt - 1
    );

    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

    if (config.useJitter) {
      // Add ±25% jitter
      const jitter = cappedDelay * 0.25;
      const randomJitter = (Math.random() - 0.5) * 2 * jitter;
      return Math.max(0, Math.floor(cappedDelay + randomJitter));
    }

    return Math.floor(cappedDelay);
  }

  /**
   * Normalize various error types into TrafficAPIError
   */
  private normalizeError(error: unknown): TrafficAPIError {
    if (error instanceof TrafficAPIError) {
      return error;
    }

    if (error instanceof Error) {
      // Network errors are retryable
      const isNetworkError = error.message.toLowerCase().includes('network') ||
                             error.message.toLowerCase().includes('fetch') ||
                             error.name === 'TypeError';

      return new TrafficAPIError(
        error.message,
        undefined,
        isNetworkError,
        error
      );
    }

    return new TrafficAPIError(
      'Unknown error occurred',
      undefined,
      false,
      error
    );
  }

  /**
   * Sleep for specified duration (respects abort signal)
   */
  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new TrafficAPIError('Request aborted', 0, false));
        return;
      }

      const timeout = setTimeout(resolve, ms);

      signal?.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new TrafficAPIError('Request aborted', 0, false));
      });
    });
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Build complete URL with query parameters
   */
  private buildURL(path: string, params: Record<string, any>): string {
    const url = new URL(path, this.baseURL);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          url.searchParams.append(key, value.join(','));
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    });

    return url.toString();
  }

  /**
   * Parse and validate events response
   */
  private parseEventsResponse(data: any): TrafficEvent[] {
    if (!data) {
      throw new TrafficAPIError('Empty response from API', 500, false);
    }

    // Handle different response structures
    const events = data.events || data.features || data;

    if (!Array.isArray(events)) {
      throw new TrafficAPIError(
        'Invalid response format: expected array of events',
        500,
        false
      );
    }

    logger.debug(`Parsed ${events.length} events from API response`);

    return events;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Singleton instance of TrafficAPI
 */
export const trafficAPI = new TrafficAPI();

/**
 * Export class for testing purposes
 */
export { TrafficAPI };
