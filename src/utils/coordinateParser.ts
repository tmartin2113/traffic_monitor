/**
 * @file utils/coordinateParser.ts
 * @description Safe coordinate parsing with NaN validation
 * @version 1.0.0
 * 
 * FIXES BUG #14: Coordinate Parsing Doesn't Handle Invalid Values
 */

import { z } from 'zod';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Result of coordinate parsing operation
 */
export interface CoordinateParseResult {
  success: boolean;
  latitude?: number;
  longitude?: number;
  error?: string;
}

/**
 * Coordinate bounds for validation
 */
export interface CoordinateBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default coordinate bounds (entire world)
 */
export const DEFAULT_BOUNDS: CoordinateBounds = {
  minLat: -90,
  maxLat: 90,
  minLng: -180,
  maxLng: 180,
};

/**
 * Bay Area coordinate bounds (for stricter validation)
 */
export const BAY_AREA_BOUNDS: CoordinateBounds = {
  minLat: 36.5,
  maxLat: 38.5,
  minLng: -123.0,
  maxLng: -121.0,
};

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Zod schema for latitude validation
 */
const latitudeSchema = z
  .number()
  .min(-90, 'Latitude must be >= -90')
  .max(90, 'Latitude must be <= 90')
  .refine((val) => !isNaN(val), 'Latitude must be a valid number');

/**
 * Zod schema for longitude validation
 */
const longitudeSchema = z
  .number()
  .min(-180, 'Longitude must be >= -180')
  .max(180, 'Longitude must be <= 180')
  .refine((val) => !isNaN(val), 'Longitude must be a valid number');

// ============================================================================
// SAFE PARSING FUNCTIONS
// ============================================================================

/**
 * Safely parse a latitude value from various input types
 * 
 * @param value - Raw latitude value (string, number, or any)
 * @param bounds - Optional custom bounds for validation
 * @returns Parsed and validated latitude, or null if invalid
 * 
 * @example
 * ```typescript
 * const lat = safeParseLatitude("37.5");      // 37.5
 * const lat = safeParseLatitude(37.5);        // 37.5
 * const lat = safeParseLatitude("invalid");   // null
 * const lat = safeParseLatitude(NaN);         // null
 * const lat = safeParseLatitude(100);         // null (out of range)
 * ```
 */
export function safeParseLatitude(
  value: unknown,
  bounds: CoordinateBounds = DEFAULT_BOUNDS
): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  let parsed: number;

  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string') {
    parsed = parseFloat(value.trim());
  } else {
    return null;
  }

  // Check for NaN
  if (!Number.isFinite(parsed)) {
    return null;
  }

  // Validate within bounds
  if (parsed < bounds.minLat || parsed > bounds.maxLat) {
    return null;
  }

  // Validate with Zod schema
  const result = latitudeSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

/**
 * Safely parse a longitude value from various input types
 * 
 * @param value - Raw longitude value (string, number, or any)
 * @param bounds - Optional custom bounds for validation
 * @returns Parsed and validated longitude, or null if invalid
 * 
 * @example
 * ```typescript
 * const lng = safeParseLongitude("-122.1");   // -122.1
 * const lng = safeParseLongitude(-122.1);     // -122.1
 * const lng = safeParseLongitude("invalid");  // null
 * const lng = safeParseLongitude(NaN);        // null
 * const lng = safeParseLongitude(200);        // null (out of range)
 * ```
 */
export function safeParseLongitude(
  value: unknown,
  bounds: CoordinateBounds = DEFAULT_BOUNDS
): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  let parsed: number;

  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string') {
    parsed = parseFloat(value.trim());
  } else {
    return null;
  }

  // Check for NaN
  if (!Number.isFinite(parsed)) {
    return null;
  }

  // Validate within bounds
  if (parsed < bounds.minLng || parsed > bounds.maxLng) {
    return null;
  }

  // Validate with Zod schema
  const result = longitudeSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

/**
 * Safely parse a coordinate pair (latitude, longitude)
 * 
 * @param lat - Raw latitude value
 * @param lng - Raw longitude value
 * @param bounds - Optional custom bounds for validation
 * @returns Parse result with success flag and coordinates or error message
 * 
 * @example
 * ```typescript
 * const result = safeParseCoordinates("37.5", "-122.1");
 * if (result.success) {
 *   const { latitude, longitude } = result;
 *   // Use coordinates safely
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function safeParseCoordinates(
  lat: unknown,
  lng: unknown,
  bounds: CoordinateBounds = DEFAULT_BOUNDS
): CoordinateParseResult {
  const latitude = safeParseLatitude(lat, bounds);
  const longitude = safeParseLongitude(lng, bounds);

  if (latitude === null && longitude === null) {
    return {
      success: false,
      error: 'Both latitude and longitude are invalid',
    };
  }

  if (latitude === null) {
    return {
      success: false,
      error: `Invalid latitude value: ${lat}`,
    };
  }

  if (longitude === null) {
    return {
      success: false,
      error: `Invalid longitude value: ${lng}`,
    };
  }

  return {
    success: true,
    latitude,
    longitude,
  };
}

/**
 * Safely parse coordinate array [lng, lat] (GeoJSON format)
 * 
 * @param coordinates - Array in [longitude, latitude] format
 * @param bounds - Optional custom bounds for validation
 * @returns Parse result with success flag and coordinates or error message
 * 
 * @example
 * ```typescript
 * const result = safeParseGeoJSONCoordinates([-122.1, 37.5]);
 * if (result.success) {
 *   const { latitude, longitude } = result;
 * }
 * ```
 */
