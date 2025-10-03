/**
 * @file utils/constants.ts
 * @description Application constants with properly parsed environment variables
 * @version 2.0.0
 * 
 * FIXES BUG #13: Now uses type-safe parsed environment variables
 */

import { env } from '@/config/env';

// ============================================================================
// API CONFIGURATION
// ============================================================================

export const API_CONFIG = {
  BASE_URL: env.VITE_API_BASE_URL,
  API_KEY: env.VITE_511_API_KEY,
  DEFAULT_PAGE_SIZE: 100,
  REQUEST_TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

export const CACHE_CONFIG = {
  /**
   * Cache time-to-live in milliseconds (parsed from env)
   * @type {number}
   */
  DEFAULT_TTL_MS: env.VITE_CACHE_TTL,
  MAX_CACHE_SIZE: 1000,
  MAX_MEMORY_MB: 100,
  CLEANUP_INTERVAL_MS: 60000,
} as const;

// ============================================================================
// POLLING CONFIGURATION
// ============================================================================

export const POLLING_CONFIG = {
  /**
   * Polling interval in milliseconds (parsed from env)
   * @type {number}
   */
  DEFAULT_INTERVAL_MS: env.VITE_POLL_INTERVAL,
  MIN_INTERVAL_MS: 15000,
  MAX_INTERVAL_MS: 300000,
  BACKOFF_MULTIPLIER: 1.5,
} as const;

// ============================================================================
// RATE LIMIT CONFIGURATION
// ============================================================================

export const RATE_LIMIT_CONFIG = {
  /**
   * Maximum requests per hour (parsed from env)
   * @type {number}
   */
  MAX_REQUESTS_PER_HOUR: env.VITE_RATE_LIMIT_MAX_REQUESTS,
  WINDOW_MS: 3600000, // 1 hour
  MIN_REQUEST_INTERVAL_MS: Math.floor(3600000 / env.VITE_RATE_LIMIT_MAX_REQUESTS),
} as const;

// ============================================================================
// MAP CONFIGURATION
// ============================================================================

export const MAP_CONFIG = {
  /**
   * Default map center (parsed from env)
   */
  DEFAULT_CENTER: {
    lat: env.VITE_MAP_DEFAULT_LAT,
    lng: env.VITE_MAP_DEFAULT_LNG,
  },
  /**
   * Default zoom level (parsed from env)
   * @type {number}
   */
  DEFAULT_ZOOM: env.VITE_MAP_DEFAULT_ZOOM,
  MIN_ZOOM: 5,
  MAX_ZOOM: 18,
  /**
   * Tile layer URL (parsed from env)
   */
  TILE_URL: env.VITE_MAP_TILE_URL,
  CLUSTER_THRESHOLD: 50,
} as const;

// ============================================================================
// GEOFENCE CONFIGURATION
// ============================================================================

export const GEOFENCE = {
  /**
   * Bounding box for Bay Area
   * West: -122.57, South: 37.22, East: -121.67, North: 37.86
   */
  BBOX: {
    xmin: -122.57031250,
    ymin: 37.21559028,
    xmax: -121.66525694,
    ymax: 37.86217361,
  },
  /**
   * Center point (using env values)
   */
  CENTER: {
    lat: env.VITE_MAP_DEFAULT_LAT,
    lng: env.VITE_MAP_DEFAULT_LNG,
  },
  /**
   * Default zoom (using env value)
   */
  DEFAULT_ZOOM: env.VITE_MAP_DEFAULT_ZOOM,
} as const;

// ============================================================================
// STORAGE KEYS
// ============================================================================

export const STORAGE_KEYS = {
  API_KEY: 'traffic-api-key',
  FILTERS: 'traffic-filters',
  CACHE_PREFIX: 'traffic-cache:',
  RATE_LIMIT: 'traffic-rate-limit',
  USER_PREFERENCES: 'traffic-user-prefs',
} as const;

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const FEATURE_FLAGS = {
  /**
   * Enable WZDx support (parsed from env)
   */
  ENABLE_WZDX: env.VITE_ENABLE_WZDX,
  /**
   * Enable debug logging (parsed from env)
   */
  ENABLE_DEBUG: env.VITE_DEBUG,
  ENABLE_CLUSTERING: true,
  ENABLE_FILTERS: true,
  ENABLE_SEARCH: true,
} as const;

// ============================================================================
// DEFAULT FILTERS
// ============================================================================

export const DEFAULT_FILTERS = {
  eventType: null,
  severity: null,
  closuresOnly: false,
  activeOnly: true,
  searchTerm: '',
  sortBy: 'severity' as const,
} as const;

// ============================================================================
// EVENT CONFIGURATION
// ============================================================================

export const EVENT_CONFIG = {
  TYPES: {
    CONSTRUCTION: 'CONSTRUCTION',
    INCIDENT: 'INCIDENT',
    SPECIAL_EVENT: 'SPECIAL_EVENT',
    ROAD_CONDITION: 'ROAD_CONDITION',
    WEATHER_CONDITION: 'WEATHER_CONDITION',
  },
  SEVERITIES: {
    UNKNOWN: 'Unknown',
    MINOR: 'Minor',
    MODERATE: 'Moderate',
    MAJOR: 'Major',
    BLOCKING: 'Blocking',
  },
  STATUSES: {
    ACTIVE: 'ACTIVE',
    ARCHIVED: 'ARCHIVED',
  },
} as const;

// ============================================================================
// MARKER CONFIGURATION
// ============================================================================

export const MARKER_CONFIG = {
  COLORS: {
    INCIDENT: '#ef4444', // red
    CONSTRUCTION: '#f59e0b', // orange
    SPECIAL_EVENT: '#8b5cf6', // purple
    ROAD_CONDITION: '#3b82f6', // blue
    WEATHER_CONDITION: '#06b6d4', // cyan
    DEFAULT: '#6b7280', // gray
  },
  SIZES: {
    SMALL: 20,
    MEDIUM: 30,
    LARGE: 40,
  },
  CLUSTER_OPTIONS: {
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
  },
} as const;

// ============================================================================
// SYNC CONFIGURATION
// ============================================================================

export const SYNC_CONFIG = {
  STALE_TIME_MS: 30000,
  ENABLE_DIFFERENTIAL: true,
  WEBSOCKET_URL: 'wss://api.511.org/ws',
  RECONNECT_INTERVAL_MS: 5000,
  MAX_RECONNECT_ATTEMPTS: 5,
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type EventType = keyof typeof EVENT_CONFIG.TYPES;
export type EventSeverity = keyof typeof EVENT_CONFIG.SEVERITIES;
export type EventStatus = keyof typeof EVENT_CONFIG.STATUSES;
export type SortBy = typeof DEFAULT_FILTERS.sortBy;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate that a number is within acceptable range
 */
export function validateInterval(interval: number): boolean {
  return (
    interval >= POLLING_CONFIG.MIN_INTERVAL_MS &&
    interval <= POLLING_CONFIG.MAX_INTERVAL_MS
  );
}

/**
 * Validate that a zoom level is acceptable
 */
export function validateZoom(zoom: number): boolean {
  return zoom >= MAP_CONFIG.MIN_ZOOM && zoom <= MAP_CONFIG.MAX_ZOOM;
}

/**
 * Validate that coordinates are within Bay Area bounds
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  return (
    lat >= GEOFENCE.BBOX.ymin &&
    lat <= GEOFENCE.BBOX.ymax &&
    lng >= GEOFENCE.BBOX.xmin &&
    lng <= GEOFENCE.BBOX.xmax
  );
}

// ============================================================================
// RUNTIME ASSERTIONS
// ============================================================================

// Validate critical numeric values at module load time
if (!validateInterval(POLLING_CONFIG.DEFAULT_INTERVAL_MS)) {
  throw new Error(
    `Invalid VITE_POLL_INTERVAL: ${POLLING_CONFIG.DEFAULT_INTERVAL_MS}. ` +
    `Must be between ${POLLING_CONFIG.MIN_INTERVAL_MS} and ${POLLING_CONFIG.MAX_INTERVAL_MS}.`
  );
}

if (!validateZoom(MAP_CONFIG.DEFAULT_ZOOM)) {
  throw new Error(
    `Invalid VITE_MAP_DEFAULT_ZOOM: ${MAP_CONFIG.DEFAULT_ZOOM}. ` +
    `Must be between ${MAP_CONFIG.MIN_ZOOM} and ${MAP_CONFIG.MAX_ZOOM}.`
  );
}

if (!validateCoordinates(MAP_CONFIG.DEFAULT_CENTER.lat, MAP_CONFIG.DEFAULT_CENTER.lng)) {
  console.warn(
    `Map center (${MAP_CONFIG.DEFAULT_CENTER.lat}, ${MAP_CONFIG.DEFAULT_CENTER.lng}) ` +
    `is outside Bay Area geofence. Map may show unexpected region.`
  );
}

// ============================================================================
// DEBUG LOGGING
// ============================================================================

if (FEATURE_FLAGS.ENABLE_DEBUG) {
  console.group('📦 Constants Loaded');
  console.log('API Config:', API_CONFIG);
  console.log('Cache Config:', CACHE_CONFIG);
  console.log('Polling Config:', POLLING_CONFIG);
  console.log('Rate Limit Config:', RATE_LIMIT_CONFIG);
  console.log('Map Config:', MAP_CONFIG);
  console.log('Feature Flags:', FEATURE_FLAGS);
  console.groupEnd();
}
