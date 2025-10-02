/**
 * @file utils/geoUtils.ts
 * @description Geospatial utility functions with consistent coordinate handling
 * @version 2.0.0
 * 
 * CRITICAL COORDINATE ORDER CONVENTION:
 * ========================================
 * GeoJSON Standard: [longitude, latitude] (X, Y)
 * Leaflet/Map Libraries: [latitude, longitude] (Y, X)
 * 
 * This file uses GEOJSON STANDARD [lng, lat] internally for all coordinates.
 * Conversion functions are provided for Leaflet compatibility.
 */

import { MapCenter, MapBounds } from '@types/map.types';
import { TrafficEvent } from '@types/api.types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * GeoJSON coordinate pair: [longitude, latitude]
 */
export type GeoJSONCoordinate = [number, number];

/**
 * Leaflet coordinate pair: [latitude, longitude]
 */
export type LeafletCoordinate = [number, number];

/**
 * Geography types from 511 API
 */
export interface Geography {
  type: 'Point' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon';
  coordinates: number[] | number[][] | number[][][];
}

// ============================================================================
// COORDINATE CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert GeoJSON coordinates [lng, lat] to Leaflet format [lat, lng]
 */
export function geoJsonToLeaflet(coord: GeoJSONCoordinate): LeafletCoordinate {
  return [coord[1], coord[0]];
}

/**
 * Convert Leaflet coordinates [lat, lng] to GeoJSON format [lng, lat]
 */
export function leafletToGeoJson(coord: LeafletCoordinate): GeoJSONCoordinate {
  return [coord[1], coord[0]];
}

/**
 * Convert GeoJSON coordinates to MapCenter object
 */
export function geoJsonToMapCenter(coord: GeoJSONCoordinate): MapCenter {
  return {
    lng: coord[0],
    lat: coord[1]
  };
}

/**
 * Convert MapCenter to GeoJSON coordinates
 */
export function mapCenterToGeoJson(center: MapCenter): GeoJSONCoordinate {
  return [center.lng, center.lat];
}

/**
 * Convert MapCenter to Leaflet coordinates
 */
export function mapCenterToLeaflet(center: MapCenter): LeafletCoordinate {
  return [center.lat, center.lng];
}

/**
 * Convert Leaflet coordinates to MapCenter
 */
export function leafletToMapCenter(coord: LeafletCoordinate): MapCenter {
  return {
    lat: coord[0],
    lng: coord[1]
  };
}

// ============================================================================
// GEOFENCING FUNCTIONS
// ============================================================================

/**
 * Check if a point is within a bounding box
 * @param point - MapCenter with lat/lng
 * @param bounds - MapBounds object
 */
export function isWithinBounds(point: MapCenter, bounds: MapBounds): boolean {
  return (
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east
  );
}

/**
 * Check if a GeoJSON coordinate is within bounds
 * @param coord - GeoJSON coordinate [lng, lat]
 * @param bounds - MapBounds object
 */
export function isGeoJsonWithinBounds(coord: GeoJSONCoordinate, bounds: MapBounds): boolean {
  const [lng, lat] = coord;
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
}

/**
 * Check if a point is within a geofence (bounding box)
 * @param lat - Latitude
 * @param lng - Longitude
 * @param bounds - MapBounds object
 */
export function isWithinGeofence(lat: number, lng: number, bounds: MapBounds): boolean {
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
}

/**
 * Check if a point is within a polygon using ray casting algorithm
 * @param point - MapCenter with lat/lng
 * @param polygon - Array of MapCenter points forming polygon
 */