export function safeParseGeoJSONCoordinates(
  coordinates: unknown,
  bounds: CoordinateBounds = DEFAULT_BOUNDS
): CoordinateParseResult {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return {
      success: false,
      error: 'Coordinates must be an array with at least 2 elements',
    };
  }

  // GeoJSON format: [longitude, latitude]
  return safeParseCoordinates(coordinates[1], coordinates[0], bounds);
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if a value is a valid latitude
 * 
 * @param value - Value to check
 * @param bounds - Optional custom bounds
 * @returns True if value is a valid latitude
 */
export function isValidLatitude(
  value: unknown,
  bounds: CoordinateBounds = DEFAULT_BOUNDS
): boolean {
  return safeParseLatitude(value, bounds) !== null;
}

/**
 * Check if a value is a valid longitude
 * 
 * @param value - Value to check
 * @param bounds - Optional custom bounds
 * @returns True if value is a valid longitude
 */
export function isValidLongitude(
  value: unknown,
  bounds: CoordinateBounds = DEFAULT_BOUNDS
): boolean {
  return safeParseLongitude(value, bounds) !== null;
}

/**
 * Check if a coordinate pair is valid
 * 
 * @param lat - Latitude value
 * @param lng - Longitude value
 * @param bounds - Optional custom bounds
 * @returns True if both coordinates are valid
 */
export function isValidCoordinatePair(
  lat: unknown,
  lng: unknown,
  bounds: CoordinateBounds = DEFAULT_BOUNDS
): boolean {
  return safeParseCoordinates(lat, lng, bounds).success;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Custom error for coordinate parsing failures
 */
export class CoordinateParseError extends Error {
  constructor(
    message: string,
    public readonly latitude?: unknown,
    public readonly longitude?: unknown
  ) {
    super(message);
    this.name = 'CoordinateParseError';
  }
}

/**
 * Parse coordinates or throw an error
 * 
 * @param lat - Raw latitude value
 * @param lng - Raw longitude value
 * @param bounds - Optional custom bounds
 * @throws {CoordinateParseError} If parsing fails
 * @returns Validated coordinate pair
 * 
 * @example
 * ```typescript
 * try {
 *   const { latitude, longitude } = parseCoordinatesOrThrow("37.5", "-122.1");
 * } catch (error) {
 *   if (error instanceof CoordinateParseError) {
 *     console.error('Invalid coordinates:', error.message);
 *   }
 * }
 * ```
 */
export function parseCoordinatesOrThrow(
  lat: unknown,
  lng: unknown,
  bounds: CoordinateBounds = DEFAULT_BOUNDS
): { latitude: number; longitude: number } {
  const result = safeParseCoordinates(lat, lng, bounds);

  if (!result.success) {
    throw new CoordinateParseError(result.error!, lat, lng);
  }

  return {
    latitude: result.latitude!,
    longitude: result.longitude!,
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Parse coordinates with a default fallback
 * 
 * @param lat - Raw latitude value
 * @param lng - Raw longitude value
 * @param defaultLat - Fallback latitude if parsing fails
 * @param defaultLng - Fallback longitude if parsing fails
 * @param bounds - Optional custom bounds
 * @returns Parsed coordinates or default values
 */
export function parseCoordinatesWithDefault(
  lat: unknown,
  lng: unknown,
  defaultLat: number,
  defaultLng: number,
  bounds: CoordinateBounds = DEFAULT_BOUNDS
): { latitude: number; longitude: number } {
  const result = safeParseCoordinates(lat, lng, bounds);

  if (result.success) {
    return {
      latitude: result.latitude!,
      longitude: result.longitude!,
    };
  }

  return {
    latitude: defaultLat,
    longitude: defaultLng,
  };
}

/**
 * Sanitize coordinate value by clamping to valid range
 * 
 * @param value - Raw coordinate value
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value or null if invalid
 */
export function clampCoordinate(
  value: unknown,
  min: number,
  max: number
): number | null {
  let parsed: number;

  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string') {
    parsed = parseFloat(value.trim());
  } else {
    return null;
  }

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(min, Math.min(max, parsed));
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  safeParseLatitude,
  safeParseLongitude,
  safeParseCoordinates,
  safeParseGeoJSONCoordinates,
  isValidLatitude,
  isValidLongitude,
  isValidCoordinatePair,
  parseCoordinatesOrThrow,
  parseCoordinatesWithDefault,
  clampCoordinate,
  CoordinateParseError,
  DEFAULT_BOUNDS,
  BAY_AREA_BOUNDS,
};
