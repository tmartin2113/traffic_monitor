/**
 * @file config/environment.ts
 * @description Production-ready environment configuration with type validation
 * @version 1.0.0
 */

import { z } from 'zod';

/**
 * Environment schema with Zod validation
 */
const envSchema = z.object({
  // API Configuration
  VITE_511_API_KEY: z.string().min(1, 'API key is required'),
  VITE_API_BASE_URL: z.string().url().default('https://api.511.org'),
  VITE_API_TIMEOUT: z.coerce.number().positive().default(30000),
  VITE_API_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  
  // Data Refresh & Caching
  VITE_POLL_INTERVAL: z.coerce.number().positive().min(10000).default(60000),
  VITE_CACHE_TTL: z.coerce.number().positive().default(30000),
  VITE_STALE_TIME: z.coerce.number().positive().default(60000),
  
  // Rate Limiting
  VITE_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().max(60).default(60),
  VITE_RATE_LIMIT_WINDOW: z.coerce.number().positive().default(3600000),
  VITE_RATE_LIMIT_BUFFER: z.coerce.number().positive().default(100),
  
  // Map Configuration
  VITE_MAP_DEFAULT_LAT: z.coerce.number().min(-90).max(90).default(37.7749),
  VITE_MAP_DEFAULT_LNG: z.coerce.number().min(-180).max(180).default(-122.4194),
  VITE_MAP_DEFAULT_ZOOM: z.coerce.number().int().min(1).max(20).default(10),
  VITE_MAP_MIN_ZOOM: z.coerce.number().int().min(1).max(20).default(8),
  VITE_MAP_MAX_ZOOM: z.coerce.number().int().min(1).max(20).default(18),
  VITE_MAP_UPDATE_INTERVAL: z.coerce.number().positive().default(30000),
  VITE_MAP_CLUSTER_THRESHOLD: z.coerce.number().int().positive().default(50),
  VITE_MAP_TILE_URL: z.string().url().default('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
  
  // Geofence
  VITE_GEOFENCE_NORTH: z.coerce.number().min(-90).max(90).default(37.86217361),
  VITE_GEOFENCE_SOUTH: z.coerce.number().min(-90).max(90).default(37.21559028),
  VITE_GEOFENCE_EAST: z.coerce.number().min(-180).max(180).default(-121.66525694),
  VITE_GEOFENCE_WEST: z.coerce.number().min(-180).max(180).default(-122.57031250),
  
  // Feature Flags
  VITE_ENABLE_WZDX: z.coerce.boolean().default(true),
  VITE_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
  VITE_ENABLE_PWA: z.coerce.boolean().default(true),
  VITE_DEBUG: z.coerce.boolean().default(false),
  
  // Optional Monitoring
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_GA_TRACKING_ID: z.string().optional(),
  
  // Development Server
  VITE_DEV_SERVER_PORT: z.coerce.number().int().positive().default(3000),
  VITE_DEV_SERVER_HOST: z.string().default('localhost'),
  VITE_DEV_SERVER_OPEN: z.coerce.boolean().default(false),
  
  // Build Configuration
  VITE_BUILD_SOURCEMAP: z.coerce.boolean().default(false),
  VITE_BUILD_MINIFY: z.coerce.boolean().default(true),
  VITE_BUILD_OUTPUT_DIR: z.string().default('dist'),
  VITE_BUILD_ASSET_INLINE_LIMIT: z.coerce.number().int().positive().default(4096),
});

/**
 * Parsed and validated environment type
 */
export type Environment = z.infer<typeof envSchema>;

/**
 * Environment configuration class
 */
class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private config: Environment;
  private readonly env: string;

  private constructor() {
    this.env = import.meta.env.MODE || 'development';
    this.config = this.loadAndValidate();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  /**
   * Load and validate environment variables
   */
  private loadAndValidate(): Environment {
    try {
      const parsed = envSchema.parse(import.meta.env);
      
      // Additional custom validation
      this.validateCustomRules(parsed);
      
      if (this.isDevelopment()) {
        console.log('[Environment] Configuration loaded successfully');
        console.table({
          'Poll Interval': `${parsed.VITE_POLL_INTERVAL}ms`,
          'Cache TTL': `${parsed.VITE_CACHE_TTL}ms`,
          'Rate Limit': `${parsed.VITE_RATE_LIMIT_MAX_REQUESTS}/hour`,
          'Map Center': `${parsed.VITE_MAP_DEFAULT_LAT}, ${parsed.VITE_MAP_DEFAULT_LNG}`,
          'Debug Mode': parsed.VITE_DEBUG
        });
      }
      
      return parsed;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('[Environment] Validation errors:');
        error.errors.forEach((err) => {
          console.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
        throw new Error('Environment configuration validation failed');
      }
      throw error;
    }
  }

  /**
   * Custom validation rules
   */
  private validateCustomRules(config: Environment): void {
    // Validate zoom levels
    if (config.VITE_MAP_MIN_ZOOM >= config.VITE_MAP_MAX_ZOOM) {
      throw new Error('VITE_MAP_MIN_ZOOM must be less than VITE_MAP_MAX_ZOOM');
    }

    // Validate geofence bounds
    if (config.VITE_GEOFENCE_SOUTH >= config.VITE_GEOFENCE_NORTH) {
      throw new Error('VITE_GEOFENCE_SOUTH must be less than VITE_GEOFENCE_NORTH');
    }

    if (config.VITE_GEOFENCE_WEST >= config.VITE_GEOFENCE_EAST) {
      throw new Error('VITE_GEOFENCE_WEST must be less than VITE_GEOFENCE_EAST');
    }

    // Validate cache TTL vs poll interval
    if (config.VITE_CACHE_TTL > config.VITE_POLL_INTERVAL) {
      console.warn('[Environment] Cache TTL is greater than poll interval');
    }

    // Validate rate limit
    if (config.VITE_RATE_LIMIT_MAX_REQUESTS > 60) {
      console.warn('[Environment] Rate limit exceeds 511.org limit of 60/hour');
    }
  }

  /**
   * Get full configuration object
   */
  getConfig(): Readonly<Environment> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Get API key (with validation)
   */
  getApiKey(): string {
    if (!this.config.VITE_511_API_KEY || this.config.VITE_511_API_KEY === 'your_api_key_here') {
      throw new Error('Invalid or missing 511.org API key. Please set VITE_511_API_KEY in .env');
    }
    return this.config.VITE_511_API_KEY;
  }

  /**
   * Get API configuration
   */
  getApiConfig() {
    return {
      baseUrl: this.config.VITE_API_BASE_URL,
      timeout: this.config.VITE_API_TIMEOUT,
      maxRetries: this.config.VITE_API_MAX_RETRIES,
    };
  }

  /**
   * Get polling configuration
   */
  getPollingConfig() {
    return {
      interval: this.config.VITE_POLL_INTERVAL,
      cacheTTL: this.config.VITE_CACHE_TTL,
      staleTime: this.config.VITE_STALE_TIME,
    };
  }

  /**
   * Get rate limit configuration
   */
  getRateLimitConfig() {
    return {
      maxRequests: this.config.VITE_RATE_LIMIT_MAX_REQUESTS,
      window: this.config.VITE_RATE_LIMIT_WINDOW,
      buffer: this.config.VITE_RATE_LIMIT_BUFFER,
    };
  }

  /**
   * Get map configuration
   */
  getMapConfig() {
    return {
      center: {
        lat: this.config.VITE_MAP_DEFAULT_LAT,
        lng: this.config.VITE_MAP_DEFAULT_LNG,
      },
      zoom: {
        default: this.config.VITE_MAP_DEFAULT_ZOOM,
        min: this.config.VITE_MAP_MIN_ZOOM,
        max: this.config.VITE_MAP_MAX_ZOOM,
      },
      tileUrl: this.config.VITE_MAP_TILE_URL,
      updateInterval: this.config.VITE_MAP_UPDATE_INTERVAL,
      clusterThreshold: this.config.VITE_MAP_CLUSTER_THRESHOLD,
    };
  }

  /**
   * Get geofence bounds
   */
  getGeofenceBounds() {
    return {
      north: this.config.VITE_GEOFENCE_NORTH,
      south: this.config.VITE_GEOFENCE_SOUTH,
      east: this.config.VITE_GEOFENCE_EAST,
      west: this.config.VITE_GEOFENCE_WEST,
    };
  }

  /**
   * Get feature flags
   */
  getFeatureFlags() {
    return {
      wzdx: this.config.VITE_ENABLE_WZDX,
      analytics: this.config.VITE_ENABLE_ANALYTICS,
      pwa: this.config.VITE_ENABLE_PWA,
      debug: this.config.VITE_DEBUG,
    };
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: 'wzdx' | 'analytics' | 'pwa' | 'debug'): boolean {
    const flags = this.getFeatureFlags();
    return flags[feature];
  }

  /**
   * Get monitoring configuration
   */
  getMonitoringConfig() {
    return {
      sentryDsn: this.config.VITE_SENTRY_DSN,
      gaTrackingId: this.config.VITE_GA_TRACKING_ID,
    };
  }

  /**
   * Environment checks
   */
  isDevelopment(): boolean {
    return this.env === 'development';
  }

  isProduction(): boolean {
    return this.env === 'production';
  }

  getEnvironment(): string {
    return this.env;
  }

  /**
   * Debug helper
   */
  printConfig(): void {
    if (!this.isDevelopment()) {
      console.warn('[Environment] printConfig() should only be used in development');
      return;
    }

    console.group('🔧 Environment Configuration');
    console.log('Environment:', this.env);
    console.log('API:', this.getApiConfig());
    console.log('Polling:', this.getPollingConfig());
    console.log('Rate Limit:', this.getRateLimitConfig());
    console.log('Map:', this.getMapConfig());
    console.log('Geofence:', this.getGeofenceBounds());
    console.log('Features:', this.getFeatureFlags());
    console.groupEnd();
  }
}

/**
 * Export singleton instance
 */
export const envConfig = EnvironmentConfig.getInstance();

/**
 * Export typed environment for direct access (use sparingly)
 */
export const env = envConfig.getConfig();
