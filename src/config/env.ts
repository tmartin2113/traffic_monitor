/**
 * @file config/env.ts
 * @description Production-ready environment variable parser with validation
 * @version 1.0.0
 * 
 * FIXES BUG #13: Environment Variable Type Mismatch
 * 
 * Features:
 * - Type-safe parsing of numeric/boolean environment variables
 * - Comprehensive validation with clear error messages
 * - Sensible defaults for all optional variables
 * - Runtime validation on application startup
 * - Immutable configuration object
 * - Zero runtime overhead after initialization
 */

import { z } from 'zod';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Schema for numeric environment variables with constraints
 */
const numericEnvSchema = (min: number, max: number, defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : defaultValue))
    .refine((val) => !isNaN(val), {
      message: 'Must be a valid number',
    })
    .refine((val) => val >= min && val <= max, {
      message: `Must be between ${min} and ${max}`,
    });

/**
 * Schema for float environment variables
 */
const floatEnvSchema = (min: number, max: number, defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : defaultValue))
    .refine((val) => !isNaN(val), {
      message: 'Must be a valid number',
    })
    .refine((val) => val >= min && val <= max, {
      message: `Must be between ${min} and ${max}`,
    });

/**
 * Schema for boolean environment variables
 */
const booleanEnvSchema = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return defaultValue;
      const normalized = val.toLowerCase().trim();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return false;
      }
      return defaultValue;
    });

/**
 * Schema for URL environment variables
 */
const urlSchema = (defaultValue: string) =>
  z
    .string()
    .url()
    .optional()
    .transform((val) => val || defaultValue);

/**
 * Complete environment variable schema
 */
