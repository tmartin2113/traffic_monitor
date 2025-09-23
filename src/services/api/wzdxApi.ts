/**
 * WZDx API Service
 * Work Zone Data Exchange API integration
 */

import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
import { 
  WZDxResponse, 
  WZDxFeature,
  WZDxProperties,
  CoreDetails,
  DataSource
} from '@types/api.types';
import { API_CONFIG, GEOFENCE } from '@utils/constants';
import { rateLimiter } from '@services/rateLimit/RateLimiter';
import { cacheManager } from '@services/cache/CacheManager';
import { TrafficAPIError } from './trafficApi';

// WZDx-specific parameters
export interface WZDxParams {
  api_key: string;
  includeAllDefinedEnums?: boolean;
  activeAndFutureEventsUpTo?: string;
  allActiveAndFutureEvents?: boolean;
  bbox?: string;
  geometry?: string;
  tolerance?: number;
}

// Response validation schemas
const CoreDetailsSchema = z.object({
  event_type: z.enum(['work-zone', 'detour']),
  data_source_id: z.string(),
  road_names: z.array(z.string()),
  direction: z.string(),
  creation_date: z.string(),
  update_date: z.string(),
  description: z.string().optional(),
});

const WZDxPropertiesSchema = z.object({
  core_details: CoreDetailsSchema,
  start_date: z.string(),
  end_date: z.string(),
  event_status: z.enum(['active', 'pending', 'completed']),
  start_date_accuracy: z.enum(['estimated', 'verified']),
  end_date_accuracy: z.enum(['estimated', 'verified']),
  beginning_accuracy: z.enum(['estimated', 'verified']).optional(),
  ending_accuracy: z.enum(['estimated', 'verified']).optional(),
  location_method: z.enum(['channel-device-method', 'other', 'unknown']).optional(),
  vehicle_impact: z.enum(['unknown', 'alternating-one-way']).optional(),
  beginning_cross_street: z.string().optional(),
  ending_cross_street: z.string().optional(),
  worker_presence: z.object({
    are_workers_present: z.boolean(),
  }).optional(),
});

const WZDxFeatureSchema = z.object({
  type: z.literal('Feature'),
  id: z.string(),
  geometry: z.object({
    type: z.string(),
    coordinates: z.any(),
  }),
  properties: WZDxPropertiesSchema,
});

const WZDxResponseSchema = z.object({
  road_event_feed_info: z.object({
    publisher: z.string(),
    version: z.string(),
    license: z.string(),
    update_frequency: z.number(),
    contact_name: z.string(),
    contact_email: z.string(),
    update_date: z.string(),
    data_sources: z.array(z.object({
      update_date: z.string(),
      data_source_id: z.string(),
      jurisdiction_id: z.string(),
      organization_name: z.string(),
      update_frequency: z.number(),
      contact_name: z.string(),
      contact_email: z.string(),
    })),
  }),
  type: z.literal('FeatureCollection'),
  features: z.array(WZDxFeatureSchema),
});

/**
 * WZDx API Service Class
 */
