/**
 * API Services Exports
 * 
 * @module services/api
 * @description Centralized export point for all API service modules.
 * Provides HTTP client instances and API interaction layers.
 * 
 * @author Senior Development Team
 * @since 1.0.0
 * @license MIT
 */

// Service Exports
export { trafficAPI, TrafficAPI, TrafficAPIError } from './trafficApi';
export { wzdxAPI, WZDxAPI } from './wzdxApi';

// Type Exports
export type { 
  TrafficEventParams,
  WZDxParams as TrafficWZDxParams 
} from './trafficApi';

export type { 
  WZDxParams,
  WZDxFeature,
  WZDxProperties,
  CoreDetails,
  DataSource 
} from './wzdxApi';

// Re-import for namespace organization
import { trafficAPI, TrafficAPI, TrafficAPIError } from './trafficApi';
import { wzdxAPI, WZDxAPI } from './wzdxApi';

/**
 * API namespace containing all API service instances
 * @namespace API
 */
export const API = {
  traffic: trafficAPI,
  wzdx: wzdxAPI,
} as const;

/**
 * API class constructors for creating new instances
 */
export const APIClasses = {
  Traffic: TrafficAPI,
  WZDx: WZDxAPI,
} as const;

/**
 * API Error classes for error handling
 */
export const APIErrors = {
  TrafficAPIError,
} as const;

/**
 * API configuration constants
 */
export const API_CONFIG = {
  BASE_URL: 'https://api.511.org',
  TIMEOUT: 10000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  RATE_LIMIT: {
    MAX_REQUESTS_PER_HOUR: 100,
    MAX_REQUESTS_PER_MINUTE: 10,
  },
} as const;

/**
 * API endpoints configuration
 */
export const API_ENDPOINTS = {
  TRAFFIC_EVENTS: '/traffic/events',
  WZDX: '/traffic/wzdx',
  TOLLS: '/toll/programs',
  TRANSIT: '/transit',
} as const;

/**
 * API response status codes
 */
export const API_STATUS_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Helper function to check if an error is an API error
 * @param error - The error to check
 * @returns True if the error is a TrafficAPIError
 */
export function isAPIError(error: unknown): error is TrafficAPIError {
  return error instanceof TrafficAPIError;
}

/**
 * Helper function to get a user-friendly error message
 * @param error - The error object
 * @returns A user-friendly error message
 */
export function getAPIErrorMessage(error: unknown): string {
  if (isAPIError(error)) {
    switch (error.code) {
      case 'API_KEY_MISSING':
        return 'Please provide a valid API key to continue.';
      case 'UNAUTHORIZED':
        return 'Your API key is invalid. Please check and try again.';
      case 'RATE_LIMIT_EXCEEDED':
        return 'Rate limit exceeded. Please wait before making more requests.';
      case 'NETWORK_ERROR':
        return 'Network connection error. Please check your internet connection.';
      case 'SERVICE_ERROR':
        return 'The API service is temporarily unavailable. Please try again later.';
      default:
        return error.message || 'An unexpected error occurred.';
    }
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Type for API response wrapper
 */
export interface APIResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  timestamp: number;
}

/**
 * Type for paginated API responses
 */
export interface PaginatedAPIResponse<T> extends APIResponse<T[]> {
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Version information
export const API_VERSION = '1.0.0' as const;