export function isPointInPolygon(point: MapCenter, polygon: MapCenter[]): boolean {
  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check if bounds intersect with a geofence
 */
export function boundsIntersectGeofence(bounds: MapBounds, geofence: MapBounds): boolean {
  return !(
    bounds.east < geofence.west ||
    bounds.west > geofence.east ||
    bounds.north < geofence.south ||
    bounds.south > geofence.north
  );
}

// ============================================================================
// DISTANCE CALCULATIONS
// ============================================================================

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 * @param point1 - First point
 * @param point2 - Second point
 */
export function calculateDistance(point1: MapCenter, point2: MapCenter): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate distance from GeoJSON coordinates
 */
export function calculateDistanceGeoJson(
  coord1: GeoJSONCoordinate,
  coord2: GeoJSONCoordinate
): number {
  return calculateDistance(geoJsonToMapCenter(coord1), geoJsonToMapCenter(coord2));
}

/**
 * Calculate bearing between two points
 * Returns bearing in degrees (0-360)
 */
export function calculateBearing(point1: MapCenter, point2: MapCenter): number {
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;

  return (bearing + 360) % 360;
}

/**
 * Get compass direction from bearing
 */
export function getCompassDirection(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

// ============================================================================
// BOUNDS CALCULATIONS
// ============================================================================

/**
 * Calculate bounds from center and radius
 */
export function calculateBoundsFromRadius(
  center: MapCenter,
  radius: number // in meters
): MapBounds {
  const lat = center.lat;
  const lng = center.lng;
  
  // Degrees per meter (approximation)
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos((lat * Math.PI) / 180);
  
  const deltaLat = radius / metersPerDegreeLat;
  const deltaLng = radius / metersPerDegreeLng;
  
  return {
    north: lat + deltaLat,
    south: lat - deltaLat,
    east: lng + deltaLng,
    west: lng - deltaLng,
  };
}

/**
 * Calculate center point from bounds
 */
export function calculateCenterFromBounds(bounds: MapBounds): MapCenter {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
}

/**
 * Calculate bounds from array of points
 */
export function calculateBoundsFromPoints(points: MapCenter[]): MapBounds | null {
  if (points.length === 0) return null;

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  for (const point of points) {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lng);
    west = Math.min(west, point.lng);
  }

  return { north, south, east, west };
}

/**
 * Calculate bounds from GeoJSON coordinates
 */
export function calculateBoundsFromGeoJson(coords: GeoJSONCoordinate[]): MapBounds | null {
  if (coords.length === 0) return null;

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  for (const [lng, lat] of coords) {
    north = Math.max(north, lat);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    west = Math.min(west, lng);
  }

  return { north, south, east, west };
}

/**
 * Extend bounds to include a point
 */
export function extendBounds(bounds: MapBounds, point: MapCenter): MapBounds {
  return {
    north: Math.max(bounds.north, point.lat),
    south: Math.min(bounds.south, point.lat),
    east: Math.max(bounds.east, point.lng),
    west: Math.min(bounds.west, point.lng),
  };
}

/**
 * Check if bounds are valid
 */
export function isValidBounds(bounds: MapBounds): boolean {
  return (
    bounds.north > bounds.south &&
    bounds.east > bounds.west &&
    bounds.north <= 90 &&
    bounds.south >= -90 &&
    bounds.east <= 180 &&
    bounds.west >= -180
  );
}

// ============================================================================
// GEOGRAPHY PROCESSING
// ============================================================================

/**
 * Convert Geography object to coordinate array
 * Returns GeoJSON coordinate order: [lng, lat]
 */
export function geographyToCoordinates(geography: Geography): number[] | number[][] {
  return geography.coordinates as number[] | number[][];
}

/**
 * Extract point coordinates from Geography
 * Returns MapCenter object
 */
export function extractPointFromGeography(geography: Geography): MapCenter | null {
  if (geography.type !== 'Point') {
    return null;
  }
  
  const coords = geography.coordinates as number[];
  return {
    lng: coords[0], // GeoJSON: longitude first
    lat: coords[1]  // GeoJSON: latitude second
  };
}

/**
 * Extract line coordinates from Geography
 * Returns array of MapCenter points
 */
export function extractLineFromGeography(geography: Geography): MapCenter[] | null {
  if (geography.type !== 'LineString') {
    return null;
  }
  
  const coords = geography.coordinates as number[][];
  return coords.map(([lng, lat]) => ({ lng, lat }));
}

/**
 * Extract all coordinates from Geography as MapCenter array
 */
export function extractAllPointsFromGeography(geography: Geography): MapCenter[] {
  const points: MapCenter[] = [];
  
  switch (geography.type) {
    case 'Point':
      const point = extractPointFromGeography(geography);
      if (point) points.push(point);
      break;
      
    case 'LineString':
      const line = extractLineFromGeography(geography);
      if (line) points.push(...line);
      break;
      
    case 'MultiLineString':
      const coords = geography.coordinates as number[][][];
      for (const line of coords) {
        for (const [lng, lat] of line) {
          points.push({ lng, lat });
        }
      }
      break;
      
    case 'Polygon':
      const polyCoords = geography.coordinates as number[][][];
      for (const ring of polyCoords) {
        for (const [lng, lat] of ring) {
          points.push({ lng, lat });
        }
      }
      break;
      
    case 'MultiPolygon':
      const multiPolyCoords = geography.coordinates as number[][][][];
      for (const polygon of multiPolyCoords) {
        for (const ring of polygon) {
          for (const [lng, lat] of ring) {
            points.push({ lng, lat });
          }
        }
      }
      break;
  }
  
  return points;
}

/**
 * Get bounds from Geography object
 */
export function getBoundsFromGeography(geography: Geography): MapBounds | null {
  const points = extractAllPointsFromGeography(geography);
  return calculateBoundsFromPoints(points);
}

// ============================================================================
// COORDINATE FORMATTING
// ============================================================================

/**
 * Format coordinates for display
 */
export function formatCoordinates(
  lat: number,
  lng: number,
  precision = 6
): string {
  const latStr = Math.abs(lat).toFixed(precision);
  const lngStr = Math.abs(lng).toFixed(precision);
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  
  return `${latStr}°${latDir}, ${lngStr}°${lngDir}`;
}

/**
 * Format MapCenter for display
 */
export function formatMapCenter(center: MapCenter, precision = 6): string {
  return formatCoordinates(center.lat, center.lng, precision);
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  
  const km = meters / 1000;
  
  if (km < 10) {
    return `${km.toFixed(1)}km`;
  }
  
  return `${Math.round(km)}km`;
}

// ============================================================================
// MAP UTILITIES
// ============================================================================

/**
 * Calculate zoom level for bounds
 */
export function calculateZoomLevel(
  bounds: MapBounds,
  mapWidth: number,
  mapHeight: number
): number {
  const WORLD_DIM = { height: 256, width: 256 };
  const ZOOM_MAX = 18;

  function latRad(lat: number): number {
    const sin = Math.sin((lat * Math.PI) / 180);
    const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
    return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
  }

  function zoom(mapPx: number, worldPx: number, fraction: number): number {
    return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);
  }

  const latFraction = (latRad(bounds.north) - latRad(bounds.south)) / Math.PI;
  const lngDiff = bounds.east - bounds.west;
  const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

  const latZoom = zoom(mapHeight, WORLD_DIM.height, latFraction);
  const lngZoom = zoom(mapWidth, WORLD_DIM.width, lngFraction);

  return Math.min(latZoom, lngZoom, ZOOM_MAX);
}

