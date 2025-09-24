/**
 * Traffic API Service
 * Production-ready service for interacting with 511.org API
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { z } from 'zod';
import {
  TrafficEvent,
  TrafficEventsResponse,
  TrafficEventParams,
  EventType,
  EventSeverity,
  EventStatus,
  APIErrorResponse,
} from '@/types/api.types';
import { CacheManager } from '@/services/cache/CacheManager';
import { RateLimiter } from '@/services/rateLimit/RateLimiter';
import { GEOFENCE, API_CONFIG, ERROR_MESSAGES } from '@/utils/constants';

// Custom error class for API errors
export class TrafficAPIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'TrafficAPIError';
  }
}

// Zod schema for runtime validation
const TrafficEventSchema = z.object({
  id: z.string(),
  status: z.nativeEnum(EventStatus),
  headline: z.string(),
  description: z.string().optional(),
  event_type: z.nativeEnum(EventType),
  severity: z.nativeEnum(EventSeverity),
  created: z.string(),
  updated: z.string(),
  geography: z.object({
    type: z.enum(['Point', 'LineString', 'MultiPoint', 'MultiLineString']),
    coordinates: z.union([
      z.array(z.number()),
      z.array(z.array(z.number())),
    ]),
  }),
  roads: z.array(z.object({
    name: z.string(),
    from: z.string().optional(),
    to: z.string().optional(),
    direction: z.string().optional(),
    state: z.string().optional(),
  })).optional(),
  areas: z.array(z.object({
    name: z.string(),
  })).optional(),
}).passthrough();

// Singleton instances
const cacheManager = new CacheManager();
const rateLimiter = new RateLimiter(
  parseInt(import.meta.env.VITE_RATE_LIMIT_MAX_REQUESTS || '60'),
  parseInt(import.meta.env.VITE_RATE_LIMIT_WINDOW_MS || '3600000')
);

/**
 * Traffic API Service Class
 */
