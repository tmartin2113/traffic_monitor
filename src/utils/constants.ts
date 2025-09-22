/**
 * Application Constants
 * Central configuration for the 511 Bay Area Traffic Monitor
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://api.511.org',
  DEFAULT_API_KEY: import.meta.env.VITE_511_API_KEY || '',
  ENDPOINTS: {
    TRAFFIC_EVENTS: '/traffic/events',
    WZDX: '/traffic/wzdx',
  },
} as const;

// Rate Limiting Configuration
export const RATE_LIMIT_CONFIG = {
  MAX_REQUESTS_PER_HOUR: 60,
  WINDOW_MS: 3600000, // 1 hour in milliseconds
  RETRY_DELAY_MS: 5000, // 5 seconds
  MAX_RETRIES: 3,
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
  DEFAULT_TTL_MS: 30000, // 30 seconds
  MAX_CACHE_SIZE: 50, // Maximum number of cached entries
  STALE_WHILE_REVALIDATE_MS: 60000, // 1 minute
} as const;

// Polling Configuration
export const POLLING_CONFIG = {
  DEFAULT_INTERVAL_MS: 60000, // 1 minute
  MIN_INTERVAL_MS: 30000, // 30 seconds
  MAX_INTERVAL_MS: 300000, // 5 minutes
  BACKGROUND_INTERVAL_MS: 120000, // 2 minutes when tab is not active
} as const;

// Map Configuration
export const MAP_CONFIG = {
  DEFAULT_CENTER: {
    lat: 37.5,
    lng: -122.1,
  },
  DEFAULT_ZOOM: 10,
  MIN_ZOOM: 9,
  MAX_ZOOM: 18,
  TILE_LAYER: {
    URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ATTRIBUTION: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  CLUSTER_OPTIONS: {
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
  },
} as const;

// Bay Area Geofence
export const GEOFENCE = {
  BBOX: {
    xmin: -122.57031250,
    ymin: 37.21559028,
    xmax: -121.66525694,
    ymax: 37.86217361,
  },
  POLYGON: [
    [-122.57031250, 37.78765972],
    [-122.15529861, 37.86217361],
    [-121.66525694, 37.29010417],
    [-122.08027083, 37.21559028],
    [-122.57031250, 37.78765972],
  ],
  STYLE: {
    color: '#3b82f6',
    weight: 2,
    opacity: 0.3,
    fillOpacity: 0.05,
    dashArray: '10, 10',
  },
} as const;

// Event Type Configuration
export const EVENT_TYPE_CONFIG = {
  CONSTRUCTION: {
    icon: '🚧',
    label: 'Construction',
    baseColor: '#f59e0b',
  },
  INCIDENT: {
    icon: '⚠️',
    label: 'Incident',
    baseColor: '#dc2626',
  },
  SPECIAL_EVENT: {
    icon: '📍',
    label: 'Special Event',
    baseColor: '#8b5cf6',
  },
  ROAD_CONDITION: {
    icon: '🛣️',
    label: 'Road Condition',
    baseColor: '#0ea5e9',
  },
  WEATHER_CONDITION: {
    icon: '🌧️',
    label: 'Weather',
    baseColor: '#06b6d4',
  },
} as const;

// Severity Configuration
export const SEVERITY_CONFIG = {
  SEVERE: {
    label: 'Severe',
    color: '#dc2626',
    priority: 1,
  },
  MAJOR: {
    label: 'Major',
    color: '#ea580c',
    priority: 2,
  },
  MODERATE: {
    label: 'Moderate',
    color: '#f59e0b',
    priority: 3,
  },
  MINOR: {
    label: 'Minor',
    color: '#3b82f6',
    priority: 4,
  },
  UNKNOWN: {
    label: 'Unknown',
    color: '#6b7280',
    priority: 5,
  },
} as const;

// Closure Polyline Styles
export const CLOSURE_STYLES = {
  FULL_CLOSURE: {
    color: '#dc2626',
    weight: 5,
    opacity: 0.9,
    dashArray: null,
  },
  PARTIAL_CLOSURE: {
    color: '#ea580c',
    weight: 4,
    opacity: 0.8,
    dashArray: '10, 5',
  },
  SINGLE_LANE: {
    color: '#f59e0b',
    weight: 3,
    opacity: 0.7,
    dashArray: '5, 5',
  },
} as const;

// Marker Configuration
export const MARKER_CONFIG = {
  SIZE: {
    width: 30,
    height: 30,
  },
  CLUSTER: {
    small: {
      size: 40,
      className: 'marker-cluster-small',
    },
    medium: {
      size: 50,
      className: 'marker-cluster-medium',
    },
    large: {
      size: 60,
      className: 'marker-cluster-large',
    },
  },
} as const;

// Filter Defaults
export const DEFAULT_FILTERS = {
  eventType: '',
  severity: '',
  closuresOnly: false,
  activeOnly: true,
  includeWzdx: false,
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  API_KEY: '511_api_key',
  FILTERS: '511_filters',
  MAP_VIEW: '511_map_view',
  FAVORITES: '511_favorites',
  SETTINGS: '511_settings',
} as const;

// Time Constants
export const TIME_CONSTANTS = {
  RECENT_THRESHOLD_MINUTES: 30,
  STALE_THRESHOLD_HOURS: 24,
  DATE_FORMAT: 'MMM d, yyyy h:mm a',
  TIME_FORMAT: 'h:mm a',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  INVALID_API_KEY: 'Invalid API key. Please check your 511.org API key.',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  NO_EVENTS: 'No active events in this area.',
  GEOLOCATION_DENIED: 'Location access denied.',
  GEOLOCATION_UNAVAILABLE: 'Location information unavailable.',
  CACHE_ERROR: 'Failed to cache data.',
  UNKNOWN_ERROR: 'An unexpected error occurred.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  API_KEY_SAVED: 'API key saved successfully.',
  FILTERS_APPLIED: 'Filters applied.',
  CACHE_CLEARED: 'Cache cleared successfully.',
  LOCATION_FOUND: 'Location found.',
} as const;
