/**
 * @file config/env.ts
 * @description Production-ready environment configuration
 * @version 2.0.0
 * 
 * FIXES BUG #17: Updated printConfig to use logger instead of console
 */

import { z } from 'zod';
import { logger } from '../utils/logger';

const envSchema = z.object({
  VITE_511_API_KEY: z.string().min(1, 'API key is required'),
  VITE_API_BASE_URL: z.string().url().default('https://api.511.org'),
  VITE_API_TIMEOUT: z.coerce.number().positive().default(30000),
  VITE_API_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  
  VITE_POLL_INTERVAL: z.coerce.number().positive().min(10000).default(60000),
  VITE_CACHE_TTL: z.coerce.number().positive().default(30000),
  VITE_STALE_TIME: z.coerce.number().positive().default(60000),
  
  VITE_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().max(60).default(60),
  VITE_RATE_LIMIT_WINDOW: z.coerce.number().positive().default(3600000),
  VITE_RATE_LIMIT_BUFFER: z.coerce.number().positive().default(100),
  
  VITE_MAP_DEFAULT_LAT: z.coerce.number().min(-90).max(90).default(37.7749),
  VITE_MAP_DEFAULT_LNG: z.coerce.number().min(-180).max(180).default(-122.4194),
  VITE_MAP_DEFAULT_ZOOM: z.coerce.number().int().min(1).max(20).default(10),
  VITE_MAP_MIN_ZOOM: z.coerce.number().int().min(1).max(20).default(8),
  VITE_MAP_MAX_ZOOM: z.coerce.number().int().min(1).max(20).default(18),
  VITE_MAP_UPDATE_INTERVAL: z.coerce.number().positive().default(30000),
  VITE_MAP_CLUSTER_THRESHOLD: z.coerce.number().int().positive().default(50),
  VITE_MAP_TILE_URL: z.string().url().default('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
  
  VITE_GEOFENCE_NORTH: z.coerce.number().min(-90).max(90).default(37.86217361),
  VITE_GEOFENCE_SOUTH: z.coerce.number().min(-90).max(90).default(37.21559028),
  VITE_GEOFENCE_EAST: z.coerce.number().min(-180).max(180).default(-121.66525694),
  VITE_GEOFENCE_WEST: z.coerce.number().min(-180).max(180).default(-122.57031250),
  
  VITE_ENABLE_WZDX: z.coerce.boolean().default(true),
  VITE_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
  VITE_ENABLE_PWA: z.coerce.boolean().default(true),
  VITE_DEBUG: z.coerce.boolean().default(false),
  
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_GA_TRACKING_ID: z.string().optional(),
  
  VITE_DEV_SERVER_PORT: z.coerce.number().int().positive().default(3000),
  VITE_DEV_SERVER_HOST: z.string().default('localhost'),
  VITE_DEV_SERVER_OPEN: z.coerce.boolean().default(false),
  
  VITE_BUILD_SOURCEMAP: z.coerce.boolean().default(false),
  VITE_BUILD_MINIFY: z.coerce.boolean().default(true),
  VITE_BUILD_OUTPUT_DIR: z.string().default('dist'),
  VITE_BUILD_ASSET_INLINE_LIMIT: z.coerce.number().int().positive().default(4096),
});

export type Environment = z.infer<typeof envSchema>;

class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private config: Environment;
  private env: string;

  private constructor() {
    this.env = import.meta.env.MODE || 'development';
    
    try {
      this.config = Object.freeze(envSchema.parse(import.meta.env));
      
      if (this.isDevelopment()) {
        logger.info('Environment configuration loaded successfully', {
          mode: this.env,
          hasApiKey: !!this.config.VITE_511_API_KEY
        });
      }
    } catch (error) {
      logger.error('Environment configuration validation failed', { error });
      throw new Error(`Invalid environment configuration: ${error}`);
    }
  }

  static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  getConfig(): Readonly<Environment> {
    return this.config;
  }

  getApiConfig() {
    return {
      VITE_511_API_KEY: this.config.VITE_511_API_KEY,
      VITE_API_BASE_URL: this.config.VITE_API_BASE_URL,
      VITE_API_TIMEOUT: this.config.VITE_API_TIMEOUT,
      VITE_API_MAX_RETRIES: this.config.VITE_API_MAX_RETRIES,
    };
  }

  getPollingConfig() {
    return {
      VITE_POLL_INTERVAL: this.config.VITE_POLL_INTERVAL,
      VITE_CACHE_TTL: this.config.VITE_CACHE_TTL,
      VITE_STALE_TIME: this.config.VITE_STALE_TIME,
    };
  }

  getRateLimitConfig() {
    return {
      VITE_RATE_LIMIT_MAX_REQUESTS: this.config.VITE_RATE_LIMIT_MAX_REQUESTS,
      VITE_RATE_LIMIT_WINDOW: this.config.VITE_RATE_LIMIT_WINDOW,
      VITE_RATE_LIMIT_BUFFER: this.config.VITE_RATE_LIMIT_BUFFER,
    };
  }

  getMapConfig() {
    return {
      VITE_MAP_DEFAULT_LAT: this.config.VITE_MAP_DEFAULT_LAT,
      VITE_MAP_DEFAULT_LNG: this.config.VITE_MAP_DEFAULT_LNG,
      VITE_MAP_DEFAULT_ZOOM: this.config.VITE_MAP_DEFAULT_ZOOM,
      VITE_MAP_MIN_ZOOM: this.config.VITE_MAP_MIN_ZOOM,
      VITE_MAP_MAX_ZOOM: this.config.VITE_MAP_MAX_ZOOM,
      VITE_MAP_UPDATE_INTERVAL: this.config.VITE_MAP_UPDATE_INTERVAL,
      VITE_MAP_CLUSTER_THRESHOLD: this.config.VITE_MAP_CLUSTER_THRESHOLD,
      VITE_MAP_TILE_URL: this.config.VITE_MAP_TILE_URL,
    };
  }

  getGeofenceBounds() {
    return {
      north: this.config.VITE_GEOFENCE_NORTH,
      south: this.config.VITE_GEOFENCE_SOUTH,
      east: this.config.VITE_GEOFENCE_EAST,
      west: this.config.VITE_GEOFENCE_WEST,
    };
  }

  getFeatureFlags() {
    return {
      VITE_ENABLE_WZDX: this.config.VITE_ENABLE_WZDX,
      VITE_ENABLE_ANALYTICS: this.config.VITE_ENABLE_ANALYTICS,
      VITE_ENABLE_PWA: this.config.VITE_ENABLE_PWA,
      VITE_DEBUG: this.config.VITE_DEBUG,
    };
  }

  getMonitoringConfig() {
    return {
      VITE_SENTRY_DSN: this.config.VITE_SENTRY_DSN,
      VITE_GA_TRACKING_ID: this.config.VITE_GA_TRACKING_ID,
    };
  }

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
   * BUG FIX #17: Updated to use logger instead of console
   * 
   * Debug helper for printing configuration in development
   */
  printConfig(): void {
    if (!this.isDevelopment()) {
      logger.warn('printConfig() should only be used in development');
      return;
    }

    logger.debug('🔧 Environment Configuration', {
      environment: this.env,
      api: this.getApiConfig(),
      polling: this.getPollingConfig(),
      rateLimit: this.getRateLimitConfig(),
      map: this.getMapConfig(),
      geofence: this.getGeofenceBounds(),
      features: this.getFeatureFlags(),
      monitoring: this.getMonitoringConfig(),
    });
  }
}

export const envConfig = EnvironmentConfig.getInstance();
export const env = envConfig.getConfig();
