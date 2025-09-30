/**
 * @file config/environment.ts
 * @description Environment configuration and validation for production deployment
 * @version 1.0.0
 */

/**
 * Environment variable schema
 */
interface EnvironmentConfig {
  // API Keys
  API_KEYS: {
    BAY_AREA_511?: string;
    NYC_DOT_TOKEN?: string;
    MAPBOX_TOKEN?: string;
    LA_511?: string;
    CHICAGO_DOT?: string;
    SEATTLE_DOT?: string;
  };
  
  // Feature Flags
  FEATURES: {
    ENABLE_ANALYTICS: boolean;
    ENABLE_ERROR_REPORTING: boolean;
    ENABLE_PERFORMANCE_MONITORING: boolean;
    ENABLE_OFFLINE_MODE: boolean;
    ENABLE_BETA_FEATURES: boolean;
  };
  
  // API Configuration
  API: {
    DEFAULT_TIMEOUT: number;
    MAX_RETRY_ATTEMPTS: number;
    CACHE_DURATION: number;
    RATE_LIMIT_BUFFER: number;
  };
  
  // Map Configuration
  MAP: {
    DEFAULT_ZOOM: number;
    MIN_ZOOM: number;
    MAX_ZOOM: number;
    CLUSTER_THRESHOLD: number;
    UPDATE_INTERVAL: number;
  };
  
  // Application
  APP: {
    NAME: string;
    VERSION: string;
    ENVIRONMENT: 'development' | 'staging' | 'production';
    LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
    BASE_URL: string;
  };
  
  // Monitoring
  MONITORING: {
    SENTRY_DSN?: string;
    GA_TRACKING_ID?: string;
    DATADOG_CLIENT_TOKEN?: string;
    NEW_RELIC_LICENSE_KEY?: string;
  };
}

/**
 * Environment configuration loader with validation
 */
class EnvironmentConfigManager {
  private config: EnvironmentConfig;
  private validationErrors: string[] = [];
  
  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
    
    if (this.validationErrors.length > 0) {
      this.handleValidationErrors();
    }
    
