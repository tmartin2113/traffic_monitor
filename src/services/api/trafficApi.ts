/**
 * Traffic API Service
 * Handles all communication with the 511.org Traffic Events API
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { z } from 'zod';
import { 
  TrafficEvent, 
  TrafficEventsResponse, 
  WZDxResponse,
  EventType,
  EventSeverity 
} from '@types/api.types';
import { API_CONFIG, GEOFENCE, ERROR_MESSAGES } from '@utils/constants';
import { rateLimiter } from '@services/rateLimit/RateLimiter';
import { cacheManager } from '@services/cache/CacheManager';

// API Request Parameters
export interface TrafficEventParams {
  api_key: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
  event_type?: EventType;
  severity?: EventSeverity;
  bbox?: string;
  geography?: string;
  tolerance?: number;
  jurisdiction?: string;
  created?: string;
  updated?: string;
  road_name?: string;
  limit?: number;
  offset?: number;
  in_effect_on?: string;
  format?: 'json' | 'xml';
}

export interface WZDxParams {
  api_key: string;
  includeAllDefinedEnums?: boolean;
  activeAndFutureEventsUpTo?: string;
  allActiveAndFutureEvents?: boolean;
}

// Response validation schemas
const TrafficEventSchema = z.object({
  id: z.string(),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
  headline: z.string(),
  event_type: z.enum(['CONSTRUCTION', 'SPECIAL_EVENT', 'INCIDENT', 'WEATHER_CONDITION', 'ROAD_CONDITION']),
  severity: z.enum(['MINOR', 'MODERATE', 'MAJOR', 'SEVERE', 'UNKNOWN']),
  created: z.string(),
  updated: z.string(),
  geography: z.object({
    type: z.string(),
    coordinates: z.union([z.array(z.number()), z.array(z.array(z.number()))])
  }),
  // Optional fields
  event_subtypes: z.array(z.string()).optional(),
  roads: z.array(z.any()).optional(),
  areas: z.array(z.any()).optional(),
  schedules: z.array(z.any()).optional(),
  description: z.string().optional(),
  '+closure_geometry': z.any().optional(),
});

const TrafficEventsResponseSchema = z.object({
  events: z.array(TrafficEventSchema),
  pagination: z.any().optional(),
  meta: z.any().optional(),
});

// Error types
export class TrafficAPIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'TrafficAPIError';
  }
}

/**
 * Traffic API Service Class
 */
export class TrafficAPI {
  private client: AxiosInstance;
  private apiKey: string = '';

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      this.handleError
    );
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    localStorage.setItem('511_api_key', apiKey);
  }

  /**
   * Get API key
   */
  getApiKey(): string {
    if (!this.apiKey) {
      this.apiKey = localStorage.getItem('511_api_key') || API_CONFIG.DEFAULT_API_KEY;
    }
    return this.apiKey;
  }

  /**
   * Fetch traffic events with caching and rate limiting
   */
  async fetchEvents(params?: Partial<TrafficEventParams>): Promise<TrafficEventsResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new TrafficAPIError('API key is required', 'API_KEY_MISSING');
    }

    // Build cache key
    const cacheKey = this.buildCacheKey('events', { ...params, api_key: apiKey });
    
    // Check cache first
    const cachedData = await cacheManager.get<TrafficEventsResponse>(cacheKey);
    if (cachedData) {
      console.log('Returning cached events');
      return cachedData;
    }

    // Check rate limit
    if (!rateLimiter.canMakeRequest()) {
      const info = rateLimiter.getInfo();
      throw new TrafficAPIError(
        `Rate limit exceeded. Try again in ${rateLimiter.getFormattedTimeUntilReset()}`,
        'RATE_LIMIT_EXCEEDED',
        429,
        info
      );
    }

    // Build request parameters with defaults
    const requestParams: TrafficEventParams = {
      api_key: apiKey,
      status: 'ACTIVE',
      bbox: `${GEOFENCE.BBOX.xmin},${GEOFENCE.BBOX.ymin},${GEOFENCE.BBOX.xmax},${GEOFENCE.BBOX.ymax}`,
      format: 'json',
      ...params,
    };

    try {
      // Record the request
      rateLimiter.recordRequest();

      // Make API call
      const response = await this.client.get<TrafficEventsResponse>(
        API_CONFIG.ENDPOINTS.TRAFFIC_EVENTS,
        { params: requestParams }
      );

      // Validate response
      const validatedData = TrafficEventsResponseSchema.parse(response.data);

      // Cache the response
      await cacheManager.set(cacheKey, validatedData);

      return validatedData;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Fetch events within geofence
   */
  async fetchGeofencedEvents(params?: Partial<TrafficEventParams>): Promise<TrafficEvent[]> {
    const response = await this.fetchEvents(params);
    
    // Filter events within geofence (already done by bbox, but double-check)
    return response.events.filter(event => {
      if (!event.geography?.coordinates) return false;
      
      const coords = Array.isArray(event.geography.coordinates[0]) 
        ? event.geography.coordinates[0] 
        : event.geography.coordinates;
      
      const [lng, lat] = coords as number[];
      
      return (
        lng >= GEOFENCE.BBOX.xmin &&
        lng <= GEOFENCE.BBOX.xmax &&
        lat >= GEOFENCE.BBOX.ymin &&
        lat <= GEOFENCE.BBOX.ymax
      );
    });
  }

  /**
   * Fetch road closures only
   */
  async fetchClosures(params?: Partial<TrafficEventParams>): Promise<TrafficEvent[]> {
    const events = await this.fetchGeofencedEvents(params);
    
    return events.filter(event => {
      if (!event.roads || event.roads.length === 0) return false;
      
      return event.roads.some(road => 
        road.state === 'CLOSED' || 
        road.state === 'SOME_LANES_CLOSED'
      );
    });
  }

  /**
   * Fetch WZDx work zone data
   */
  async fetchWZDx(params?: Partial<WZDxParams>): Promise<WZDxResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new TrafficAPIError('API key is required', 'API_KEY_MISSING');
    }

    // Check rate limit
    if (!rateLimiter.canMakeRequest()) {
      const info = rateLimiter.getInfo();
      throw new TrafficAPIError(
        `Rate limit exceeded. Try again in ${rateLimiter.getFormattedTimeUntilReset()}`,
        'RATE_LIMIT_EXCEEDED',
        429,
        info
      );
    }

    const requestParams: WZDxParams = {
      api_key: apiKey,
      ...params,
    };

    try {
      rateLimiter.recordRequest();
      
      const response = await this.client.get<WZDxResponse>(
        API_CONFIG.ENDPOINTS.WZDX,
        { params: requestParams }
      );

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Search events by keyword
   */
  async searchEvents(
    keyword: string, 
    params?: Partial<TrafficEventParams>
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
      const axiosError = error as AxiosError;
      
      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data as any;
        
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
              data?.message || 'API request failed',
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
    };
  }
}

// Export singleton instance
export const trafficAPI = new TrafficAPI();
