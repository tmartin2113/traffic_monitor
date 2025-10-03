/**
 * @file utils/constants.ts
 * @description Application constants with proper type-safe environment parsing
 * @version 2.0.0
 */

import { envConfig } from '@/config/environment';

/**
 * API Configuration
 */
export const API_CONFIG = {
  BASE_URL: envConfig.getApiConfig().baseUrl,
  TIMEOUT: envConfig.getApiConfig().timeout,
  MAX_RETRIES: envConfig.getApiConfig().maxRetries,
  KEY: envConfig.getApiKey(),
} as const;

/**
 * Polling & Caching Configuration
 */
export const POLLING_CONFIG = {
  INTERVAL: envConfig.getPollingConfig().interval,
  CACHE_TTL: envConfig.getPollingConfig().cacheTTL,
  STALE_TIME: envConfig.getPollingConfig().staleTime,
} as const;

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMIT_CONFIG = {
  MAX_REQUESTS: envConfig.getRateLimitConfig().maxRequests,
  WINDOW: envConfig.getRateLimitConfig().window,
  BUFFER: envConfig.getRateLimitConfig().buffer,
} as const;

/**
 * Map Configuration
 */
export const MAP_CONFIG = {
  CENTER: envConfig.getMapConfig().center,
  ZOOM: envConfig.getMapConfig().zoom,
  TILE_URL: envConfig.getMapConfig().tileUrl,
  UPDATE_INTERVAL: envConfig.getMapConfig().updateInterval,
  CLUSTER_THRESHOLD: envConfig.getMapConfig().clusterThreshold,
} as const;

/**
 * Geofence Boundaries
 */
export const GEOFENCE = {
  BOUNDS: envConfig.getGeofenceBounds(),
  BBOX: {
    xmin: envConfig.getGeofenceBounds().west,
    ymin: envConfig.getGeofenceBounds().south,
    xmax: envConfig.getGeofenceBounds().east,
    ymax: envConfig.getGeofenceBounds().north,
  },
} as const;

/**
 * Feature Flags
 */
export const FEATURES = envConfig.getFeatureFlags();

/**
 * Monitoring Configuration
 */
export const MONITORING = envConfig.getMonitoringConfig();

/**
 * Helper Functions
 */

/**
 * Check if coordinate is within geofence
 */
export function isWithinGeofence(lat: number, lng: number): boolean {
  const bounds = GEOFENCE.BOUNDS;
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
}

/**
 * Get headers for API requests
 */
export function getApiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

/**
 * Build API URL with key
 */
export function buildApiUrl(endpoint: string, params?: Record<string, string>): string {
  const url = new URL(endpoint, API_CONFIG.BASE_URL);
  url.searchParams.set('api_key', API_CONFIG.KEY);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  
  return url.toString();
}