    // Freeze config to prevent runtime modifications
    Object.freeze(this.config);
  }
  
  /**
   * Load configuration from environment variables
   */
  private loadConfig(): EnvironmentConfig {
    const env = process.env;
    const nodeEnv = env.NODE_ENV || 'development';
    
    return {
      API_KEYS: {
        BAY_AREA_511: env.REACT_APP_511_API_KEY,
        NYC_DOT_TOKEN: env.REACT_APP_NYC_APP_TOKEN,
        MAPBOX_TOKEN: env.REACT_APP_MAPBOX_TOKEN,
        LA_511: env.REACT_APP_LA_511_API_KEY,
        CHICAGO_DOT: env.REACT_APP_CHICAGO_API_KEY,
        SEATTLE_DOT: env.REACT_APP_SEATTLE_API_KEY
      },
      
      FEATURES: {
        ENABLE_ANALYTICS: env.REACT_APP_ENABLE_ANALYTICS === 'true',
        ENABLE_ERROR_REPORTING: env.REACT_APP_ENABLE_ERROR_REPORTING !== 'false',
        ENABLE_PERFORMANCE_MONITORING: env.REACT_APP_ENABLE_PERF_MONITORING === 'true',
        ENABLE_OFFLINE_MODE: env.REACT_APP_ENABLE_OFFLINE === 'true',
        ENABLE_BETA_FEATURES: env.REACT_APP_ENABLE_BETA === 'true'
      },
      
      API: {
        DEFAULT_TIMEOUT: this.parseNumber(env.REACT_APP_API_TIMEOUT, 30000),
        MAX_RETRY_ATTEMPTS: this.parseNumber(env.REACT_APP_MAX_RETRIES, 3),
        CACHE_DURATION: this.parseNumber(env.REACT_APP_CACHE_DURATION, 30000),
        RATE_LIMIT_BUFFER: this.parseNumber(env.REACT_APP_RATE_LIMIT_BUFFER, 100)
      },
      
      MAP: {
        DEFAULT_ZOOM: this.parseNumber(env.REACT_APP_DEFAULT_ZOOM, 11),
        MIN_ZOOM: this.parseNumber(env.REACT_APP_MIN_ZOOM, 5),
        MAX_ZOOM: this.parseNumber(env.REACT_APP_MAX_ZOOM, 18),
        CLUSTER_THRESHOLD: this.parseNumber(env.REACT_APP_CLUSTER_THRESHOLD, 50),
        UPDATE_INTERVAL: this.parseNumber(env.REACT_APP_UPDATE_INTERVAL, 30000)
      },
      
      APP: {
        NAME: env.REACT_APP_NAME || 'Traffic Event Monitor',
        VERSION: env.REACT_APP_VERSION || '1.0.0',
        ENVIRONMENT: this.validateEnvironment(nodeEnv),
        LOG_LEVEL: this.validateLogLevel(env.REACT_APP_LOG_LEVEL),
        BASE_URL: env.REACT_APP_BASE_URL || window.location.origin
      },
      
      MONITORING: {
        SENTRY_DSN: env.REACT_APP_SENTRY_DSN,
        GA_TRACKING_ID: env.REACT_APP_GA_TRACKING_ID,
        DATADOG_CLIENT_TOKEN: env.REACT_APP_DATADOG_CLIENT_TOKEN,
        NEW_RELIC_LICENSE_KEY: env.REACT_APP_NEW_RELIC_LICENSE_KEY
      }
    };
  }
  
  /**
   * Parse number from environment variable
   */
  private parseNumber(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  /**
   * Validate environment type
   */
  private validateEnvironment(env: string): 'development' | 'staging' | 'production' {
    const valid = ['development', 'staging', 'production'];
    return valid.includes(env) ? env as any : 'development';
  }
  
  /**
   * Validate log level
   */
  private validateLogLevel(level?: string): 'debug' | 'info' | 'warn' | 'error' {
    const valid = ['debug', 'info', 'warn', 'error'];
    return valid.includes(level || '') ? level as any : 'info';
  }
  
  /**
   * Validate configuration
   */
  private validateConfig(): void {
    const { APP, API, MAP } = this.config;
    
    // Critical validations for production
    if (APP.ENVIRONMENT === 'production') {
      if (!this.config.MONITORING.SENTRY_DSN) {
        this.validationErrors.push('Sentry DSN is required in production');
      }
      
      if (!this.config.FEATURES.ENABLE_ERROR_REPORTING) {
        this.validationErrors.push('Error reporting should be enabled in production');
      }
    }
    
    // API validations
    if (API.DEFAULT_TIMEOUT < 5000) {
      this.validationErrors.push('API timeout should be at least 5000ms');
    }
    
    if (API.MAX_RETRY_ATTEMPTS < 1 || API.MAX_RETRY_ATTEMPTS > 10) {
      this.validationErrors.push('Max retry attempts should be between 1 and 10');
    }
    
    // Map validations
    if (MAP.MIN_ZOOM >= MAP.MAX_ZOOM) {
      this.validationErrors.push('Min zoom must be less than max zoom');
    }
    
    if (MAP.UPDATE_INTERVAL < 10000) {
      this.validationErrors.push('Update interval should be at least 10 seconds');
    }
    
    // Warn about missing API keys
    if (!this.config.API_KEYS.BAY_AREA_511 && APP.ENVIRONMENT !== 'development') {
      console.warn('Bay Area 511 API key is not configured');
    }
  }
  
  /**
   * Handle validation errors
   */
  private handleValidationErrors(): void {
    const errorMessage = 'Environment configuration errors:\n' + 
      this.validationErrors.map(e => `  - ${e}`).join('\n');
    
    if (this.config.APP.ENVIRONMENT === 'production') {
      // In production, log errors but don't crash
      console.error(errorMessage);
      
      // Report to monitoring service if available
      if (this.config.MONITORING.SENTRY_DSN) {
        // Sentry would be initialized here
        console.error('Reporting configuration errors to Sentry');
      }
    } else {
      // In development, throw to catch configuration issues early
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Get configuration
   */
  getConfig(): Readonly<EnvironmentConfig> {
    return this.config;
  }
  
  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof EnvironmentConfig['FEATURES']): boolean {
    return this.config.FEATURES[feature];
  }
  
  /**
   * Get API key for a provider
   */
  getApiKey(provider: keyof EnvironmentConfig['API_KEYS']): string | undefined {
    return this.config.API_KEYS[provider];
  }
  
  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.config.APP.ENVIRONMENT === 'production';
  }
  
  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.config.APP.ENVIRONMENT === 'development';
  }
  
  /**
   * Get safe configuration for client-side logging
   */
  getSafeConfig(): Record<string, any> {
    const { API_KEYS, MONITORING, ...safeConfig } = this.config;
    return {
      ...safeConfig,
      API_KEYS: Object.keys(API_KEYS).reduce((acc, key) => ({
        ...acc,
        [key]: API_KEYS[key as keyof typeof API_KEYS] ? '[REDACTED]' : 'Not configured'
      }), {}),
      MONITORING: Object.keys(MONITORING).reduce((acc, key) => ({
        ...acc,
        [key]: MONITORING[key as keyof typeof MONITORING] ? '[REDACTED]' : 'Not configured'
      }), {})
    };
  }
}

/**
 * Singleton instance
 */
export const envConfig = new EnvironmentConfigManager();

/**
 * Helper function to require environment variable
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Helper function to get optional environment variable
 */
export function optionalEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

/**
 * Export configuration for use throughout the application
 */
export default envConfig.getConfig();
