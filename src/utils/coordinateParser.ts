/**
 * @file utils/coordinateParser.ts
 * @description Safe coordinate parsing with NaN validation
 * @version 1.0.0
 */

/**
 * Coordinate parsing result
 */
export interface ParsedCoordinate {
  value: number;
  isValid: boolean;
  error?: string;
}

/**
 * Coordinate pair parsing result
 */
export interface ParsedCoordinatePair {
  latitude: number;
  longitude: number;
  isValid: boolean;
  error?: string;
}

/**
 * Safe parse latitude with validation
 */
export function parseLatitude(value: any): ParsedCoordinate {
  if (value === null || value === undefined) {
    return { value: 0, isValid: false, error: 'Latitude is null or undefined' };
  }

  const parsed = typeof value === 'number' ? value : parseFloat(String(value));

  if (isNaN(parsed)) {
    return { value: 0, isValid: false, error: `Invalid latitude: "${value}"` };
  }

  if (parsed < -90 || parsed > 90) {
    return { value: 0, isValid: false, error: `Latitude out of range: ${parsed}` };
  }

  return { value: parsed, isValid: true };
}

/**
 * Safe parse longitude with validation
 */
export function parseLongitude(value: any): ParsedCoordinate {
  if (value === null || value === undefined) {
    return { value: 0, isValid: false, error: 'Longitude is null or undefined' };
  }

  const parsed = typeof value === 'number' ? value : parseFloat(String(value));

  if (isNaN(parsed)) {
    return { value: 0, isValid: false, error: `Invalid longitude: "${value}"` };
  }

  if (parsed < -180 || parsed > 180) {
    return { value: 0, isValid: false, error: `Longitude out of range: ${parsed}` };
  }

  return { value: parsed, isValid: true };
}

/**
 * Safe parse coordinate pair (lat, lng)
 */
export function parseCoordinatePair(
  lat: any,
  lng: any
): ParsedCoordinatePair {
  const parsedLat = parseLatitude(lat);
  const parsedLng = parseLongitude(lng);

  if (!parsedLat.isValid || !parsedLng.isValid) {
    return {
      latitude: 0,
      longitude: 0,
      isValid: false,
      error: `${parsedLat.error || ''} ${parsedLng.error || ''}`.trim()
    };
  }

  return {
    latitude: parsedLat.value,
    longitude: parsedLng.value,
    isValid: true
  };
}

/**
 * Safe parse GeoJSON coordinate [lng, lat]
 */
export function parseGeoJsonCoordinate(
  coords: any
): ParsedCoordinatePair | null {
  if (!Array.isArray(coords) || coords.length < 2) {
    return null;
  }

  return parseCoordinatePair(coords[1], coords[0]);
}

/**
 * Validate and normalize coordinate array
 */
export function validateCoordinateArray(coords: any): number[] | null {
  if (!Array.isArray(coords)) return null;

  const validated: number[] = [];
  
  for (let i = 0; i < coords.length; i += 2) {
    const lng = parseLongitude(coords[i]);
    const lat = parseLatitude(coords[i + 1]);

    if (!lng.isValid || !lat.isValid) {
      console.warn(`Invalid coordinate pair at index ${i}: [${coords[i]}, ${coords[i + 1]}]`);
      continue;
    }

    validated.push(lng.value, lat.value);
  }

  return validated.length > 0 ? validated : null;
}
