/**
 * @file utils/coordinateParser.test.ts
 * @description Comprehensive tests for safe coordinate parsing
 * @version 1.0.0
 */

import { describe, it, expect } from 'vitest';
import {
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
} from './coordinateParser';

describe('coordinateParser', () => {
  describe('safeParseLatitude', () => {
    it('should parse valid numeric latitude', () => {
      expect(safeParseLatitude(37.5)).toBe(37.5);
      expect(safeParseLatitude(0)).toBe(0);
      expect(safeParseLatitude(-37.5)).toBe(-37.5);
      expect(safeParseLatitude(90)).toBe(90);
      expect(safeParseLatitude(-90)).toBe(-90);
    });

    it('should parse valid string latitude', () => {
      expect(safeParseLatitude('37.5')).toBe(37.5);
      expect(safeParseLatitude('0')).toBe(0);
      expect(safeParseLatitude('-37.5')).toBe(-37.5);
      expect(safeParseLatitude('  37.5  ')).toBe(37.5); // with whitespace
    });

    it('should return null for NaN', () => {
      expect(safeParseLatitude(NaN)).toBeNull();
      expect(safeParseLatitude('not-a-number')).toBeNull();
      expect(safeParseLatitude('abc')).toBeNull();
    });

    it('should return null for Infinity', () => {
      expect(safeParseLatitude(Infinity)).toBeNull();
      expect(safeParseLatitude(-Infinity)).toBeNull();
    });

    it('should return null for out-of-range values', () => {
      expect(safeParseLatitude(91)).toBeNull();
      expect(safeParseLatitude(-91)).toBeNull();
      expect(safeParseLatitude(100)).toBeNull();
      expect(safeParseLatitude(-100)).toBeNull();
    });

    it('should return null for null/undefined/empty', () => {
      expect(safeParseLatitude(null)).toBeNull();
      expect(safeParseLatitude(undefined)).toBeNull();
      expect(safeParseLatitude('')).toBeNull();
    });

    it('should respect custom bounds', () => {
      expect(safeParseLatitude(37.5, BAY_AREA_BOUNDS)).toBe(37.5);
      expect(safeParseLatitude(40, BAY_AREA_BOUNDS)).toBeNull(); // outside Bay Area
      expect(safeParseLatitude(35, BAY_AREA_BOUNDS)).toBeNull(); // outside Bay Area
    });

    it('should handle edge cases', () => {
      expect(safeParseLatitude('90.0')).toBe(90);
      expect(safeParseLatitude('-90.0')).toBe(-90);
      expect(safeParseLatitude(0.0)).toBe(0);
    });
  });

  describe('safeParseLongitude', () => {
    it('should parse valid numeric longitude', () => {
      expect(safeParseLongitude(-122.1)).toBe(-122.1);
      expect(safeParseLongitude(0)).toBe(0);
      expect(safeParseLongitude(122.1)).toBe(122.1);
      expect(safeParseLongitude(180)).toBe(180);
      expect(safeParseLongitude(-180)).toBe(-180);
    });

    it('should parse valid string longitude', () => {
      expect(safeParseLongitude('-122.1')).toBe(-122.1);
      expect(safeParseLongitude('0')).toBe(0);
      expect(safeParseLongitude('122.1')).toBe(122.1);
      expect(safeParseLongitude('  -122.1  ')).toBe(-122.1); // with whitespace
    });

    it('should return null for NaN', () => {
      expect(safeParseLongitude(NaN)).toBeNull();
      expect(safeParseLongitude('invalid')).toBeNull();
      expect(safeParseLongitude('xyz')).toBeNull();
    });

    it('should return null for Infinity', () => {
      expect(safeParseLongitude(Infinity)).toBeNull();
      expect(safeParseLongitude(-Infinity)).toBeNull();
    });

    it('should return null for out-of-range values', () => {
      expect(safeParseLongitude(181)).toBeNull();
      expect(safeParseLongitude(-181)).toBeNull();
      expect(safeParseLongitude(200)).toBeNull();
      expect(safeParseLongitude(-200)).toBeNull();
    });

    it('should return null for null/undefined/empty', () => {
      expect(safeParseLongitude(null)).toBeNull();
      expect(safeParseLongitude(undefined)).toBeNull();
      expect(safeParseLongitude('')).toBeNull();
    });

    it('should respect custom bounds', () => {
      expect(safeParseLongitude(-122.1, BAY_AREA_BOUNDS)).toBe(-122.1);
      expect(safeParseLongitude(-120, BAY_AREA_BOUNDS)).toBeNull(); // outside Bay Area
      expect(safeParseLongitude(-124, BAY_AREA_BOUNDS)).toBeNull(); // outside Bay Area
    });

    it('should handle edge cases', () => {
      expect(safeParseLongitude('180.0')).toBe(180);
      expect(safeParseLongitude('-180.0')).toBe(-180);
      expect(safeParseLongitude(0.0)).toBe(0);
    });
  });

  describe('safeParseCoordinates', () => {
    it('should parse valid coordinate pairs', () => {
      const result = safeParseCoordinates(37.5, -122.1);
      expect(result.success).toBe(true);
      expect(result.latitude).toBe(37.5);
      expect(result.longitude).toBe(-122.1);
      expect(result.error).toBeUndefined();
    });

    it('should parse valid string coordinate pairs', () => {
      const result = safeParseCoordinates('37.5', '-122.1');
      expect(result.success).toBe(true);
      expect(result.latitude).toBe(37.5);
      expect(result.longitude).toBe(-122.1);
    });

    it('should handle invalid latitude', () => {
      const result = safeParseCoordinates('invalid', -122.1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid latitude');
    });

    it('should handle invalid longitude', () => {
      const result = safeParseCoordinates(37.5, 'invalid');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid longitude');
    });

    it('should handle both invalid', () => {
      const result = safeParseCoordinates('invalid', 'invalid');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Both');
    });

    it('should handle NaN values', () => {
      const result1 = safeParseCoordinates(NaN, -122.1);
      expect(result1.success).toBe(false);

      const result2 = safeParseCoordinates(37.5, NaN);
      expect(result2.success).toBe(false);

      const result3 = safeParseCoordinates(NaN, NaN);
      expect(result3.success).toBe(false);
    });

    it('should respect custom bounds', () => {
      const result1 = safeParseCoordinates(37.5, -122.1, BAY_AREA_BOUNDS);
      expect(result1.success).toBe(true);

      const result2 = safeParseCoordinates(40, -122.1, BAY_AREA_BOUNDS);
      expect(result2.success).toBe(false);
    });
  });

  describe('safeParseGeoJSONCoordinates', () => {
    it('should parse valid GeoJSON coordinates [lng, lat]', () => {
      const result = safeParseGeoJSONCoordinates([-122.1, 37.5]);
      expect(result.success).toBe(true);
      expect(result.latitude).toBe(37.5);
      expect(result.longitude).toBe(-122.1);
    });

    it('should handle invalid array', () => {
      const result1 = safeParseGeoJSONCoordinates('not-an-array');
      expect(result1.success).toBe(false);

      const result2 = safeParseGeoJSONCoordinates([]);
      expect(result2.success).toBe(false);

      const result3 = safeParseGeoJSONCoordinates([37.5]); // only one element
      expect(result3.success).toBe(false);
    });

    it('should handle invalid coordinates in array', () => {
      const result = safeParseGeoJSONCoordinates([NaN, 37.5]);
      expect(result.success).toBe(false);
    });

    it('should handle null/undefined', () => {
      const result1 = safeParseGeoJSONCoordinates(null);
      expect(result1.success).toBe(false);

      const result2 = safeParseGeoJSONCoordinates(undefined);
      expect(result2.success).toBe(false);
    });

    it('should respect custom bounds', () => {
      const result1 = safeParseGeoJSONCoordinates([-122.1, 37.5], BAY_AREA_BOUNDS);
      expect(result1.success).toBe(true);

      const result2 = safeParseGeoJSONCoordinates([-120, 37.5], BAY_AREA_BOUNDS);
      expect(result2.success).toBe(false);
    });
  });

  describe('isValidLatitude', () => {
    it('should return true for valid latitudes', () => {
      expect(isValidLatitude(37.5)).toBe(true);
      expect(isValidLatitude(0)).toBe(true);
      expect(isValidLatitude(-37.5)).toBe(true);
      expect(isValidLatitude(90)).toBe(true);
      expect(isValidLatitude(-90)).toBe(true);
      expect(isValidLatitude('37.5')).toBe(true);
    });

    it('should return false for invalid latitudes', () => {
      expect(isValidLatitude(NaN)).toBe(false);
      expect(isValidLatitude('invalid')).toBe(false);
      expect(isValidLatitude(91)).toBe(false);
      expect(isValidLatitude(-91)).toBe(false);
      expect(isValidLatitude(null)).toBe(false);
    });
  });

  describe('isValidLongitude', () => {
    it('should return true for valid longitudes', () => {
      expect(isValidLongitude(-122.1)).toBe(true);
      expect(isValidLongitude(0)).toBe(true);
      expect(isValidLongitude(122.1)).toBe(true);
      expect(isValidLongitude(180)).toBe(true);
      expect(isValidLongitude(-180)).toBe(true);
      expect(isValidLongitude('-122.1')).toBe(true);
    });

    it('should return false for invalid longitudes', () => {
      expect(isValidLongitude(NaN)).toBe(false);
      expect(isValidLongitude('invalid')).toBe(false);
      expect(isValidLongitude(181)).toBe(false);
      expect(isValidLongitude(-181)).toBe(false);
      expect(isValidLongitude(null)).toBe(false);
    });
  });

  describe('isValidCoordinatePair', () => {
    it('should return true for valid pairs', () => {
      expect(isValidCoordinatePair(37.5, -122.1)).toBe(true);
      expect(isValidCoordinatePair('37.5', '-122.1')).toBe(true);
      expect(isValidCoordinatePair(0, 0)).toBe(true);
    });

    it('should return false for invalid pairs', () => {
      expect(isValidCoordinatePair(NaN, -122.1)).toBe(false);
      expect(isValidCoordinatePair(37.5, NaN)).toBe(false);
      expect(isValidCoordinatePair('invalid', -122.1)).toBe(false);
      expect(isValidCoordinatePair(37.5, 'invalid')).toBe(false);
      expect(isValidCoordinatePair(91, -122.1)).toBe(false);
      expect(isValidCoordinatePair(37.5, 181)).toBe(false);
    });
  });

  describe('parseCoordinatesOrThrow', () => {
    it('should return valid coordinates', () => {
      const result = parseCoordinatesOrThrow(37.5, -122.1);
      expect(result.latitude).toBe(37.5);
      expect(result.longitude).toBe(-122.1);
    });

    it('should throw CoordinateParseError for invalid coordinates', () => {
      expect(() => parseCoordinatesOrThrow('invalid', -122.1)).toThrow(CoordinateParseError);
      expect(() => parseCoordinatesOrThrow(37.5, 'invalid')).toThrow(CoordinateParseError);
      expect(() => parseCoordinatesOrThrow(NaN, NaN)).toThrow(CoordinateParseError);
    });

    it('should throw with correct error properties', () => {
      try {
        parseCoordinatesOrThrow('bad-lat', 'bad-lng');
      } catch (error) {
        expect(error).toBeInstanceOf(CoordinateParseError);
        expect((error as CoordinateParseError).latitude).toBe('bad-lat');
        expect((error as CoordinateParseError).longitude).toBe('bad-lng');
        expect((error as CoordinateParseError).message).toContain('Both');
      }
    });
  });

  describe('parseCoordinatesWithDefault', () => {
    it('should return parsed coordinates when valid', () => {
      const result = parseCoordinatesWithDefault(37.5, -122.1, 0, 0);
      expect(result.latitude).toBe(37.5);
      expect(result.longitude).toBe(-122.1);
    });

    it('should return defaults for invalid coordinates', () => {
      const result = parseCoordinatesWithDefault('invalid', 'invalid', 10, 20);
      expect(result.latitude).toBe(10);
      expect(result.longitude).toBe(20);
    });

    it('should return defaults for NaN', () => {
      const result = parseCoordinatesWithDefault(NaN, NaN, 0, 0);
      expect(result.latitude).toBe(0);
      expect(result.longitude).toBe(0);
    });

    it('should return defaults for out-of-range', () => {
      const result = parseCoordinatesWithDefault(100, 200, 0, 0);
      expect(result.latitude).toBe(0);
      expect(result.longitude).toBe(0);
    });
  });

  describe('clampCoordinate', () => {
    it('should return value within range', () => {
      expect(clampCoordinate(50, 0, 100)).toBe(50);
      expect(clampCoordinate('50', 0, 100)).toBe(50);
    });

    it('should clamp to min', () => {
      expect(clampCoordinate(-10, 0, 100)).toBe(0);
      expect(clampCoordinate('-10', 0, 100)).toBe(0);
    });

    it('should clamp to max', () => {
      expect(clampCoordinate(110, 0, 100)).toBe(100);
      expect(clampCoordinate('110', 0, 100)).toBe(100);
    });

    it('should return null for NaN', () => {
      expect(clampCoordinate(NaN, 0, 100)).toBeNull();
      expect(clampCoordinate('invalid', 0, 100)).toBeNull();
    });

    it('should return null for Infinity', () => {
      expect(clampCoordinate(Infinity, 0, 100)).toBeNull();
      expect(clampCoordinate(-Infinity, 0, 100)).toBeNull();
    });

    it('should return null for null/undefined', () => {
      expect(clampCoordinate(null, 0, 100)).toBeNull();
      expect(clampCoordinate(undefined, 0, 100)).toBeNull();
    });
  });

  describe('Edge Cases and Real-World Scenarios', () => {
    it('should handle parseFloat edge cases', () => {
      // These used to cause NaN in the old code
      expect(safeParseLatitude('37.5.6')).toBeNull(); // Multiple decimals
      expect(safeParseLatitude('37e10')).toBeNull(); // Scientific notation (out of range)
      expect(safeParseLatitude('37,5')).toBeNull(); // Comma instead of period
    });

    it('should handle whitespace variations', () => {
      expect(safeParseLatitude('  37.5  ')).toBe(37.5);
      expect(safeParseLatitude('\t37.5\n')).toBe(37.5);
      expect(safeParseLatitude('\r\n37.5\r\n')).toBe(37.5);
    });

    it('should handle zero and near-zero values', () => {
      expect(safeParseLatitude(0)).toBe(0);
      expect(safeParseLatitude(-0)).toBe(0);
      expect(safeParseLatitude('0')).toBe(0);
      expect(safeParseLatitude(0.0000001)).toBe(0.0000001);
    });

    it('should handle extreme precision', () => {
      const lat = 37.12345678901234;
      expect(safeParseLatitude(lat)).toBe(lat);
      expect(safeParseLatitude(lat.toString())).toBe(lat);
    });

    it('should handle Bay Area specific coordinates', () => {
      // San Francisco
      const sf = safeParseCoordinates(37.7749, -122.4194, BAY_AREA_BOUNDS);
      expect(sf.success).toBe(true);

      // Oakland
      const oak = safeParseCoordinates(37.8044, -122.2712, BAY_AREA_BOUNDS);
      expect(oak.success).toBe(true);

      // San Jose
      const sj = safeParseCoordinates(37.3382, -121.8863, BAY_AREA_BOUNDS);
      expect(sj.success).toBe(true);

      // Los Angeles (outside Bay Area)
      const la = safeParseCoordinates(34.0522, -118.2437, BAY_AREA_BOUNDS);
      expect(la.success).toBe(false);
    });
  });
});
