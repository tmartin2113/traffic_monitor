/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_511_API_KEY: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_POLL_INTERVAL: string;
  readonly VITE_CACHE_TTL: string;
  readonly VITE_RATE_LIMIT_MAX_REQUESTS: string;
  readonly VITE_DEBUG: string;
  readonly VITE_MAP_TILE_URL: string;
  readonly VITE_ENABLE_WZDX: string;
  readonly VITE_MAP_DEFAULT_LAT: string;
  readonly VITE_MAP_DEFAULT_LNG: string;
  readonly VITE_MAP_DEFAULT_ZOOM: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
