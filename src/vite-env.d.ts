/**
 * @file vite-env.d.ts
 * @description Vite environment variable type definitions
 * @version 3.0.0
 * 
 * IMPORTANT: All Vite environment variables are strings at runtime.
 * Use src/config/env.ts for type-safe parsed values with validation.
 * 
 * This file defines the raw interface for import.meta.env
 */

/// <reference types="vite/client" />

/**
 * Raw environment variables from Vite (all strings)
 * 
 * DO NOT use these directly in your code.
 * Instead, import from '@/config/env' for validated, type-safe values.
 */
interface ImportMetaEnv {
  // ============================================================================
  // REQUIRED CONFIGURATION
  // ============================================================================
  
  /** 511.org API Key */
  readonly VITE_511_API_KEY: string;
  
  // ============================================================================
  // API CONFIGURATION
  // ============================================================================
  
  /** API base URL */
  readonly VITE_API_BASE_URL: string;
  
  /** API request timeout in milliseconds */
  readonly VITE_API_TIMEOUT: string;
  
  /** Maximum number of API retry attempts */
  readonly VITE_API_MAX_RETRIES: string;
  
  // ============================================================================
  // APPLICATION SETTINGS
  // ============================================================================
  
  /** Application title */
  readonly VITE_APP_TITLE: string;
  
  /** Application version */
  readonly VITE_APP_VERSION: string;
  
  /** Application description */
  readonly VITE_APP_DESCRIPTION: string;
  
  /** Application environment (development | staging | production) */
  readonly VITE_APP_ENVIRONMENT: string;
  
  // ============================================================================
  // DATA REFRESH & CACHING
  // ============================================================================
  
  /** Polling interval in milliseconds */
  readonly VITE_POLL_INTERVAL: string;
  
  /** Cache TTL in milliseconds */
  readonly VITE_CACHE_TTL: string;
  
  /** Stale time in milliseconds */
  readonly VITE_STALE_TIME: string;
  
  // ============================================================================
  // RATE LIMITING
  // ============================================================================
  
  /** Maximum requests per window */
  readonly VITE_RATE_LIMIT_MAX_REQUESTS: string;
  
  /** Rate limit window in milliseconds */
  readonly VITE_RATE_LIMIT_WINDOW: string;
  
  /** Rate limit warning threshold */
  readonly VITE_RATE_LIMIT_WARNING_THRESHOLD: string;
  
  // ============================================================================
  // MAP CONFIGURATION
  // ============================================================================
  
  /** Map center latitude */
  readonly VITE_MAP_CENTER_LAT: string;
  
  /** Map center longitude */
  readonly VITE_MAP_CENTER_LNG: string;
  
  /** Default zoom level */
  readonly VITE_MAP_DEFAULT_ZOOM: string;
  
  /** Minimum zoom level */
  readonly VITE_MAP_MIN_ZOOM: string;
  
  /** Maximum zoom level */
  readonly VITE_MAP_MAX_ZOOM: string;
  
  /** Enable marker clustering */
  readonly VITE_MAP_ENABLE_CLUSTERING: string;
  
  /** Cluster distance in pixels */
  readonly VITE_MAP_CLUSTER_DISTANCE: string;
  
  // ============================================================================
  // GEOFENCE CONFIGURATION
  // ============================================================================
  
  /** Geofence minimum longitude (west) */
  readonly VITE_GEOFENCE_XMIN: string;
  
  /** Geofence minimum latitude (south) */
  readonly VITE_GEOFENCE_YMIN: string;
  
  /** Geofence maximum longitude (east) */
  readonly VITE_GEOFENCE_XMAX: string;
  
  /** Geofence maximum latitude (north) */
  readonly VITE_GEOFENCE_YMAX: string;
  
  // ============================================================================
  // FEATURE FLAGS
  // ============================================================================
  
  /** Enable offline support with Service Worker */
  readonly VITE_FEATURE_OFFLINE_SUPPORT: string;
  
  /** Enable real-time WebSocket updates */
  readonly VITE_FEATURE_WEBSOCKET: string;
  
  /** Enable analytics tracking */
  readonly VITE_FEATURE_ANALYTICS: string;
  
