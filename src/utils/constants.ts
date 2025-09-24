/**
 * Application Constants and Configuration
 * Central location for all application constants
 */

import { EventType, EventSeverity } from '@/types/api.types';

// API Configuration
export const API_CONFIG = {
  BASE_URL: 'https://api.511.org',
  WZDX_URL: 'https://api.511.org/traffic/wzdx',
  TIMEOUT: 30000,
  RETRY_COUNT: 3,
  RETRY_DELAY: 1000,
  MAX_EVENTS: 500,
} as const;

// Rate Limiting Configuration
export const RATE_LIMIT_CONFIG = {
  MAX_REQUESTS: 60,
  WINDOW_MS: 3600000, // 1 hour
  WARNING_THRESHOLD: 10, // Show warning when less than 10 requests remaining
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
  DEFAULT_TTL: 30000, // 30 seconds
  MAX_CACHE_SIZE: 100, // Maximum number of cache entries
  STORAGE_KEY: '511_traffic_cache',
} as const;

// Polling Configuration
export const POLLING_CONFIG = {
  DEFAULT_INTERVAL_MS: 60000, // 1 minute
  MIN_INTERVAL_MS: 30000, // 30 seconds
  MAX_INTERVAL_MS: 300000, // 5 minutes
  BACKGROUND_INTERVAL_MS: 300000, // 5 minutes when tab is not active
} as const;

// Map Configuration
export const MAP_CONFIG = {
  DEFAULT_CENTER: {
    lat: 37.7749,
    lng: -122.4194,
  },
  DEFAULT_ZOOM: 10,
  MIN_ZOOM: 8,
  MAX_ZOOM: 18,
  TILE_LAYER: {
    URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ATTRIBUTION: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  CLUSTER_OPTIONS: {
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    spiderfyOnMaxZoom: true,
    maxClusterRadius: 60,
    iconCreateFunction: (cluster: any) => {
      const count = cluster.getChildCount();
      let size = 'small';
      if (count > 10) size = 'medium';
      if (count > 25) size = 'large';
      
      return L.divIcon({
        html: `<div><span>${count}</span></div>`,
        className: `marker-cluster marker-cluster-${size}`,
        iconSize: L.point(40, 40),
      });
    },
  },
} as const;

// Geofence Configuration (Bay Area boundaries)
export const GEOFENCE = {
  BBOX: {
    xmin: -122.8,
    ymin: 37.2,
    xmax: -121.5,
    ymax: 38.0,
  },
  CENTER: {
    lat: 37.6,
    lng: -122.15,
  },
  POLYGON: [
    [38.0, -122.8],
    [38.0, -121.5],
    [37.2, -121.5],
    [37.2, -122.8],
    [38.0, -122.8],
  ],
  STYLE: {
    color: '#3B82F6',
    weight: 2,
    opacity: 0.8,
    fillColor: '#3B82F6',
    fillOpacity: 0.05,
    dashArray: '5, 5',
  },
} as const;

// Event Type Configuration
export const EVENT_TYPE_CONFIG = {
  [EventType.CONSTRUCTION]: {
    icon: '🚧',
    label: 'Construction',
    color: '#F59E0B',
    baseColor: '#FCD34D',
    priority: 2,
  },
  [EventType.INCIDENT]: {
    icon: '⚠️',
    label: 'Incident',
    color: '#DC2626',
    baseColor: '#F87171',
    priority: 1,
  },
  [EventType.SPECIAL_EVENT]: {
    icon: '📍',
    label: 'Special Event',
    color: '#8B5CF6',
    baseColor: '#A78BFA',
    priority: 3,
  },
  [EventType.ROAD_CONDITION]: {
    icon: '🛣️',
    label: 'Road Condition',
    color: '#0EA5E9',
    baseColor: '#38BDF8',
    priority: 4,
  },
  [EventType.WEATHER_CONDITION]: {
    icon: '🌧️',
    label: 'Weather',
    color: '#06B6D4',
    baseColor: '#22D3EE',
    priority: 5,
  },
} as const;

// Severity Configuration
export const SEVERITY_CONFIG = {
  [EventSeverity.SEVERE]: {
    label: 'Severe',
    color: '#DC2626',
    weight: 4,
    icon: '🔴',
  },
  [EventSeverity.MAJOR]: {
    label: 'Major',
    color: '#EA580C',
    weight: 3,
    icon: '🟠',
  },
  [EventSeverity.MODERATE]: {
    label: 'Moderate',
    color: '#F59E0B',
    weight: 2,
    icon: '🟡',
  },
  [EventSeverity.MINOR]: {
    label: 'Minor',
    color: '#3B82F6',
    weight: 1,
    icon: '🔵',
  },
  [EventSeverity.UNKNOWN]: {
    label: 'Unknown',
    color: '#6B7280',
    weight: 0,
    icon: '⚪',
  },
} as const;

// Marker Configuration
export const MARKER_CONFIG = {
  DEFAULT_SIZE: 32,
  SELECTED_SIZE: 40,
  CLUSTER_SIZE: 40,
  CLOSURE_ICON_SIZE: 36,
  Z_INDEX: {
    DEFAULT: 100,
    SELECTED: 200,
    CLOSURE: 150,
  },
  ANIMATION: {
    PULSE_DURATION: 2000,
    BOUNCE_DURATION: 500,
  },
} as const;

// Filter Configuration
export const DEFAULT_FILTERS = {
  eventType: null as EventType | null,
  severity: null as EventSeverity | null,
  showClosuresOnly: false,
  searchTerm: '',
  areas: [] as string[],
  roads: [] as string[],
  dateRange: null as { start: Date; end: Date } | null,
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  API_KEY: '511_api_key',
  FILTERS: '511_filters',
  MAP_CENTER: '511_map_center',
  MAP_ZOOM: '511_map_zoom',
  FAVORITES: '511_favorites',
  SETTINGS: '511_settings',
  RATE_LIMIT: '511_rate_limit',
  CACHE: '511_cache',
  NOTIFICATIONS: '511_notifications',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NO_API_KEY: 'API key is required. Please obtain one from https://511.org/open-data/token',
  INVALID_API_KEY: 'Invalid API key. Please check your API key and try again.',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please wait before making more requests.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again later.',
  NO_EVENTS: 'No traffic events found in the selected area.',
  CACHE_ERROR: 'Failed to access cache storage.',
  GEOLOCATION_ERROR: 'Failed to get your location.',
  INVALID_DATA: 'Received invalid data from the API.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  API_KEY_VALIDATED: 'API key validated successfully.',
  EVENTS_LOADED: 'Traffic events loaded successfully.',
  CACHE_CLEARED: 'Cache cleared successfully.',
  FILTERS_RESET: 'Filters reset successfully.',
  LOCATION_FOUND: 'Location found successfully.',
} as const;

// Date/Time Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM d, yyyy h:mm a',
  SHORT: 'MMM d, h:mm a',
  TIME_ONLY: 'h:mm a',
  DATE_ONLY: 'MMM d, yyyy',
  ISO: "yyyy-MM-dd'T'HH:mm:ss'Z'",
  RELATIVE: 'relative', // Special format for relative time
} as const;