export class WZDxAPI {
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
  }

  /**
   * Get API key
   */
  getApiKey(): string {
    return this.apiKey || API_CONFIG.DEFAULT_API_KEY;
  }

  /**
   * Fetch WZDx work zone data
   */
  async fetchWorkZones(params?: Partial<WZDxParams>): Promise<WZDxResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new TrafficAPIError('API key is required', 'API_KEY_MISSING');
    }

    // Build cache key
    const cacheKey = this.buildCacheKey('wzdx', { ...params, api_key: apiKey });
    
    // Check cache first
    const cachedData = await cacheManager.get<WZDxResponse>(cacheKey);
    if (cachedData) {
      console.log('Returning cached WZDx data');
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
    const requestParams: WZDxParams = {
      api_key: apiKey,
      bbox: `${GEOFENCE.BBOX.xmin},${GEOFENCE.BBOX.ymin},${GEOFENCE.BBOX.xmax},${GEOFENCE.BBOX.ymax}`,
      ...params,
    };

    try {
      // Record the request
      rateLimiter.recordRequest();

      // Make API call
      const response = await this.client.get<WZDxResponse>(
        API_CONFIG.ENDPOINTS.WZDX,
        { params: requestParams }
      );

      // Validate response
      const validatedData = WZDxResponseSchema.parse(response.data);

      // Cache the response
      await cacheManager.set(cacheKey, validatedData);

      return validatedData;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Fetch active work zones only
   */
  async fetchActiveWorkZones(): Promise<WZDxFeature[]> {
    const response = await this.fetchWorkZones({
      allActiveAndFutureEvents: true,
    });

    // Filter for active work zones
    return response.features.filter(feature => 
      feature.properties.event_status === 'active'
    );
  }

  /**
   * Convert WZDx feature to standard traffic event format
   */
  convertToTrafficEvent(feature: WZDxFeature): any {
    const { properties, geometry } = feature;
    const { core_details } = properties;

    return {
      id: `wzdx_${feature.id}`,
      status: properties.event_status === 'active' ? 'ACTIVE' : 'ARCHIVED',
      headline: `Work Zone: ${core_details.road_names.join(', ')} ${core_details.direction}`,
      event_type: 'CONSTRUCTION',
      event_subtypes: ['WORK_ZONE'],
      severity: this.determineSeverity(properties),
      certainty: properties.start_date_accuracy === 'verified' ? 'OBSERVED' : 'LIKELY',
      created: core_details.creation_date,
      updated: core_details.update_date,
      geography: geometry,
      roads: core_details.road_names.map(name => ({
        name,
        direction: core_details.direction,
        state: this.determineRoadState(properties),
      })),
      description: core_details.description,
      schedules: [{
        intervals: [{
          start: properties.start_date,
          end: properties.end_date,
        }],
      }],
      source_type: 'WZDx',
      source_id: core_details.data_source_id,
    };
  }

  /**
   * Determine severity based on WZDx properties
   */
  private determineSeverity(properties: WZDxProperties): string {
    // Check worker presence
    if (properties.worker_presence?.are_workers_present) {
      return 'MAJOR';
    }

    // Check vehicle impact
    if (properties.vehicle_impact === 'alternating-one-way') {
      return 'MODERATE';
    }

    // Check date accuracy
    if (properties.start_date_accuracy === 'estimated' || 
        properties.end_date_accuracy === 'estimated') {
      return 'MINOR';
    }

    return 'MODERATE';
  }

  /**
   * Determine road state based on WZDx properties
   */
  private determineRoadState(properties: WZDxProperties): string {
    if (properties.vehicle_impact === 'alternating-one-way') {
      return 'SINGLE_LANE_ALTERNATING';
    }

    // Default to some lanes closed for work zones
    return 'SOME_LANES_CLOSED';
  }

  /**
   * Get work zones by road name
   */
  async getWorkZonesByRoad(roadName: string): Promise<WZDxFeature[]> {
    const workZones = await this.fetchActiveWorkZones();
    
    return workZones.filter(zone => 
      zone.properties.core_details.road_names.some(name => 
        name.toLowerCase().includes(roadName.toLowerCase())
      )
    );
  }

  /**
   * Get work zones with workers present
   */
  async getWorkZonesWithWorkers(): Promise<WZDxFeature[]> {
    const workZones = await this.fetchActiveWorkZones();
    
    return workZones.filter(zone => 
      zone.properties.worker_presence?.are_workers_present === true
    );
  }

  /**
   * Get upcoming work zones
   */
  async getUpcomingWorkZones(daysAhead: number = 7): Promise<WZDxFeature[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    const response = await this.fetchWorkZones({
      activeAndFutureEventsUpTo: futureDate.toISOString(),
    });

    // Filter for pending work zones
    return response.features.filter(feature => 
      feature.properties.event_status === 'pending'
    );
  }

  /**
   * Get work zone statistics
   */
  async getWorkZoneStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    completed: number;
    withWorkers: number;
    byDataSource: Map<string, number>;
  }> {
    const response = await this.fetchWorkZones({
      allActiveAndFutureEvents: true,
    });

    const stats = {
      total: response.features.length,
      active: 0,
      pending: 0,
      completed: 0,
      withWorkers: 0,
      byDataSource: new Map<string, number>(),
    };

    response.features.forEach(feature => {
      // Count by status
      switch (feature.properties.event_status) {
        case 'active':
          stats.active++;
          break;
        case 'pending':
          stats.pending++;
          break;
        case 'completed':
          stats.completed++;
          break;
      }

      // Count workers present
      if (feature.properties.worker_presence?.are_workers_present) {
        stats.withWorkers++;
      }

      // Count by data source
      const sourceId = feature.properties.core_details.data_source_id;
      const currentCount = stats.byDataSource.get(sourceId) || 0;
      stats.byDataSource.set(sourceId, currentCount + 1);
    });

    return stats;
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
      const axiosError = error as any;
      
      if (axiosError.response) {
        const status = axiosError.response.status;
        
        switch (status) {
          case 401:
            throw new TrafficAPIError(
              'Invalid API key',
              'UNAUTHORIZED',
              401
            );
          case 429:
            throw new TrafficAPIError(
              'Rate limit exceeded',
              'RATE_LIMITED',
              429
            );
          default:
            throw new TrafficAPIError(
              'WZDx API request failed',
              'API_ERROR',
              status
            );
        }
      } else if (axiosError.request) {
        throw new TrafficAPIError(
          'Network error',
          'NETWORK_ERROR'
        );
      }
    }
    
    throw new TrafficAPIError(
      'Unknown error',
      'UNKNOWN_ERROR',
      undefined,
      error
    );
  }

  /**
   * Clear WZDx cache
   */
  async clearCache(): Promise<void> {
    // Clear only WZDx-related cache entries
    const keys = await cacheManager.keys();
    const wzdxKeys = keys.filter(key => key.startsWith('wzdx:'));
    
    for (const key of wzdxKeys) {
      await cacheManager.delete(key);
    }
  }
}

// Export singleton instance
export const wzdxAPI = new WZDxAPI();