  /** Enable debug mode */
  readonly VITE_FEATURE_DEBUG_MODE: string;
  
  // ============================================================================
  // ANALYTICS & MONITORING (OPTIONAL)
  // ============================================================================
  
  /** Google Analytics tracking ID */
  readonly VITE_GA_TRACKING_ID?: string;
  
  /** Sentry DSN for error tracking */
  readonly VITE_SENTRY_DSN?: string;
  
  /** Sentry environment */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  
  /** Sentry traces sample rate */
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
  
  /** Datadog application ID */
  readonly VITE_DATADOG_APPLICATION_ID?: string;
  
  /** Datadog client token */
  readonly VITE_DATADOG_CLIENT_TOKEN?: string;
  
  /** Datadog site */
  readonly VITE_DATADOG_SITE?: string;
  
  /** Datadog service name */
  readonly VITE_DATADOG_SERVICE?: string;
  
  /** Datadog environment */
  readonly VITE_DATADOG_ENV?: string;
  
  /** New Relic account ID */
  readonly VITE_NEW_RELIC_ACCOUNT_ID?: string;
  
  /** New Relic trust key */
  readonly VITE_NEW_RELIC_TRUST_KEY?: string;
  
  /** New Relic agent ID */
  readonly VITE_NEW_RELIC_AGENT_ID?: string;
  
  /** New Relic license key */
  readonly VITE_NEW_RELIC_LICENSE_KEY?: string;
  
  /** New Relic application ID */
  readonly VITE_NEW_RELIC_APPLICATION_ID?: string;
  
  // ============================================================================
  // DEVELOPMENT SETTINGS
  // ============================================================================
  
  /** Development server port */
  readonly VITE_DEV_SERVER_PORT: string;
  
  /** Development server host */
  readonly VITE_DEV_SERVER_HOST: string;
  
  /** Auto-open browser on dev server start */
  readonly VITE_DEV_SERVER_OPEN: string;
  
  /** Use mock data in development */
  readonly VITE_DEV_MOCK_DATA: string;
  
  /** Enable Hot Module Replacement */
  readonly VITE_DEV_HMR: string;
  
  // ============================================================================
  // BUILD CONFIGURATION
  // ============================================================================
  
  /** Enable source maps in production */
  readonly VITE_BUILD_SOURCEMAP: string;
  
  /** Enable code minification */
  readonly VITE_BUILD_MINIFY: string;
  
  /** Build output directory */
  readonly VITE_BUILD_OUTPUT_DIR: string;
  
  /** Asset inline limit in bytes */
  readonly VITE_BUILD_ASSET_INLINE_LIMIT: string;
  
  // ============================================================================
  // BUILD METADATA (Auto-populated by CI/CD)
  // ============================================================================
  
  /** Build timestamp */
  readonly VITE_BUILD_TIME?: string;
  
  /** Git commit SHA */
  readonly VITE_COMMIT_SHA?: string;
  
  /** Git branch name */
  readonly VITE_BRANCH?: string;
  
  /** CI/CD build number */
  readonly VITE_BUILD_NUMBER?: string;
  
  // ============================================================================
  // VITE INTERNALS (Built-in)
  // ============================================================================
  
  /** Current mode (development | production) */
  readonly MODE: string;
  
  /** Base URL for the application */
  readonly BASE_URL: string;
  
  /** Whether running in production */
  readonly PROD: boolean;
  
  /** Whether running in development */
  readonly DEV: boolean;
  
  /** Whether Server-Side Rendering is enabled */
  readonly SSR: boolean;
}

/**
 * Augment import.meta with env property
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Type guard to check if a variable exists
 */
export function hasEnvVar(key: keyof ImportMetaEnv): boolean {
  return import.meta.env[key] !== undefined;
}

/**
 * Get environment variable with fallback
 * @deprecated Use src/config/env.ts instead for type-safe access
 */
export function getEnvVar(key: keyof ImportMetaEnv, fallback?: string): string {
  return import.meta.env[key] ?? fallback ?? '';
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV;
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return import.meta.env.PROD;
}

/**
 * Get current environment mode
 */
export function getMode(): string {
  return import.meta.env.MODE;
}
