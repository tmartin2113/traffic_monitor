/**
 * Utility Functions Exports
 * 
 * @module utils
 * @description Centralized export point for all utility functions and constants.
 * Provides helper functions, constants, and utility modules.
 * 
 * @author Senior Development Team
 * @since 1.0.0
 * @license MIT
 */

// Constants Export
export * from './constants';

// Geo Utilities Export
export * from './geoUtils';

// Date Utilities Export
export * from './dateUtils';

// Event Utilities Export  
export * from './eventUtils';

// Re-import for namespace organization
import * as constants from './constants';
import * as geoUtils from './geoUtils';
import * as dateUtils from './dateUtils';
import * as eventUtils from './eventUtils';

/**
 * Utils namespace containing all utility modules
 * @namespace Utils
 */
export const Utils = {
  Constants: constants,
  Geo: geoUtils,
  Date: dateUtils,
  Event: eventUtils,
} as const;

/**
 * Commonly used utility functions aggregated for convenience
 */
export const CommonUtils = {
  // From geoUtils
  calculateDistance: geoUtils.calculateDistance,
  isWithinGeofence: geoUtils.isWithinGeofence,
  getBounds: geoUtils.getBounds,
  
  // From dateUtils
  formatDateTime: dateUtils.formatDateTime,
  getRelativeTime: dateUtils.getRelativeTime,
  isRecent: dateUtils.isRecent,
  
  // From eventUtils
  getEventIcon: eventUtils.getEventIcon,
  getEventColor: eventUtils.getEventColor,
  isRoadClosure: eventUtils.isRoadClosure,
  getSeverityLevel: eventUtils.getSeverityLevel,
} as const;

/**
 * Performance utilities
 */
export const Performance = {
  /**
   * Debounce function execution
   * @param func - Function to debounce
   * @param wait - Wait time in milliseconds
   * @returns Debounced function
   */
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },
  
  /**
   * Throttle function execution
   * @param func - Function to throttle
   * @param limit - Time limit in milliseconds
   * @returns Throttled function
   */
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => { inThrottle = false; }, limit);
      }
    };
  },
  
  /**
   * Memoize function results
   * @param func - Function to memoize
   * @returns Memoized function
   */
  memoize: <T extends (...args: any[]) => any>(func: T): T => {
    const cache = new Map<string, ReturnType<T>>();
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      if (!cache.has(key)) {
        cache.set(key, func(...args));
      }
      return cache.get(key)!;
    }) as T;
  },
} as const;

/**
 * Validation utilities
 */
export const Validation = {
  /**
   * Validate email format
   * @param email - Email to validate
   * @returns True if valid email
   */
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  /**
   * Validate API key format
   * @param apiKey - API key to validate
   * @returns True if valid format
   */
  isValidApiKey: (apiKey: string): boolean => {
    return apiKey.length >= 20 && /^[a-zA-Z0-9]+$/.test(apiKey);
  },
  
  /**
   * Validate coordinates
   * @param lat - Latitude
   * @param lng - Longitude
   * @returns True if valid coordinates
   */
  isValidCoordinate: (lat: number, lng: number): boolean => {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  },
} as const;

/**
 * Format utilities
 */
export const Format = {
  /**
   * Format number with commas
   * @param num - Number to format
   * @returns Formatted string
   */
  numberWithCommas: (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },
  
  /**
   * Truncate string with ellipsis
   * @param str - String to truncate
   * @param maxLength - Maximum length
   * @returns Truncated string
   */
  truncate: (str: string, maxLength: number): string => {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
  },
  
  /**
   * Convert bytes to human-readable format
   * @param bytes - Number of bytes
   * @returns Formatted string
   */
  formatBytes: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
} as const;

/**
 * Array utilities
 */
export const Arrays = {
  /**
   * Remove duplicates from array
   * @param array - Array with potential duplicates
   * @returns Array without duplicates
   */
  unique: <T>(array: T[]): T[] => {
    return [...new Set(array)];
  },
  
  /**
   * Group array items by key
   * @param array - Array to group
   * @param key - Key to group by
   * @returns Grouped object
   */
  groupBy: <T>(array: T[], key: keyof T): Record<string, T[]> => {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      groups[groupKey] = groups[groupKey] || [];
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  },
  
  /**
   * Chunk array into smaller arrays
   * @param array - Array to chunk
   * @param size - Chunk size
   * @returns Array of chunks
   */
  chunk: <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },
} as const;

/**
 * Object utilities
 */
export const Objects = {
  /**
   * Deep clone an object
   * @param obj - Object to clone
   * @returns Cloned object
   */
  deepClone: <T>(obj: T): T => {
    return JSON.parse(JSON.stringify(obj));
  },
  
  /**
   * Check if object is empty
   * @param obj - Object to check
   * @returns True if empty
   */
  isEmpty: (obj: object): boolean => {
    return Object.keys(obj).length === 0;
  },
  
  /**
   * Pick specific keys from object
   * @param obj - Source object
   * @param keys - Keys to pick
   * @returns New object with picked keys
   */
  pick: <T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
    return keys.reduce((result, key) => {
      if (key in obj) {
        result[key] = obj[key];
      }
      return result;
    }, {} as Pick<T, K>);
  },
  
  /**
   * Omit specific keys from object
   * @param obj - Source object
   * @param keys - Keys to omit
   * @returns New object without omitted keys
   */
  omit: <T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
    const result = { ...obj };
    keys.forEach(key => delete result[key]);
    return result;
  },
} as const;

// Version information
export const UTILS_VERSION = '1.0.0' as const;