export class TrafficAPI {
  private client: AxiosInstance;
  private apiKey: string | null = null;
  private baseURL: string;
  private retryCount = 3;
  private retryDelay = 1000;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || API_CONFIG.BASE_URL;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging and rate limiting
    this.client.interceptors.request.use(
      async (config) => {
        // Check rate limit
        if (!rateLimiter.canMakeRequest()) {
          throw new TrafficAPIError(
            ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
            'RATE_LIMITED',
            429
          );
        }

        // Add API key
        if (this.apiKey && config.params) {
          config.params.api_key = this.apiKey;
        }

        // Log request in development
        if (import.meta.env.DEV) {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.params);
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling and logging
    this.client.interceptors.response.use(
      (response) => {
        // Track successful request
        rateLimiter.trackRequest();

        // Log response in development
        if (import.meta.env.DEV) {
          console.log(`[API Response] ${response.status}`, response.data);
        }

        return response;
      },
      async (error: AxiosError) => {
        // Handle rate limiting from server
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            rateLimiter.setResetTime(Date.now() + parseInt(retryAfter) * 1000);
          }
        }

        // Retry logic for transient errors
        const config = error.config as AxiosRequestConfig & { __retryCount?: number };
        const shouldRetry = 
          error.response?.status === 503 || 
          error.response?.status === 502 ||
          error.code === 'ECONNABORTED';

        if (shouldRetry && config && (!config.__retryCount || config.__retryCount < this.retryCount)) {
          config.__retryCount = (config.__retryCount || 0) + 1;
          
          await new Promise(resolve => 
            setTimeout(resolve, this.retryDelay * Math.pow(2, config.__retryCount - 1))
          );
          
          return this.client(config);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Validate API key
   */
  async validateApiKey(apiKey?: string): Promise<boolean> {
    const keyToValidate = apiKey || this.apiKey;
    
    if (!keyToValidate) {
      return false;
    }

    try {
      const response = await this.client.get('/traffic/events', {
        params: {
          api_key: keyToValidate,
          limit: 1,
        },
      });
      
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Fetch traffic events with caching and validation
   */
  async fetchEvents(
    params: Partial<TrafficEventParams> = {}
  ): Promise<TrafficEvent[]> {
    if (!this.apiKey) {
      throw new TrafficAPIError(
        ERROR_MESSAGES.NO_API_KEY,
        'NO_API_KEY'
      );
    }

    // Build cache key
    const cacheKey = this.buildCacheKey('/traffic/events', params);
    
    // Check cache
    const cachedData = await cacheManager.get<TrafficEvent[]>(cacheKey);
    if (cachedData) {
      if (import.meta.env.DEV) {
        console.log('[API Cache Hit]', cacheKey);
      }
      return cachedData;
    }

    try {
      const response = await this.client.get<{ events: any[] }>('/traffic/events', {
        params: {
          ...params,
          api_key: this.apiKey,
          format: 'json',
          limit: params.limit || 500,
        },
      });

      // Validate response structure
      if (!response.data || !Array.isArray(response.data.events)) {
        throw new TrafficAPIError(
          'Invalid API response structure',
          'INVALID_RESPONSE'
        );
      }

      // Validate and transform events
      const validatedEvents: TrafficEvent[] = [];
      for (const event of response.data.events) {
        try {
          const validated = TrafficEventSchema.parse(event);
          validatedEvents.push(validated as TrafficEvent);
        } catch (validationError) {
          console.warn('Invalid event data:', event, validationError);
          // Continue processing other events
        }
      }

      // Cache the results
      await cacheManager.set(
        cacheKey,
        validatedEvents,
        parseInt(import.meta.env.VITE_CACHE_TTL || '30000')
      );

      return validatedEvents;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Fetch events within geofence boundaries
   */
  async fetchGeofencedEvents(
    params: Partial<TrafficEventParams> = {}
  ): Promise<TrafficEvent[]> {
    const bbox = `${GEOFENCE.BBOX.xmin},${GEOFENCE.BBOX.ymin},${GEOFENCE.BBOX.xmax},${GEOFENCE.BBOX.ymax}`;
    
    return this.fetchEvents({
      ...params,
      bbox,
    });
  }

  /**
   * Fetch events for specific roads
   */
  async fetchEventsByRoad(
    roadName: string,
    params: Partial<TrafficEventParams> = {}
  ): Promise<TrafficEvent[]> {
    return this.fetchEvents({
      ...params,
      road_name: roadName,
    });
  }

  /**
   * Fetch active closures
   */
  async fetchClosures(
    params: Partial<TrafficEventParams> = {}
  ): Promise<TrafficEvent[]> {
    const events = await this.fetchGeofencedEvents(params);
    
    return events.filter(event => 
      event.roads?.some(road => 
        road.state === 'CLOSED' || 
        road.state === 'Closed'
      ) ||
      event['+lane_status']?.toLowerCase().includes('closed')
    );
  }

  /**
   * Fetch high-severity events
   */
  async fetchHighSeverityEvents(
    params: Partial<TrafficEventParams> = {}
  ): Promise<TrafficEvent[]> {
    return this.fetchGeofencedEvents({
      ...params,
      severity: [EventSeverity.SEVERE, EventSeverity.MAJOR],
    });
  }

  /**
   * Search events by keyword
   */
  async searchEvents(
    keyword: string,
    params: Partial<TrafficEventParams> = {}
  ): Promise<TrafficEvent[]> {
    const events = await this.fetchGeofencedEvents(params);
    const searchTerm = keyword.toLowerCase();
    
    return events.filter(event => 
      event.headline?.toLowerCase().includes(searchTerm) ||
      event.description?.toLowerCase().includes(searchTerm) ||
      event.roads?.some(road => 
        road.name?.toLowerCase().includes(searchTerm)
      )
    );
  }

  /**
   * Get event by ID
   */
  async getEventById(eventId: string): Promise<TrafficEvent | null> {
    const events = await this.fetchGeofencedEvents();
    return events.find(event => event.id === eventId) || null;
  }

  /**
   * Build cache key from parameters
   */
  private buildCacheKey(endpoint: string, params: any): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        if (params[key] !== undefined && params[key] !== null) {
          acc[key] = params[key];
        }
        return acc;
      }, {} as any);
    
    return `${endpoint}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Handle API errors
   */
  private handleError(error: any): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<APIErrorResponse>;
      
      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data;
        
        switch (status) {
          case 401:
            throw new TrafficAPIError(
              ERROR_MESSAGES.INVALID_API_KEY,
              'UNAUTHORIZED',
              401
            );
          case 429:
            throw new TrafficAPIError(
              ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
              'RATE_LIMITED',
              429
            );
          case 500:
          case 502:
          case 503:
            throw new TrafficAPIError(
              'Service temporarily unavailable',
              'SERVICE_ERROR',
              status
            );
          default:
            throw new TrafficAPIError(
              data?.error?.message || 'API request failed',
              'API_ERROR',
              status,
              data
            );
        }
      } else if (axiosError.request) {
        throw new TrafficAPIError(
          ERROR_MESSAGES.NETWORK_ERROR,
          'NETWORK_ERROR'
        );
      }
    }
    
    throw new TrafficAPIError(
      ERROR_MESSAGES.UNKNOWN_ERROR,
      'UNKNOWN_ERROR',
      undefined,
      error
    );
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    await cacheManager.clear();
  }

  /**
   * Get API statistics
   */
  getStats() {
    return {
      rateLimit: rateLimiter.getInfo(),
      cacheStats: cacheManager.getStats(),
      apiKey: this.apiKey ? 'Set' : 'Not set',
      baseURL: this.baseURL,
    };
  }
}

// Export singleton instance
export const trafficAPI = new TrafficAPI();