/**
 * Simplify coordinate array using Douglas-Peucker algorithm
 * Input coordinates should be in [lng, lat] format (GeoJSON)
 */
export function simplifyCoordinates(
  coordinates: GeoJSONCoordinate[],
  tolerance = 0.0001
): GeoJSONCoordinate[] {
  if (coordinates.length <= 2) return coordinates;

  function getSquareDistance(p1: GeoJSONCoordinate, p2: GeoJSONCoordinate): number {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    return dx * dx + dy * dy;
  }

  function getSquareSegmentDistance(
    p: GeoJSONCoordinate,
    p1: GeoJSONCoordinate,
    p2: GeoJSONCoordinate
  ): number {
    let x = p1[0];
    let y = p1[1];
    let dx = p2[0] - x;
    let dy = p2[1] - y;

    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);

      if (t > 1) {
        x = p2[0];
        y = p2[1];
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }

    dx = p[0] - x;
    dy = p[1] - y;

    return dx * dx + dy * dy;
  }

  function simplifyDouglasPeucker(
    points: GeoJSONCoordinate[],
    sqTolerance: number
  ): GeoJSONCoordinate[] {
    const len = points.length;
    const markers = new Uint8Array(len);
    let first = 0;
    let last = len - 1;
    const stack: number[] = [];
    const newPoints: GeoJSONCoordinate[] = [];
    let i: number;
    let maxSqDist: number;
    let sqDist: number;
    let index: number | undefined;

    markers[first] = markers[last] = 1;

    while (last) {
      maxSqDist = 0;

      for (i = first + 1; i < last; i++) {
        sqDist = getSquareSegmentDistance(points[i], points[first], points[last]);

        if (sqDist > maxSqDist) {
          index = i;
          maxSqDist = sqDist;
        }
      }

      if (maxSqDist > sqTolerance && index !== undefined) {
        markers[index] = 1;
        stack.push(first, index, index, last);
      }

      if (stack.length === 0) break;
      last = stack.pop()!;
      first = stack.pop()!;
    }

    for (i = 0; i < len; i++) {
      if (markers[i]) {
        newPoints.push(points[i]);
      }
    }

    return newPoints;
  }

  return simplifyDouglasPeucker(coordinates, tolerance * tolerance);
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate latitude value
 */
