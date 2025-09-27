export const API_CONFIG = {
  BASE_URL: 'https://api.511.org',
  DEFAULT_PAGE_SIZE: 100,
  REQUEST_TIMEOUT_MS: 30000,
};

export const CACHE_CONFIG = {
  DEFAULT_TTL_MS: 30000,
  MAX_CACHE_SIZE: 1000,
  MAX_MEMORY_MB: 100,
};

export const POLLING_CONFIG = {
  DEFAULT_INTERVAL_MS: 60000,
  MIN_INTERVAL_MS: 15000,
  MAX_INTERVAL_MS: 300000,
};

export const SYNC_CONFIG = {
  STALE_TIME_MS: 30000,
  ENABLE_DIFFERENTIAL: true,
  WEBSOCKET_URL: 'wss://api.511.org/ws',
};

export const GEOFENCE = {
  BBOX: {
    xmin: -122.57031250,
    ymin: 37.21559028,
    xmax: -121.66525694,
    ymax: 37.86217361,
  },
  CENTER: { lat: 37.5, lng: -122.1 },
  DEFAULT_ZOOM: 10,
};

export const STORAGE_KEYS = {
  API_KEY: 'traffic-api-key',
  FILTERS: 'traffic-filters',
};

export const DEFAULT_FILTERS = {
  eventType: null,
  severity: null,
  closuresOnly: false,
  activeOnly: true,
  searchTerm: '',
  sortBy: 'severity' as const,
};
