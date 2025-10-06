/**
 * @file config/env.ts
 * @description Type-safe environment variable configuration with Zod validation
 * @version 3.0.0
 * 
 * Production-ready environment configuration:
 * - Zod schema validation at startup
 * - Type-safe access to all environment variables
 * - Automatic type coercion (string → number, boolean)
 * - Sensible defaults for optional values
 * - Immutable configuration object
 * - Development helpers for debugging
 */

import { z } from 'zod';

/**
 * Zod schema for environment variable validation
 * All VITE_ variables come in as strings and must be parsed
 */
const envSchema = z.object({
  // ============================================================================
  // REQUIRED CONFIGURATION
  // ============================================================================
  
  VITE_511_API_KEY: z.string().min(1, 'API key is required'),
  
  // ============================================================================
  // API CONFIGURATION
  // ============================================================================
  
  VITE_API_BASE_URL: z.string().url().default('https://api.511.org'),
  VITE_API_TIMEOUT: z.coerce.number().int().positive().default(30000),
  VITE_API_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  
  // ============================================================================
  // APPLICATION SETTINGS
  // ============================================================================
  
  VITE_APP_TITLE: z.string().default('511 Bay Area Traffic Monitor'),
  VITE_APP_VERSION: z.string().default('3.0.0'),
  VITE_APP_DESCRIPTION: z.string().default('Real-time traffic monitoring for the San Francisco Bay Area'),
  VITE_APP_ENVIRONMENT: z.enum(['development', 'staging', 'production']).default('development'),
  
  // ============================================================================
  // DATA REFRESH & CACHING
  // ============================================================================
  
  VITE_POLL_INTERVAL: z.coerce.number().int().min(10000).max(600000).default(60000),
  VITE_CACHE_TTL: z.coerce.number().int().min(1000).max(300000).default(30000),
  VITE_STALE_TIME: z.coerce.number().int().min(1000).max(600000).default(60000),
  
  // ============================================================================
  // RATE LIMITING
  // ============================================================================
  
  VITE_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60),
  VITE_RATE_LIMIT_WINDOW: z.coerce.number().int().positive().default(3600000),
  VITE_RATE_LIMIT_WARNING_THRESHOLD: z.coerce.number().int().positive().default(10),
  
  // ============================================================================
  // MAP CONFIGURATION
  // ============================================================================
  
  VITE_MAP_CENTER_LAT: z.coerce.number().min(-90).max(90).default(37.7749),
  VITE_MAP_CENTER_LNG: z.coerce.number().min(-180).max(180).default(-122.4194),
  VITE_MAP_DEFAULT_ZOOM: z.coerce.number().int().min(0).max(20).default(10),
  VITE_MAP_MIN_ZOOM: z.coerce.number().int().min(0).max(20).default(8),
  VITE_MAP_MAX_ZOOM: z.coerce.number().int().min(0).max(20).default(16),
  VITE_MAP_ENABLE_CLUSTERING: z.coerce.boolean().default(true),
  VITE_MAP_CLUSTER_DISTANCE: z.coerce.number().int().positive().default(80),
  
  // ============================================================================
  // GEOFENCE CONFIGURATION
  // ============================================================================
  
  VITE_GEOFENCE_XMIN: z.coerce.number().min(-180).max(180).default(-122.57031250),
  VITE_GEOFENCE_YMIN: z.coerce.number().min(-90).max(90).default(37.21559028),
  VITE_GEOFENCE_XMAX: z.coerce.number().min(-180).max(180).default(-121.66525694),
  VITE_GEOFENCE_YMAX: z.coerce.number().min(-90).max(90).default(37.86217361),
  
  // ============================================================================
  // FEATURE FLAGS
  // ============================================================================
  
  VITE_FEATURE_OFFLINE_SUPPORT: z.coerce.boolean().default(true),
  VITE_FEATURE_WEBSOCKET: z.coerce.boolean().default(false),
  VITE_FEATURE_ANALYTICS: z.coerce.boolean().default(true),
  VITE_FEATURE_DEBUG_MODE: z.coerce.boolean().default(false),
  
  // ============================================================================
  // ANALYTICS & MONITORING (OPTIONAL)
  // ============================================================================
  
  VITE_GA_TRACKING_ID: z.string().optional(),
  VITE_SENTRY_DSN: z.string().url().optional(),
  VITE_SENTRY_ENVIRONMENT: z.string().optional(),
  VITE_SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
  
  VITE_DATADOG_APPLICATION_ID: z.string().optional(),
  VITE_DATADOG_CLIENT_TOKEN: z.string().optional(),
  VITE_DATADOG_SITE: z.string().default('datadoghq.com'),
  VITE_DATADOG_SERVICE: z.string().default('511-traffic-monitor'),
  VITE_DATADOG_ENV: z.string().optional(),
  
  VITE_NEW_RELIC_ACCOUNT_ID: z.string().optional(),
  VITE_NEW_RELIC_TRUST_KEY: z.string().optional(),
  VITE_NEW_RELIC_AGENT_ID: z.string().optional(),
  VITE_NEW_RELIC_LICENSE_KEY: z.string().optional(),
  VITE_NEW_RELIC_APPLICATION_ID: z.string().optional(),
  
  // ============================================================================
  // DEVELOPMENT SETTINGS
  // ============================================================================
  
  VITE_DEV_SERVER_PORT: z.coerce.number().int().positive().default(3000),
  VITE_DEV_SERVER_HOST: z.string().default('localhost'),
  VITE_DEV_SERVER_OPEN: z.coerce.boolean().default(false),
  VITE_DEV_MOCK_DATA: z.coerce.boolean().default(false),
  VITE_DEV_HMR: z.coerce.boolean().default(true),
  
  // ============================================================================
  // BUILD CONFIGURATION
  // ============================================================================
  
  VITE_BUILD_SOURCEMAP: z.coerce.boolean().default(false),
  VITE_BUILD_MINIFY: z.coerce.boolean().default(true),
  VITE_BUILD_OUTPUT_DIR: z.string().default('dist'),
  VITE_BUILD_ASSET_INLINE_LIMIT: z.coerce.number().int().positive().default(4096),
  
  // ============================================================================
  // BUILD METADATA (Auto-populated by CI/CD)
  // ============================================================================
  
  VITE_BUILD_TIME: z.string().optional(),
  VITE_COMMIT_SHA: z.string().optional(),
  VITE_BRANCH: z.string().optional(),
  VITE_BUILD_NUMBER: z.string().optional(),
});

