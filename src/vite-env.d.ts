/**
 * @file vite-env.d.ts
 * @description Vite environment type definitions
 * @version 2.0.0
 * 
 * NOTE: All Vite environment variables are strings at runtime.
 * Use the envConfig module for type-safe parsed values.
 */

/// <reference types="vite/client" />

/**
 * Raw environment variables (all strings)
 * 
 * IMPORTANT: Do NOT use these directly in your code.
 * Instead, import from '@/config/environment' for type-safe parsed values.
 */
interface ImportMetaEnv {
  // API Configuration
  readonly VITE_511_API_KEY: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT: string;
  readonly VITE_API_MAX_RETRIES: string;
  
  // Data Refresh & Caching
  readonly VITE_POLL_INTERVAL: string;
  readonly VITE_CACHE_TTL: string;
  readonly VITE_STALE_TIME: string;
  
  // Rate Limiting
  readonly VITE_RATE_LIMIT_MAX_REQUESTS: string;
  readonly VITE_RATE_LIMIT_WINDOW: string;
  readonly VITE_RATE_LIMIT_BUFFER: string;
  
  // Map Configuration
  readonly VITE_MAP_DEFAULT_LAT: string;
  readonly VITE_MAP_DEFAULT_LNG: string;
  readonly VITE_MAP_DEFAULT_ZOOM: string;
  readonly VITE_MAP_MIN_ZOOM: string;
  readonly VITE_MAP_MAX_ZOOM: string;
  readonly VITE_MAP_UPDATE_INTERVAL: string;
  readonly VITE_MAP_CLUSTER_THRESHOLD: string;
  readonly VITE_MAP_TILE_URL: string;
  
  // Geofence
  readonly VITE_GEOFENCE_NORTH: string;
  readonly VITE_GEOFENCE_SOUTH: string;
  readonly VITE_GEOFENCE_EAST: string;
  readonly VITE_GEOFENCE_WEST: string;
  
  // Feature Flags
  readonly VITE_ENABLE_WZDX: string;
  readonly VITE_ENABLE_ANALYTICS: string;
  readonly VITE_ENABLE_PWA: string;
  readonly VITE_DEBUG: string;
  
  // Optional Monitoring
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_GA_TRACKING_ID?: string;
  
  // Development Server
  readonly VITE_DEV_SERVER_PORT: string;
  readonly VITE_DEV_SERVER_HOST: string;
  readonly VITE_DEV_SERVER_OPEN: string;
  
  // Build Configuration
  readonly VITE_BUILD_SOURCEMAP: string;
  readonly VITE_BUILD_MINIFY: string;
  readonly VITE_BUILD_OUTPUT_DIR: string;
  readonly VITE_BUILD_ASSET_INLINE_LIMIT: string;
  
  // Vite internals
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
