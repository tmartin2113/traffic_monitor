/**
 * Traffic API Service with Differential Updates
 * Production-ready implementation for 511.org Bay Area Traffic Data
 * 
 * @module services/api/trafficApi
 * @version 2.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { z } from 'zod';
import { 
  TrafficEvent, 
  TrafficEventsResponse,
  EventType,
  EventSeverity,
  Geography,
  Road,
  Area,
  SourceType,
  Pagination,
  Meta
} from '@types/api.types';
import { API_CONFIG, GEOFENCE, CACHE_CONFIG } from '@utils/constants';
import { rateLimiter } from '@services/rateLimit/RateLimiter';
import { cacheManager } from '@services/cache/CacheManager';
import { isPointInBounds, isLineIntersectsBounds } from '@utils/geoUtils';

// ============================================================================
// Type Definitions
// ============================================================================

export interface TrafficParams {
  api_key: string;
  event_type?: EventType;
  severity?: EventSeverity;
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
  jurisdiction?: string;
  bbox?: string;
  limit?: number;
  offset?: number;
  format?: 'json' | 'xml';
  include_geometry?: boolean;
}

export interface DifferentialParams extends TrafficParams {
  since?: string;
  include_deleted?: boolean;
  version_only?: boolean;
  compression?: 'gzip' | 'none';
}

export interface DifferentialResponse {
  hasChanges: boolean;
  added: TrafficEvent[];
  updated: TrafficEvent[];
  deleted: string[];
  timestamp: string;
  metadata: {
    totalChanges: number;
    syncVersion: string;
    compressed: boolean;
    fromTimestamp?: string;
    toTimestamp: string;
  };
}

export interface EventVersion {
  id: string;
  version: string;
  updated: string;
  hash?: string;
}

export interface SyncState {
  lastSyncTimestamp: string | null;
  eventVersions: Map<string, EventVersion>;
  syncId: string;
  totalEvents: number;
}

export class TrafficAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'TrafficAPIError';
    Object.setPrototypeOf(this, TrafficAPIError.prototype);
  }
}

// ============================================================================
// Schema Validation
// ============================================================================

const TrafficEventSchema = z.object({
  id: z.string(),
  self: z.string().optional(),
  jurisdiction: z.string().optional(),
  event_type: z.nativeEnum(EventType),
  event_subtypes: z.array(z.string()).optional(),
  severity: z.nativeEnum(EventSeverity),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
  headline: z.string().optional(),
  description: z.string().optional(),
  created: z.string(),
  updated: z.string(),
  schedule: z.any().optional(),
  geography: z.object({
    type: z.string(),
    coordinates: z.array(z.any())
  }).optional(),
  roads: z.array(z.object({
    name: z.string(),
    from: z.string().optional(),
    to: z.string().optional(),
    direction: z.string().optional(),
    state: z.nativeEnum(RoadState).optional(),
    lanes_blocked: z.array(z.string()).optional(),
    impacted_systems: z.array(z.string()).optional()
  })).optional(),
  areas: z.array(z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().optional()
  })).optional()
});

const TrafficEventsResponseSchema = z.object({
  events: z.array(TrafficEventSchema),
  pagination: z.object({
    offset: z.number(),
    limit: z.number().optional(),
    next_url: z.string().optional(),
    previous_url: z.string().optional()
  }).optional(),
  meta: z.object({
    url: z.string(),
    up_url: z.string().optional(),
    version: z.string()
  }).optional()
});

// ============================================================================
// Main API Class
// ============================================================================

export class TrafficAPI {
  private axiosInstance: AxiosInstance;
  private apiKey: string | null = null;
  private syncState: SyncState;
  private lastETag: string | null = null;
  private compressionSupported: boolean = true;
  private retryQueue: Map<string, number> = new Map();
  private activeRequests: Map<string, Promise<any>> = new Map();

  constructor(apiKey?: string) {
    this.apiKey = apiKey || null;
    this.syncState = {
      lastSyncTimestamp: null,
      eventVersions: new Map(),
      syncId: this.generateSyncId(),
      totalEvents: 0
    };

    this.axiosInstance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.REQUEST_TIMEOUT_MS,
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': `511-Traffic-Monitor/2.0.0`,
        'X-Client-Id': this.syncState.syncId
      },
      validateStatus: (status) => status < 500
    });

    this.setupInterceptors();
    this.loadSyncState();
  }

  /**
   * Setup axios interceptors for request/response handling
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Add API key
        if (this.apiKey) {
          config.params = {
            ...config.params,
            api_key: this.apiKey
          };
        }

        // Add conditional headers for differential updates
        if (this.syncState.lastSyncTimestamp && config.headers) {
          config.headers['If-Modified-Since'] = this.syncState.lastSyncTimestamp;
        }

        if (this.lastETag && config.headers) {
          config.headers['If-None-Match'] = this.lastETag;
        }

        // Add request tracking
        config.headers['X-Request-Id'] = this.generateRequestId();

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Store ETag for future requests
        if (response.headers['etag']) {
          this.lastETag = response.headers['etag'];
        }

        // Update last modified timestamp
        if (response.headers['last-modified']) {
          this.syncState.lastSyncTimestamp = response.headers['last-modified'];
        }

        return response;
      },
      async (error: AxiosError) => {
        if (error.response?.status === 429) {
          // Handle rate limiting with exponential backoff
          return this.handleRateLimit(error);
        }

        if (error.response?.status === 503 || error.code === 'ECONNABORTED') {
          // Handle service unavailable with retry
          return this.handleServiceUnavailable(error);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Set or update API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Fetch all events within the geofenced area
   */
  async fetchGeofencedEvents(
    params: Partial<TrafficParams> = {}
  ): Promise<TrafficEvent[]> {
    const cacheKey = this.buildCacheKey('events-geofenced', params);
    
    // Check for pending request deduplication
    if (this.activeRequests.has(cacheKey)) {
      return this.activeRequests.get(cacheKey);
    }

    // Check cache
    const cached = await cacheManager.get<TrafficEvent[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const request = this.performGeofencedFetch(params, cacheKey);
    this.activeRequests.set(cacheKey, request);

    try {
      const result = await request;
      return result;
    } finally {
      this.activeRequests.delete(cacheKey);
    }
  }

  /**
   * Perform the actual geofenced fetch
   */
  private async performGeofencedFetch(
    params: Partial<TrafficParams>,
    cacheKey: string
  ): Promise<TrafficEvent[]> {
    // Check rate limit
    await rateLimiter.checkLimit();

    try {
      const response = await this.axiosInstance.get<TrafficEventsResponse>('/traffic/events', {
        params: {
          ...params,
          bbox: this.getGeofenceBBox(),
          limit: params.limit || API_CONFIG.DEFAULT_PAGE_SIZE,
          offset: params.offset || 0,
          format: 'json',
          include_geometry: true
        }
      });

      // Handle 304 Not Modified
      if (response.status === 304) {
        const cached = await cacheManager.get<TrafficEvent[]>(cacheKey);
        if (cached) return cached;
      }

      // Validate response
      const validated = TrafficEventsResponseSchema.parse(response.data);
      
      // Filter events within geofence
      const filteredEvents = this.filterEventsInGeofence(validated.events);
      
      // Update sync state
      this.updateEventVersions(filteredEvents);
      
      // Cache the results
      await cacheManager.set(
        cacheKey, 
        filteredEvents, 
        CACHE_CONFIG.DEFAULT_TTL_MS
      );

      return filteredEvents;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Fetch differential updates since last sync
   */
  async fetchDifferentialUpdates(
    params: Partial<DifferentialParams> = {}
  ): Promise<DifferentialResponse> {
    const cacheKey = this.buildCacheKey('differential', params);
    
    // Check cache for recent differential
    const cached = await cacheManager.get<DifferentialResponse>(cacheKey);
    if (cached && this.isDifferentialValid(cached)) {
      return cached;
    }

    // Check rate limit
    await rateLimiter.checkLimit();

    try {
      const response = await this.axiosInstance.get('/traffic/events', {
        params: {
          ...params,
          bbox: this.getGeofenceBBox(),
          since: params.since || this.syncState.lastSyncTimestamp,
          format: 'json',
          include_geometry: true
        },
        headers: {
          'X-Differential-Mode': 'true',
          'X-Include-Deleted': params.include_deleted ? 'true' : 'false',
          'X-Compression': params.compression || 'gzip'
        }
      });

      // Handle 304 Not Modified - no changes
      if (response.status === 304) {
        return this.createEmptyDifferential();
      }

      // Process differential response
      const differential = await this.processDifferentialResponse(
        response.data,
        params.since || this.syncState.lastSyncTimestamp
      );

      // Update sync state
      if (differential.hasChanges) {
        this.syncState.lastSyncTimestamp = differential.timestamp;
        this.updateDifferentialVersions(differential);
        this.saveSyncState();
      }

      // Cache the differential
      await cacheManager.set(
        cacheKey,
        differential,
        15000 // 15 second cache for differentials
      );

      return differential;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Process raw API response into differential format
   */
  private async processDifferentialResponse(
    data: TrafficEventsResponse,
    sinceTimestamp: string | null
  ): Promise<DifferentialResponse> {
    const events = data.events || [];
    const added: TrafficEvent[] = [];
    const updated: TrafficEvent[] = [];
    const deleted: string[] = [];

    // Get current version map
    const currentVersions = new Map(this.syncState.eventVersions);

    // Process each event
    for (const event of events) {
      const filteredEvent = this.filterEventInGeofence(event);
      if (!filteredEvent) continue;

      const existingVersion = currentVersions.get(event.id);

      if (!existingVersion) {
        // New event
        added.push(event);
      } else if (this.hasEventChanged(existingVersion, event)) {
        // Updated event
        updated.push(event);
      }
    }

    // Detect deletions (events that existed before but aren't in response)
    if (sinceTimestamp && data.meta?.version) {
      const currentEventIds = new Set(events.map(e => e.id));
      for (const [id, version] of currentVersions) {
        if (!currentEventIds.has(id)) {
          deleted.push(id);
        }
      }
    }

    const totalChanges = added.length + updated.length + deleted.length;

    return {
      hasChanges: totalChanges > 0,
      added,
      updated,
      deleted,
      timestamp: new Date().toISOString(),
      metadata: {
        totalChanges,
        syncVersion: data.meta?.version || '1.0',
        compressed: false,
        fromTimestamp: sinceTimestamp || undefined,
        toTimestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Get a single event by ID
   */
  async getEventById(eventId: string): Promise<TrafficEvent | null> {
    const cacheKey = `event:${eventId}`;
    
    // Check cache
    const cached = await cacheManager.get<TrafficEvent>(cacheKey);
    if (cached) return cached;

    // Check rate limit
    await rateLimiter.checkLimit();

    try {
      const response = await this.axiosInstance.get<TrafficEvent>(
        `/traffic/events/${eventId}`
      );

      if (response.status === 404) {
        return null;
      }

      const validated = TrafficEventSchema.parse(response.data);
      
      // Cache the result
      await cacheManager.set(cacheKey, validated, 60000); // 1 minute cache

      return validated;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.handleError(error);
    }
  }

  /**
   * Check if differential is still valid
   */
  private isDifferentialValid(diff: DifferentialResponse): boolean {
    const age = Date.now() - new Date(diff.timestamp).getTime();
    return age < 15000; // Valid for 15 seconds
  }

  /**
   * Create empty differential response
   */
  private createEmptyDifferential(): DifferentialResponse {
    return {
      hasChanges: false,
      added: [],
      updated: [],
      deleted: [],
      timestamp: new Date().toISOString(),
      metadata: {
        totalChanges: 0,
        syncVersion: '1.0',
        compressed: false,
        toTimestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Filter events within geofence boundaries
   */
  private filterEventsInGeofence(events: TrafficEvent[]): TrafficEvent[] {
    return events.filter(event => this.filterEventInGeofence(event));
  }

  /**
   * Check if single event is within geofence
   */
  private filterEventInGeofence(event: TrafficEvent): TrafficEvent | null {
    if (!event.geography?.coordinates) return event; // No geography, include it

    const { type, coordinates } = event.geography;

    if (type === 'Point') {
      const [lng, lat] = coordinates as [number, number];
      if (!isPointInBounds({ lat, lng }, GEOFENCE.BBOX)) {
        return null;
      }
    } else if (type === 'LineString') {
      if (!isLineIntersectsBounds(coordinates as number[][], GEOFENCE.BBOX)) {
        return null;
      }
    }

    return event;
  }

  /**
   * Check if event has changed
   */
  private hasEventChanged(
    oldVersion: EventVersion,
    newEvent: TrafficEvent
  ): boolean {
    return oldVersion.updated !== newEvent.updated ||
           oldVersion.version !== this.generateEventVersion(newEvent);
  }

  /**
   * Generate version hash for an event
   */
  private generateEventVersion(event: TrafficEvent): string {
    // Create a simple hash based on key fields
    const versionString = `${event.updated}-${event.status}-${event.severity}`;
    return Buffer.from(versionString).toString('base64').substring(0, 8);
  }

  /**
   * Update event versions in sync state
   */
  private updateEventVersions(events: TrafficEvent[]): void {
    for (const event of events) {
      this.syncState.eventVersions.set(event.id, {
        id: event.id,
        version: this.generateEventVersion(event),
        updated: event.updated,
        hash: this.generateEventHash(event)
      });
    }
    this.syncState.totalEvents = this.syncState.eventVersions.size;
  }

  /**
   * Update versions from differential
   */
  private updateDifferentialVersions(diff: DifferentialResponse): void {
    // Remove deleted events
    for (const id of diff.deleted) {
      this.syncState.eventVersions.delete(id);
    }

    // Add/update events
    for (const event of [...diff.added, ...diff.updated]) {
      this.syncState.eventVersions.set(event.id, {
        id: event.id,
        version: this.generateEventVersion(event),
        updated: event.updated,
        hash: this.generateEventHash(event)
      });
    }

    this.syncState.totalEvents = this.syncState.eventVersions.size;
  }

  /**
   * Generate hash for event content
   */
  private generateEventHash(event: TrafficEvent): string {
    const content = JSON.stringify({
      id: event.id,
      status: event.status,
      severity: event.severity,
      headline: event.headline,
      updated: event.updated
    });
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Get geofence bounding box string
   */
  private getGeofenceBBox(): string {
    const { xmin, ymin, xmax, ymax } = GEOFENCE.BBOX;
    return `${xmin},${ymin},${xmax},${ymax}`;
  }

  /**
   * Build cache key from parameters
   */
  private buildCacheKey(prefix: string, params: any): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        if (params[key] !== undefined && params[key] !== null) {
          acc[key] = params[key];
        }
        return acc;
      }, {} as any);
    
    return `${prefix}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Generate unique sync ID
   */
  private generateSyncId(): string {
    return `sync-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Handle rate limit errors with exponential backoff
   */
  private async handleRateLimit(error: AxiosError): Promise<any> {
    const config = error.config!;
    const retryAfter = parseInt(
      error.response?.headers['retry-after'] || '60'
    );
    
    const retryCount = this.retryQueue.get(config.url!) || 0;
    
    if (retryCount >= 3) {
      this.retryQueue.delete(config.url!);
      throw new TrafficAPIError(
        'Rate limit exceeded after multiple retries',
        'RATE_LIMIT_EXCEEDED',
        429
      );
    }

    this.retryQueue.set(config.url!, retryCount + 1);
    
    // Wait with exponential backoff
    const delay = Math.min(retryAfter * 1000, 60000) * Math.pow(2, retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      const response = await this.axiosInstance.request(config);
      this.retryQueue.delete(config.url!);
      return response;
    } catch (retryError) {
      this.retryQueue.delete(config.url!);
      throw retryError;
    }
  }

  /**
   * Handle service unavailable errors
   */
  private async handleServiceUnavailable(error: AxiosError): Promise<any> {
    const config = error.config!;
    const retryCount = this.retryQueue.get(config.url!) || 0;
    
    if (retryCount >= 3) {
      this.retryQueue.delete(config.url!);
      throw new TrafficAPIError(
        'Service unavailable after multiple retries',
        'SERVICE_UNAVAILABLE',
        503
      );
    }

    this.retryQueue.set(config.url!, retryCount + 1);
    
    // Wait with exponential backoff
    const delay = 1000 * Math.pow(2, retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      const response = await this.axiosInstance.request(config);
      this.retryQueue.delete(config.url!);
      return response;
    } catch (retryError) {
      this.retryQueue.delete(config.url!);
      throw retryError;
    }
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
          case 400:
            throw new TrafficAPIError(
              data?.message || 'Bad request parameters',
              'BAD_REQUEST',
              400,
              data
            );
          case 401:
            throw new TrafficAPIError(
              'Invalid or missing API key',
              'UNAUTHORIZED',
              401
            );
          case 403:
            throw new TrafficAPIError(
              'Access forbidden',
              'FORBIDDEN',
              403
            );
          case 404:
            throw new TrafficAPIError(
              'Resource not found',
              'NOT_FOUND',
              404
            );
          case 429:
            throw new TrafficAPIError(
              'Rate limit exceeded',
              'RATE_LIMITED',
              429,
              {
                retryAfter: axiosError.response.headers['retry-after']
              }
            );
          case 500:
            throw new TrafficAPIError(
              '511.org server error',
              'SERVER_ERROR',
              500
            );
          case 503:
            throw new TrafficAPIError(
              'Service temporarily unavailable',
              'SERVICE_UNAVAILABLE',
              503
            );
          default:
            throw new TrafficAPIError(
              `API request failed with status ${status}`,
              'API_ERROR',
              status,
              data
            );
        }
      } else if (axiosError.request) {
        throw new TrafficAPIError(
          'Network error - unable to reach 511.org API',
          'NETWORK_ERROR',
          undefined,
          {
            code: axiosError.code,
            message: axiosError.message
          }
        );
      }
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      throw new TrafficAPIError(
        'Invalid API response format',
        'VALIDATION_ERROR',
        undefined,
        error.errors
      );
    }

    // Unknown error
    throw new TrafficAPIError(
      'An unexpected error occurred',
      'UNKNOWN_ERROR',
      undefined,
      error
    );
  }

  /**
   * Save sync state to localStorage
   */
  private saveSyncState(): void {
    try {
      const stateToSave = {
        lastSyncTimestamp: this.syncState.lastSyncTimestamp,
        syncId: this.syncState.syncId,
        totalEvents: this.syncState.totalEvents,
        eventVersions: Array.from(this.syncState.eventVersions.entries())
      };
      
      localStorage.setItem(
        'traffic-api-sync-state',
        JSON.stringify(stateToSave)
      );
    } catch (error) {
      console.warn('Failed to save sync state:', error);
    }
  }

  /**
   * Load sync state from localStorage
   */
  private loadSyncState(): void {
    try {
      const saved = localStorage.getItem('traffic-api-sync-state');
      if (saved) {
        const state = JSON.parse(saved);
        this.syncState = {
          lastSyncTimestamp: state.lastSyncTimestamp,
          syncId: state.syncId || this.generateSyncId(),
          totalEvents: state.totalEvents || 0,
          eventVersions: new Map(state.eventVersions || [])
        };
      }
    } catch (error) {
      console.warn('Failed to load sync state:', error);
    }
  }

  /**
   * Clear all cached data and sync state
   */
  async clearCache(): Promise<void> {
    await cacheManager.clear();
    this.syncState = {
      lastSyncTimestamp: null,
      eventVersions: new Map(),
      syncId: this.generateSyncId(),
      totalEvents: 0
    };
    this.lastETag = null;
    localStorage.removeItem('traffic-api-sync-state');
  }

  /**
   * Get current sync state
   */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Get API statistics
   */
  getStatistics(): {
    totalEvents: number;
    cacheHitRate: number;
    rateLimitRemaining: number;
    syncId: string;
    lastSync: string | null;
  } {
    const cacheStats = cacheManager.getStats();
    const rateLimitInfo = rateLimiter.getInfo();
    
    return {
      totalEvents: this.syncState.totalEvents,
      cacheHitRate: cacheStats.hitRate,
      rateLimitRemaining: rateLimitInfo.remaining,
      syncId: this.syncState.syncId,
      lastSync: this.syncState.lastSyncTimestamp
    };
  }
}

// Export singleton instance
export const trafficAPI = new TrafficAPI();
