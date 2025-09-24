/**
 * Geographic Utility Functions
 * Utilities for coordinate calculations and geofencing
 */

import { GEOFENCE } from './constants';
import type { MapCenter, MapBounds } from '@/types/map.types';
import type { Geography } from '@/types/api.types';

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if coordinates are within geofence
 */
export function isWithinGeofence(lat: number, lng: number): boolean {
  return (
    lat >= GEOFENCE.BBOX.ymin &&
    lat <= GEOFENCE.BBOX.ymax &&
    lng >= GEOFENCE.BBOX.xmin &&
    lng <= GEOFENCE.BBOX.xmax
  );
}

/**
 * Check if point is within bounds
 */
export function isWithinBounds(
  point: MapCenter,
  bounds: MapBounds
): boolean {
  return (
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east
  );
}

/**
 * Check if point is within radius of center
 */
export function isWithinRadius(
  point: MapCenter,
  center: MapCenter,
  radius: number // in meters
): boolean {
  const distance = calculateDistance(
    point.lat,
    point.lng,
    center.lat,
    center.lng
  );
  
  return distance <= radius;
}

/**
 * Calculate bearing between two points
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

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

/**
 * Calculate bounds from center and radius
 */
export function calculateBoundsFromRadius(
  center: MapCenter,
  radius: number // in meters
): MapBounds {
  // Rough approximation
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
 * Extend bounds to include point
 */
export function extendBounds(
  bounds: MapBounds,
  point: MapCenter
): MapBounds {
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

/**
 * Convert geography to coordinates array
 */
export function geographyToCoordinates(geography: Geography): number[] | number[][] {
  if (geography.type === 'Point') {
    return geography.coordinates as number[];
  }
  return geography.coordinates as number[][];
}

/**
 * Get bounds from geography
 */
export function getBoundsFromGeography(geography: Geography): MapBounds | null {
  const coords = geographyToCoordinates(geography);
  
  if (geography.type === 'Point') {
    const [lng, lat] = coords as number[];
    return {
      north: lat,
      south: lat,
      east: lng,
      west: lng,
    };
  }
  
  // For LineString or MultiLineString
  const points: MapCenter[] = [];
  
  if (geography.type === 'LineString') {
    for (const coord of coords as number[][]) {
      points.push({ lat: coord[1], lng: coord[0] });
    }
  } else if (geography.type === 'MultiLineString') {
    for (const line of coords as number[][][]) {
      for (const coord of line) {
        points.push({ lat: coord[1], lng: coord[0] });
      }
    }
  }
  
  return calculateBoundsFromPoints(points);
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(
  lat: number,
  lng: number,
  precision = 6
): string {
  const latStr = lat.toFixed(precision);
  const lngStr = lng.toFixed(precision);
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  
  return `${Math.abs(parseFloat(latStr))}°${latDir}, ${Math.abs(parseFloat(lngStr))}°${lngDir}`;
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

/**
 * Calculate zoom level for bounds
 */
export function calculateZoomLevel(bounds: MapBounds, mapWidth: number, mapHeight: number): number {
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
 * Simplify coordinates array (Douglas-Peucker algorithm)
 */
export function simplifyCoordinates(
  coordinates: number[][],
  tolerance = 0.0001
): number[][] {
  if (coordinates.length <= 2) return coordinates;

  function getSquareDistance(p1: number[], p2: number[]): number {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    return dx * dx + dy * dy;
  }

  function getSquareSegmentDistance(p: number[], p1: number[], p2: number[]): number {
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

  function simplifyDouglasPeucker(points: number[][], sqTolerance: number): number[][] {
    const len = points.length;
    const markers = new Uint8Array(len);
    let first = 0;
    let last = len - 1;
    const stack = [];
    const newPoints = [];
    let i, maxSqDist, sqDist, index;

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

      if (maxSqDist > sqTolerance) {
        markers[index!] = 1;
        stack.push(first, index!, index!, last);
      }

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

  const sqTolerance = tolerance * tolerance;
  return simplifyDouglasPeucker(coordinates, sqTolerance);
}

/**
 * Check if point is inside polygon
 */
export function isPointInPolygon(point: MapCenter, polygon: MapCenter[]): boolean {
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    
    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}