// Animation Durations
export const ANIMATION_DURATIONS = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
  VERY_SLOW: 1000,
} as const;

// Breakpoints
export const BREAKPOINTS = {
  XS: 475,
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

// Z-Index Layers
export const Z_INDEX = {
  MAP: 1,
  GEOFENCE: 10,
  MARKERS: 100,
  SELECTED_MARKER: 200,
  CONTROLS: 1000,
  PANEL: 1001,
  MODAL: 2000,
  TOOLTIP: 3000,
  NOTIFICATION: 4000,
} as const;

// Accessibility
export const ARIA_LABELS = {
  MAP: 'Interactive traffic map',
  FILTER_PANEL: 'Filter traffic events',
  EVENT_LIST: 'List of traffic events',
  EVENT_DETAILS: 'Traffic event details',
  CLOSE_BUTTON: 'Close',
  REFRESH_BUTTON: 'Refresh events',
  ZOOM_IN: 'Zoom in',
  ZOOM_OUT: 'Zoom out',
  MY_LOCATION: 'Center on my location',
  CLEAR_FILTERS: 'Clear all filters',
} as const;

// Keyboard Shortcuts
export const KEYBOARD_SHORTCUTS = {
  TOGGLE_SIDEBAR: 's',
  TOGGLE_EVENT_LIST: 'e',
  CLEAR_FILTERS: 'c',
  REFRESH: 'r',
  ZOOM_IN: '+',
  ZOOM_OUT: '-',
  ESCAPE: 'Escape',
} as const;

// Export all constants as a single object for convenience
export const CONSTANTS = {
  API: API_CONFIG,
  RATE_LIMIT: RATE_LIMIT_CONFIG,
  CACHE: CACHE_CONFIG,
  POLLING: POLLING_CONFIG,
  MAP: MAP_CONFIG,
  GEOFENCE,
  EVENT_TYPES: EVENT_TYPE_CONFIG,
  SEVERITIES: SEVERITY_CONFIG,
  MARKERS: MARKER_CONFIG,
  FILTERS: DEFAULT_FILTERS,
  STORAGE: STORAGE_KEYS,
  ERRORS: ERROR_MESSAGES,
  SUCCESS: SUCCESS_MESSAGES,
  DATES: DATE_FORMATS,
  ANIMATIONS: ANIMATION_DURATIONS,
  BREAKPOINTS,
  Z_INDEX,
  ARIA: ARIA_LABELS,
  KEYS: KEYBOARD_SHORTCUTS,
} as const;

// Type exports for TypeScript
export type MapConfig = typeof MAP_CONFIG;
export type EventTypeConfig = typeof EVENT_TYPE_CONFIG;
export type SeverityConfig = typeof SEVERITY_CONFIG;
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
export type ErrorMessage = typeof ERROR_MESSAGES[keyof typeof ERROR_MESSAGES];
export type SuccessMessage = typeof SUCCESS_MESSAGES[keyof typeof SUCCESS_MESSAGES];