export function isValidLatitude(lat: number): boolean {
  return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validate longitude value
 */
export function isValidLongitude(lng: number): boolean {
  return typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
}

/**
 * Validate coordinate pair
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  return isValidLatitude(lat) && isValidLongitude(lng);
}

/**
 * Validate MapCenter object
 */
export function isValidMapCenter(center: MapCenter): boolean {
  return (
    center !== null &&
    typeof center === 'object' &&
    'lat' in center &&
    'lng' in center &&
    isValidCoordinate(center.lat, center.lng)
  );
}

/**
 * Validate GeoJSON coordinate
 */
export function isValidGeoJsonCoordinate(coord: any): coord is GeoJSONCoordinate {
  return (
    Array.isArray(coord) &&
    coord.length === 2 &&
    isValidLongitude(coord[0]) &&
    isValidLatitude(coord[1])
  );
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  // Conversion
  geoJsonToLeaflet,
  leafletToGeoJson,
  geoJsonToMapCenter,
  mapCenterToGeoJson,
  mapCenterToLeaflet,
  leafletToMapCenter,
  
  // Geofencing
  isWithinBounds,
  isGeoJsonWithinBounds,
  isWithinGeofence,
  isPointInPolygon,
  boundsIntersectGeofence,
  
  // Distance
  calculateDistance,
  calculateDistanceGeoJson,
  calculateBearing,
  getCompassDirection,
  
  // Bounds
  calculateBoundsFromRadius,
  calculateCenterFromBounds,
  calculateBoundsFromPoints,
  calculateBoundsFromGeoJson,
  extendBounds,
  isValidBounds,
  
  // Geography
  geographyToCoordinates,
  extractPointFromGeography,
  extractLineFromGeography,
  extractAllPointsFromGeography,
  getBoundsFromGeography,
  
  // Formatting
  formatCoordinates,
  formatMapCenter,
  formatDistance,
  
  // Map utilities
  calculateZoomLevel,
  simplifyCoordinates,
  
  // Validation
  isValidLatitude,
  isValidLongitude,
  isValidCoordinate,
  isValidMapCenter,
  isValidGeoJsonCoordinate,
};
