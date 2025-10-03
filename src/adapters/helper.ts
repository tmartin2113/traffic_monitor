/**
 * @file adapters/helpers.ts
 * @description Safe helper utilities for adapter implementations
 * @version 1.0.0
 */

import { parseLatitude, parseLongitude, parseCoordinatePair } from '@/utils/coordinateParser';
import type { Geometry } from '@/types/api.types';

/**
 * Safe parse geometry from various formats
 */
export function safeParseGeometry(data: any): Geometry | null {
  // Already valid GeoJSON geometry
  if (data?.type && data?.coordinates) {
    const validated = validateGeometryCoordinates(data);
    return validated ? data : null;
  }

  // Parse from lat/lng fields
  if (data?.latitude !== undefined && data?.longitude !== undefined) {
    return parsePointFromLatLng(data.latitude, data.longitude);
  }

  // Parse from lat/lon fields
  if (data?.lat !== undefined && data?.lon !== undefined) {
    return parsePointFromLatLng(data.lat, data.lon);
  }

  // Parse from coordinates array
  if (Array.isArray(data?.coordinates) && data.coordinates.length >= 2) {
    return parsePointFromArray(data.coordinates);
  }

  return null;
}

/**
 * Parse Point geometry from lat/lng values
 */
export function parsePointFromLatLng(lat: any, lng: any): Geometry | null {
  const parsed = parseCoordinatePair(lat, lng);
  
  if (!parsed.isValid) {
    console.warn(`Invalid coordinates: ${parsed.error}`);
    return null;
  }

  return {
    type: 'Point',
    coordinates: [parsed.longitude, parsed.latitude]
  };
}

/**
 * Parse Point geometry from coordinate array [lng, lat] or [lat, lng]
 */
export function parsePointFromArray(coords: number[], geoJsonOrder = true): Geometry | null {
  if (!Array.isArray(coords) || coords.length < 2) {
    return null;
  }

  const lat = geoJsonOrder ? coords[1] : coords[0];
  const lng = geoJsonOrder ? coords[0] : coords[1];

  return parsePointFromLatLng(lat, lng);
}

/**
 * Validate geometry coordinates recursively
 */
export function validateGeometryCoordinates(geometry: Geometry): boolean {
  if (!geometry || !geometry.type || !geometry.coordinates) {
    return false;
  }

  switch (geometry.type) {
    case 'Point':
      return validatePointCoordinates(geometry.coordinates as number[]);
    
    case 'LineString':
    case 'MultiPoint':
      return validateLineCoordinates(geometry.coordinates as number[][]);
    
    case 'Polygon':
    case 'MultiLineString':
      return validatePolygonCoordinates(geometry.coordinates as number[][][]);
    
    case 'MultiPolygon':
      return validateMultiPolygonCoordinates(geometry.coordinates as number[][][][]);
    
    default:
      return false;
  }
}

/**
 * Validate Point coordinates [lng, lat]
 */
function validatePointCoordinates(coords: number[]): boolean {
  if (!Array.isArray(coords) || coords.length < 2) {
    return false;
  }

  const lng = parseLongitude(coords[0]);
  const lat = parseLatitude(coords[1]);

  return lng.isValid && lat.isValid;
}

/**
 * Validate LineString coordinates [[lng, lat], ...]
 */
function validateLineCoordinates(coords: number[][]): boolean {
  if (!Array.isArray(coords) || coords.length < 2) {
    return false;
  }

  return coords.every(point => validatePointCoordinates(point));
}

/**
 * Validate Polygon coordinates [[[lng, lat], ...], ...]
 */
function validatePolygonCoordinates(coords: number[][][]): boolean {
  if (!Array.isArray(coords) || coords.length === 0) {
    return false;
  }

  return coords.every(ring => validateLineCoordinates(ring));
}

/**
 * Validate MultiPolygon coordinates [[[[lng, lat], ...], ...], ...]
 */
function validateMultiPolygonCoordinates(coords: number[][][][]): boolean {
  if (!Array.isArray(coords) || coords.length === 0) {
    return false;
  }

  return coords.every(polygon => validatePolygonCoordinates(polygon));
}

/**
 * Safe parse number (for lanes, counts, etc.)
 */
export function safeParseNumber(value: any, defaultValue?: number): number | undefined {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = typeof value === 'number' ? value : parseFloat(String(value));

  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safe parse integer
 */
export function safeParseInt(value: any, defaultValue?: number): number | undefined {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = typeof value === 'number' ? Math.floor(value) : parseInt(String(value), 10);

  return isNaN(parsed) ? defaultValue : parsed;
}
