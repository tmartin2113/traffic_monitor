/**
 * Geographic Utility Functions
 * Helper functions for geospatial calculations and operations
 */

import { GEOFENCE } from '@utils/constants';
import { MapCenter, MapBounds } from '@types/map.types';

/**
 * Check if a point is within the geofence
 */
export function isWithinGeofence(lat: number, lng: number): boolean {
  const { xmin, xmax, ymin, ymax } = GEOFENCE.BBOX;
  return lng >= xmin && lng <= xmax && lat >= ymin && lat <= ymax;
}

/**
 * Check if a point is within a polygon using ray casting algorithm
 */
export function isPointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate bearing between two points
 * Returns bearing in degrees (0-360)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);

  return (θ * 180 / Math.PI + 360) % 360;
}

/**
 * Get compass direction from bearing
 */
export function getCompassDirection(bearing: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(bearing / 22.5) % 16;
  return directions[index];
}

/**
 * Calculate the center point of a bounding box
 */
export function getBoundsCenter(bounds: MapBounds): MapCenter {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
}

/**
 * Calculate bounding box for a set of coordinates
 */
export function calculateBounds(coordinates: Array<[number, number]>): MapBounds {
  if (coordinates.length === 0) {
    return {
      north: GEOFENCE.BBOX.ymax,
      south: GEOFENCE.BBOX.ymin,
      east: GEOFENCE.BBOX.xmax,
      west: GEOFENCE.BBOX.xmin,
    };
  }

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  coordinates.forEach(([lng, lat]) => {
    north = Math.max(north, lat);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    west = Math.min(west, lng);
  });

  return { north, south, east, west };
}

/**
 * Add padding to bounds
 */
export function padBounds(bounds: MapBounds, paddingRatio: number = 0.1): MapBounds {
  const latPadding = (bounds.north - bounds.south) * paddingRatio;
  const lngPadding = (bounds.east - bounds.west) * paddingRatio;

  return {
    north: bounds.north + latPadding,
    south: bounds.south - latPadding,
    east: bounds.east + lngPadding,
    west: bounds.west - lngPadding,
  };
}

/**
 * Check if bounds intersect with geofence
 */
export function boundsIntersectGeofence(bounds: MapBounds): boolean {
  const geofence = GEOFENCE.BBOX;
  
  return !(bounds.west > geofence.xmax ||
           bounds.east < geofence.xmin ||
           bounds.south > geofence.ymax ||
           bounds.north < geofence.ymin);
}

/**
 * Convert meters to miles
 */
export function metersToMiles(meters: number): number {
  return meters * 0.000621371;
}

/**
 * Convert meters to kilometers
 */
export function metersToKilometers(meters: number): number {
  return meters / 1000;
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number, units: 'metric' | 'imperial' = 'imperial'): string {
  if (units === 'imperial') {
    const miles = metersToMiles(meters);
    if (miles < 0.1) {
      return `${Math.round(meters * 3.28084)} ft`;
    } else if (miles < 10) {
      return `${miles.toFixed(1)} mi`;
    } else {
      return `${Math.round(miles)} mi`;
    }
  } else {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      const km = metersToKilometers(meters);
      if (km < 10) {
        return `${km.toFixed(1)} km`;
      } else {
        return `${Math.round(km)} km`;
      }
    }
  }
}

/**
 * Get zoom level for a given bounds
 */
export function getZoomLevel(bounds: MapBounds, mapWidth: number, mapHeight: number): number {
  const WORLD_DIM = { height: 256, width: 256 };
  const ZOOM_MAX = 18;

  function latRad(lat: number): number {
    const sin = Math.sin(lat * Math.PI / 180);
    const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
    return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
  }

  function zoom(mapPx: number, worldPx: number, fraction: number): number {
    return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);
  }

  const latFraction = (latRad(bounds.north) - latRad(bounds.south)) / Math.PI;
  const lngDiff = bounds.east - bounds.west;
  const lngFraction = ((lngDiff < 0) ? (lngDiff + 360) : lngDiff) / 360;

  const latZoom = zoom(mapHeight, WORLD_DIM.height, latFraction);
  const lngZoom = zoom(mapWidth, WORLD_DIM.width, lngFraction);

  return Math.min(latZoom, lngZoom, ZOOM_MAX);
}

/**
 * Simplify a polyline using Douglas-Peucker algorithm
 */
export function simplifyPolyline(points: Array<[number, number]>, tolerance: number = 0.0001): Array<[number, number]> {
  if (points.length <= 2) return points;

  function getSquareDistance(p1: [number, number], p2: [number, number]): number {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    return dx * dx + dy * dy;
  }

  function getSquareSegmentDistance(p: [number, number], p1: [number, number], p2: [number, number]): number {
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

  function simplifyDouglasPeucker(points: Array<[number, number]>, sqTolerance: number): Array<[number, number]> {
    const len = points.length;
    const markers = new Uint8Array(len);
    let first = 0;
    let last = len - 1;
    const stack: number[] = [];
    const newPoints: Array<[number, number]> = [];
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
      if (markers[i]) newPoints.push(points[i]);
    }

    return newPoints;
  }

  const sqTolerance = tolerance * tolerance;
  return simplifyDouglasPeucker(points, sqTolerance);
}

/**
 * Get midpoint between two coordinates
 */
export function getMidpoint(lat1: number, lon1: number, lat2: number, lon2: number): MapCenter {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const lon1Rad = lon1 * Math.PI / 180;

  const Bx = Math.cos(lat2Rad) * Math.cos(dLon);
  const By = Math.cos(lat2Rad) * Math.sin(dLon);
  
  const lat3Rad = Math.atan2(
    Math.sin(lat1Rad) + Math.sin(lat2Rad),
    Math.sqrt((Math.cos(lat1Rad) + Bx) ** 2 + By ** 2)
  );
  
  const lon3Rad = lon1Rad + Math.atan2(By, Math.cos(lat1Rad) + Bx);

  return {
    lat: lat3Rad * 180 / Math.PI,
    lng: lon3Rad * 180 / Math.PI,
  };
}

/**
 * Find the nearest point on a polyline to a given point
 */
export function nearestPointOnPolyline(
  point: [number, number],
  polyline: Array<[number, number]>
): { point: [number, number]; distance: number; index: number } {
  let minDistance = Infinity;
  let nearestPoint: [number, number] = polyline[0];
  let nearestIndex = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const start = polyline[i];
    const end = polyline[i + 1];
    
    // Find nearest point on segment
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)));
    
    const nearest: [number, number] = [
      start[0] + t * dx,
      start[1] + t * dy,
    ];
    
    const distance = calculateDistance(point[1], point[0], nearest[1], nearest[0]);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = nearest;
      nearestIndex = i;
    }
  }

  return {
    point: nearestPoint,
    distance: minDistance,
    index: nearestIndex,
  };
}