const envSchema = z.object({
  // Required variables
  VITE_511_API_KEY: z.string().min(1, 'API key is required'),

  // API Configuration
  VITE_API_BASE_URL: urlSchema('https://api.511.org'),

  // Timing Configuration (in milliseconds)
  VITE_POLL_INTERVAL: numericEnvSchema(
    15000, // min: 15 seconds
    300000, // max: 5 minutes
    60000 // default: 60 seconds
  ),
  VITE_CACHE_TTL: numericEnvSchema(
    5000, // min: 5 seconds
    300000, // max: 5 minutes
    30000 // default: 30 seconds
  ),

  // Rate Limiting
  VITE_RATE_LIMIT_MAX_REQUESTS: numericEnvSchema(
    10, // min: 10 requests
    1000, // max: 1000 requests
    60 // default: 60 requests per hour
  ),

  // Map Configuration
  VITE_MAP_DEFAULT_LAT: floatEnvSchema(
    -90, // min latitude
    90, // max latitude
    37.5 // default: Bay Area center
  ),
  VITE_MAP_DEFAULT_LNG: floatEnvSchema(
    -180, // min longitude
    180, // max longitude
    -122.1 // default: Bay Area center
  ),
  VITE_MAP_DEFAULT_ZOOM: numericEnvSchema(
    1, // min zoom
    20, // max zoom
    10 // default zoom
  ),

  // Optional Configuration
  VITE_MAP_TILE_URL: z
    .string()
    .optional()
    .transform((val) => val || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
  
  VITE_ENABLE_WZDX: booleanEnvSchema(true),
  VITE_DEBUG: booleanEnvSchema(false),
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Parsed and validated environment configuration
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Environment variable validation error
 */
export class EnvValidationError extends Error {
  constructor(
    public field: string,
    public value: string | undefined,
    public issues: string[]
  ) {
    super(
      `Environment variable validation failed for ${field}:\n${issues.join('\n')}`
    );
    this.name = 'EnvValidationError';
  }
}

// ============================================================================
// PARSING AND VALIDATION
// ============================================================================

/**
 * Parse and validate environment variables
 * 
 * @throws {EnvValidationError} If validation fails
 * @returns Validated environment configuration
 */
function parseEnv(): EnvConfig {
  const rawEnv = {
    VITE_511_API_KEY: import.meta.env.VITE_511_API_KEY,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_POLL_INTERVAL: import.meta.env.VITE_POLL_INTERVAL,
    VITE_CACHE_TTL: import.meta.env.VITE_CACHE_TTL,
    VITE_RATE_LIMIT_MAX_REQUESTS: import.meta.env.VITE_RATE_LIMIT_MAX_REQUESTS,
    VITE_MAP_DEFAULT_LAT: import.meta.env.VITE_MAP_DEFAULT_LAT,
    VITE_MAP_DEFAULT_LNG: import.meta.env.VITE_MAP_DEFAULT_LNG,
    VITE_MAP_DEFAULT_ZOOM: import.meta.env.VITE_MAP_DEFAULT_ZOOM,
    VITE_MAP_TILE_URL: import.meta.env.VITE_MAP_TILE_URL,
    VITE_ENABLE_WZDX: import.meta.env.VITE_ENABLE_WZDX,
    VITE_DEBUG: import.meta.env.VITE_DEBUG,
  };

  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const firstError = result.error.issues[0];
    throw new EnvValidationError(
      firstError.path.join('.'),
      rawEnv[firstError.path[0] as keyof typeof rawEnv],
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    );
  }

  return result.data;
}

// ============================================================================
// EXPORTED CONFIGURATION
// ============================================================================

/**
 * Validated and parsed environment configuration
 * 
 * This object is created once at module initialization and frozen
 * to prevent any runtime modifications.
 * 
 * @example
 * ```typescript
 * import { env } from '@/config/env';
 * 
 * // Use parsed numeric values directly
 * setInterval(fetchData, env.VITE_POLL_INTERVAL);
 * 
 * // All values are properly typed
 * const lat: number = env.VITE_MAP_DEFAULT_LAT;
 * ```
 */
export const env: Readonly<EnvConfig> = Object.freeze(parseEnv());

/**
 * Type guard to check if running in development mode
 */
export const isDevelopment = (): boolean => {
  return import.meta.env.DEV;
};

/**
 * Type guard to check if running in production mode
 */
export const isProduction = (): boolean => {
  return import.meta.env.PROD;
};

/**
 * Get safe environment config for logging (redacts sensitive values)
 */
export function getSafeEnvConfig(): Record<string, unknown> {
  return {
    VITE_511_API_KEY: env.VITE_511_API_KEY ? '[REDACTED]' : '[NOT SET]',
    VITE_API_BASE_URL: env.VITE_API_BASE_URL,
    VITE_POLL_INTERVAL: env.VITE_POLL_INTERVAL,
    VITE_CACHE_TTL: env.VITE_CACHE_TTL,
    VITE_RATE_LIMIT_MAX_REQUESTS: env.VITE_RATE_LIMIT_MAX_REQUESTS,
    VITE_MAP_DEFAULT_LAT: env.VITE_MAP_DEFAULT_LAT,
    VITE_MAP_DEFAULT_LNG: env.VITE_MAP_DEFAULT_LNG,
    VITE_MAP_DEFAULT_ZOOM: env.VITE_MAP_DEFAULT_ZOOM,
    VITE_MAP_TILE_URL: env.VITE_MAP_TILE_URL,
    VITE_ENABLE_WZDX: env.VITE_ENABLE_WZDX,
    VITE_DEBUG: env.VITE_DEBUG,
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
  };
}

/**
 * Validate environment configuration and log results
 * Called during application initialization
 */
export function validateAndLogEnv(): void {
  try {
    const safeConfig = getSafeEnvConfig();
    
    if (env.VITE_DEBUG) {
      console.group('🔧 Environment Configuration');
      console.table(safeConfig);
      console.groupEnd();
    }

    // Warn about potentially misconfigured values
    if (env.VITE_POLL_INTERVAL < 30000 && isProduction()) {
      console.warn(
        '⚠️ VITE_POLL_INTERVAL is set to less than 30 seconds in production. ' +
        'This may cause rate limiting issues.'
      );
    }

    if (!env.VITE_511_API_KEY.startsWith('test') && isDevelopment()) {
      console.info(
        '💡 Using production API key in development. Consider using a test key.'
      );
    }

  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error('❌ Environment validation failed:');
      console.error(error.message);
      console.error('\nPlease check your .env file and ensure all required variables are set correctly.');
      throw error;
    }
    throw error;
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default env;