/**
 * Parsed and validated environment configuration type
 */
export type Environment = z.infer<typeof envSchema>;

/**
 * Singleton class for managing environment configuration
 */
class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private config: Readonly<Environment>;
  private mode: string;

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {
    this.mode = import.meta.env.MODE || 'development';
    
    try {
      // Parse and validate environment variables
      const parsed = envSchema.parse(import.meta.env);
      
      // Freeze configuration to prevent modifications
      this.config = Object.freeze(parsed);
      
      // Log successful initialization in development
      if (this.isDevelopment() && !this.config.VITE_FEATURE_DEBUG_MODE) {
        console.info('✅ Environment configuration loaded successfully', {
          mode: this.mode,
          hasApiKey: !!this.config.VITE_511_API_KEY,
        });
      }
    } catch (error) {
      // Log detailed error in development
      if (this.isDevelopment()) {
        console.error('❌ Environment configuration validation failed:', error);
      }
      
      // Throw error to prevent app from running with invalid config
      throw new Error(
        `Invalid environment configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  /**
   * Get complete environment configuration
   */
  public getConfig(): Readonly<Environment> {
    return this.config;
  }

  /**
   * Get API configuration
   */
  public getApiConfig() {
    return {
      key: this.config.VITE_511_API_KEY,
      baseUrl: this.config.VITE_API_BASE_URL,
      timeout: this.config.VITE_API_TIMEOUT,
      maxRetries: this.config.VITE_API_MAX_RETRIES,
    } as const;
  }

  /**
   * Get application metadata
   */
  public getAppConfig() {
    return {
      title: this.config.VITE_APP_TITLE,
      version: this.config.VITE_APP_VERSION,
      description: this.config.VITE_APP_DESCRIPTION,
      environment: this.config.VITE_APP_ENVIRONMENT,
    } as const;
  }

  /**
   * Get polling and caching configuration
   */
  public getPollingConfig() {
    return {
      interval: this.config.VITE_POLL_INTERVAL,
      cacheTTL: this.config.VITE_CACHE_TTL,
      staleTime: this.config.VITE_STALE_TIME,
    } as const;
  }

  /**
   * Get rate limiting configuration
   */
  public getRateLimitConfig() {
    return {
      maxRequests: this.config.VITE_RATE_LIMIT_MAX_REQUESTS,
      window: this.config.VITE_RATE_LIMIT_WINDOW,
      warningThreshold: this.config.VITE_RATE_LIMIT_WARNING_THRESHOLD,
    } as const;
  }

  /**
   * Get map configuration
   */
  public getMapConfig() {
    return {
      center: {
        lat: this.config.VITE_MAP_CENTER_LAT,
        lng: this.config.VITE_MAP_CENTER_LNG,
      },
      zoom: {
        default: this.config.VITE_MAP_DEFAULT_ZOOM,
        min: this.config.VITE_MAP_MIN_ZOOM,
        max: this.config.VITE_MAP_MAX_ZOOM,
      },
      clustering: {
        enabled: this.config.VITE_MAP_ENABLE_CLUSTERING,
        distance: this.config.VITE_MAP_CLUSTER_DISTANCE,
      },
    } as const;
  }

  /**
   * Get geofence bounds
   */
  public getGeofenceBounds() {
    return {
      north: this.config.VITE_GEOFENCE_YMAX,
      south: this.config.VITE_GEOFENCE_YMIN,
      east: this.config.VITE_GEOFENCE_XMAX,
      west: this.config.VITE_GEOFENCE_XMIN,
    } as const;
  }

  /**
   * Get geofence as bounding box
   */
  public getGeofenceBBox() {
    return {
      xmin: this.config.VITE_GEOFENCE_XMIN,
      ymin: this.config.VITE_GEOFENCE_YMIN,
      xmax: this.config.VITE_GEOFENCE_XMAX,
      ymax: this.config.VITE_GEOFENCE_YMAX,
    } as const;
  }

  /**
   * Get feature flags
   */
  public getFeatureFlags() {
    return {
      offlineSupport: this.config.VITE_FEATURE_OFFLINE_SUPPORT,
      websocket: this.config.VITE_FEATURE_WEBSOCKET,
      analytics: this.config.VITE_FEATURE_ANALYTICS,
      debugMode: this.config.VITE_FEATURE_DEBUG_MODE,
    } as const;
  }

  /**
   * Get monitoring configuration
   */
  public getMonitoringConfig() {
    return {
      googleAnalytics: this.config.VITE_GA_TRACKING_ID,
      sentry: {
        dsn: this.config.VITE_SENTRY_DSN,
        environment: this.config.VITE_SENTRY_ENVIRONMENT,
        tracesSampleRate: this.config.VITE_SENTRY_TRACES_SAMPLE_RATE,
      },
      datadog: {
        applicationId: this.config.VITE_DATADOG_APPLICATION_ID,
        clientToken: this.config.VITE_DATADOG_CLIENT_TOKEN,
        site: this.config.VITE_DATADOG_SITE,
        service: this.config.VITE_DATADOG_SERVICE,
        env: this.config.VITE_DATADOG_ENV,
      },
      newRelic: {
        accountId: this.config.VITE_NEW_RELIC_ACCOUNT_ID,
        trustKey: this.config.VITE_NEW_RELIC_TRUST_KEY,
        agentId: this.config.VITE_NEW_RELIC_AGENT_ID,
        licenseKey: this.config.VITE_NEW_RELIC_LICENSE_KEY,
        applicationId: this.config.VITE_NEW_RELIC_APPLICATION_ID,
      },
    } as const;
  }

  /**
   * Get build metadata
   */
  public getBuildMetadata() {
    return {
      time: this.config.VITE_BUILD_TIME,
      commitSha: this.config.VITE_COMMIT_SHA,
      branch: this.config.VITE_BRANCH,
      buildNumber: this.config.VITE_BUILD_NUMBER,
    } as const;
  }

  /**
   * Check if running in development mode
   */
  public isDevelopment(): boolean {
    return import.meta.env.DEV === true;
  }

  /**
   * Check if running in production mode
   */
  public isProduction(): boolean {
    return import.meta.env.PROD === true;
  }

  /**
   * Get current mode
   */
  public getMode(): string {
    return this.mode;
  }

  /**
   * Get safe config for logging (redacts sensitive values)
   */
  public getSafeConfig(): Record<string, any> {
    return {
      ...this.config,
      VITE_511_API_KEY: '[REDACTED]',
      VITE_SENTRY_DSN: this.config.VITE_SENTRY_DSN ? '[REDACTED]' : undefined,
      VITE_DATADOG_CLIENT_TOKEN: this.config.VITE_DATADOG_CLIENT_TOKEN ? '[REDACTED]' : undefined,
      VITE_NEW_RELIC_LICENSE_KEY: this.config.VITE_NEW_RELIC_LICENSE_KEY ? '[REDACTED]' : undefined,
    };
  }

  /**
   * Print configuration to console (development only)
   */
  public printConfig(): void {
    if (!this.isDevelopment()) {
      console.warn('printConfig() should only be used in development');
      return;
    }

    console.group('🔧 Environment Configuration');
    console.log('Mode:', this.getMode());
    console.log('API:', this.getApiConfig());
    console.log('Polling:', this.getPollingConfig());
    console.log('Rate Limit:', this.getRateLimitConfig());
    console.log('Map:', this.getMapConfig());
    console.log('Geofence:', this.getGeofenceBounds());
    console.log('Features:', this.getFeatureFlags());
    console.log('Build:', this.getBuildMetadata());
    console.groupEnd();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Singleton instance of environment configuration
 */
export const envConfig = EnvironmentConfig.getInstance();

/**
 * Direct access to complete configuration
 * @deprecated Use envConfig.getConfig() for better IDE support
 */
export const env = envConfig.getConfig();

/**
 * Convenience exports for common checks
 */
export const isDevelopment = (): boolean => envConfig.isDevelopment();
export const isProduction = (): boolean => envConfig.isProduction();
export const getMode = (): string => envConfig.getMode();

/**
 * Get safe configuration for logging
 */
export const getSafeConfig = (): Record<string, any> => envConfig.getSafeConfig();

/**
 * Print configuration (development only)
 */
export const printConfig = (): void => envConfig.printConfig();
