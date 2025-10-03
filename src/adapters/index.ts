/**
 * @file adapters/index.ts
 * @description Data adapters for multiple traffic data sources with safe coordinate parsing
 * @version 2.0.0
 * 
 * FIXES BUG #14: Now uses safe coordinate parsing to handle NaN values
 */

import { TrafficEvent, EventType, EventSeverity, Geometry } from '@types/api.types';
import { logger } from '@utils/logger';
import {
  safeParseCoordinates,
  safeParseGeoJSONCoordinates,
  parseCoordinatesOrThrow,
  CoordinateParseError,
  BAY_AREA_BOUNDS,
} from '@utils/coordinateParser';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Event adapter function signature
 */
export type EventAdapter = (raw: unknown) => TrafficEvent;

/**
 * Custom error for data provider issues
 */
export class DataProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'DataProviderError';
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safely convert any value to string
 */
function safeString(value: unknown, defaultValue = ''): string {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  return String(value);
}

/**
 * Safely parse date with fallback to current time
 */
function safeDate(value: unknown): Date {
  if (!value) {
    return new Date();
  }

  const date = new Date(value as string);
  return isNaN(date.getTime()) ? new Date() : date;
}

/**
 * Validate GeoJSON geometry structure
 */
function validateGeometry(geometry: unknown): geometry is Geometry {
  if (!geometry || typeof geometry !== 'object') {
    return false;
  }

  const geo = geometry as any;
  return (
    typeof geo.type === 'string' &&
    Array.isArray(geo.coordinates) &&
    geo.coordinates.length > 0
  );
}

/**
 * Create GeoJSON Point geometry from lat/lng with validation
 */
function createPointGeometry(lat: unknown, lng: unknown): Geometry {
  const result = safeParseCoordinates(lat, lng, BAY_AREA_BOUNDS);

  if (!result.success) {
    throw new CoordinateParseError(
      `Failed to create Point geometry: ${result.error}`,
      lat,
      lng
    );
  }

  return {
    type: 'Point',
    coordinates: [result.longitude!, result.latitude!], // GeoJSON: [lng, lat]
  };
}

/**
 * Map generic event type string to EventType enum
 */
function mapEventType(rawType: string, provider: string): EventType {
  const normalized = rawType.toLowerCase().trim();

  if (normalized.includes('construction') || normalized.includes('roadwork')) {
    return EventType.CONSTRUCTION;
  }
  if (normalized.includes('incident') || normalized.includes('accident')) {
    return EventType.INCIDENT;
  }
  if (normalized.includes('special') || normalized.includes('event')) {
    return EventType.SPECIAL_EVENT;
  }
  if (normalized.includes('road') || normalized.includes('condition')) {
    return EventType.ROAD_CONDITION;
  }
  if (normalized.includes('weather')) {
    return EventType.WEATHER_CONDITION;
  }

  logger.warn(`Unknown event type "${rawType}" from ${provider}, defaulting to INCIDENT`);
  return EventType.INCIDENT;
}

/**
 * Map generic severity string to EventSeverity enum
 */
function mapSeverity(rawSeverity: unknown): EventSeverity {
  if (!rawSeverity) {
    return EventSeverity.UNKNOWN;
  }

  const normalized = String(rawSeverity).toLowerCase().trim();

  if (normalized.includes('block') || normalized.includes('closed') || normalized.includes('severe')) {
    return EventSeverity.BLOCKING;
  }
  if (normalized.includes('major') || normalized.includes('high')) {
    return EventSeverity.MAJOR;
  }
  if (normalized.includes('moderate') || normalized.includes('medium')) {
    return EventSeverity.MODERATE;
  }
  if (normalized.includes('minor') || normalized.includes('low')) {
    return EventSeverity.MINOR;
  }

  return EventSeverity.UNKNOWN;
}

// ============================================================================
// ADAPTER: Bay Area 511
// ============================================================================

/**
 * Adapter for Bay Area 511 traffic events
 */
export const adaptBayArea511: EventAdapter = (raw: unknown): TrafficEvent => {
  try {
    const data = raw as any;

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid raw data: expected object');
    }

    // Extract and validate geometry
    let geometry: Geometry;

    if (validateGeometry(data.geography)) {
      // Validate coordinates in the geography object
      const geo = data.geography;
      if (geo.type === 'Point') {
        const coordResult = safeParseGeoJSONCoordinates(geo.coordinates, BAY_AREA_BOUNDS);
        if (!coordResult.success) {
          throw new CoordinateParseError(
            `Invalid coordinates in geography: ${coordResult.error}`,
            geo.coordinates
          );
        }
        geometry = {
          type: 'Point',
          coordinates: [coordResult.longitude!, coordResult.latitude!],
        };
      } else {
        // For non-Point types, assume coordinates are pre-validated
        geometry = geo;
      }
    } else {
      throw new Error('Missing or invalid geography field');
    }

    const event: TrafficEvent = {
      id: safeString(data.id),
      headline: safeString(data.headline),
      eventType: mapEventType(safeString(data.event_type), 'Bay Area 511'),
      severity: mapSeverity(data.severity),
      geometry,
      source: 'Bay Area 511',
      description: safeString(data.description),
      updated: safeDate(data.updated),
      rawData: data,
    };

    // Optional fields
    if (data.created) {
      event.startTime = safeDate(data.created);
    }

    if (Array.isArray(data.roads) && data.roads.length > 0) {
      event.roads = data.roads
        .map((road: any) => safeString(road.name || road))
        .filter(Boolean);
    }

    logger.debug('Successfully adapted Bay Area 511 event', { id: event.id });

    return event;
  } catch (error) {
    if (error instanceof CoordinateParseError) {
      logger.error('Bay Area 511 coordinate parsing failed', {
        lat: error.latitude,
        lng: error.longitude,
        error: error.message,
      });
    }

    throw new DataProviderError(
      `Failed to adapt Bay Area 511 data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'Bay Area 511',
      error
    );
  }
};

// ============================================================================
// ADAPTER: NYC DOT
// ============================================================================

/**
 * Adapter for NYC DOT traffic data
 */
export const adaptNYCDOT: EventAdapter = (raw: unknown): TrafficEvent => {
  try {
    const data = raw as any;

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid raw data: expected object');
    }

    // NYC DOT uses separate lat/lng fields - parse safely
    const geometry = createPointGeometry(data.latitude, data.longitude);

    const event: TrafficEvent = {
      id: safeString(data.unique_key || data.id),
      headline: safeString(data.descriptor || data.complaint_type),
      eventType: mapEventType(safeString(data.complaint_type), 'NYC DOT'),
      severity: mapSeverity(data.status),
      geometry,
      source: 'NYC DOT',
      description: safeString(data.resolution_description),
      updated: safeDate(data.closed_date || data.created_date),
      rawData: data,
    };

    if (data.created_date) {
      event.startTime = safeDate(data.created_date);
    }

    if (data.location && typeof data.location === 'object') {
      const address = safeString(data.location.street_name || data.location.address);
      if (address) {
        event.roads = [address];
      }
    }

    logger.debug('Successfully adapted NYC DOT event', { id: event.id });

    return event;
  } catch (error) {
    if (error instanceof CoordinateParseError) {
      logger.error('NYC DOT coordinate parsing failed', {
        lat: error.latitude,
        lng: error.longitude,
        error: error.message,
      });
    }

    throw new DataProviderError(
      `Failed to adapt NYC DOT data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NYC DOT',
      error
    );
  }
};

// ============================================================================
// ADAPTER: TxDOT (Texas)
// ============================================================================

/**
 * Adapter for Texas DOT traffic data
 */
export const adaptTxDOT: EventAdapter = (raw: unknown): TrafficEvent => {
  try {
    const data = raw as any;

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid raw data: expected object');
    }

    // TxDOT uses lat/lon fields - parse safely
    const geometry = createPointGeometry(data.lat, data.lon);

    const event: TrafficEvent = {
      id: safeString(data.incident_id || data.id),
      headline: safeString(data.title || data.description),
      eventType: mapEventType(safeString(data.type), 'TxDOT'),
      severity: mapSeverity(data.severity),
      geometry,
      source: 'TxDOT',
      description: safeString(data.long_description || data.details),
      updated: safeDate(data.last_update_time),
      rawData: data,
    };

    if (data.start_time) {
      event.startTime = safeDate(data.start_time);
    }

    if (data.end_time) {
      event.endTime = safeDate(data.end_time);
    }

    if (data.primary_road) {
      event.roads = [safeString(data.primary_road)];
    }

    logger.debug('Successfully adapted TxDOT event', { id: event.id });

    return event;
  } catch (error) {
    if (error instanceof CoordinateParseError) {
      logger.error('TxDOT coordinate parsing failed', {
        lat: error.latitude,
        lng: error.longitude,
        error: error.message,
      });
    }

    throw new DataProviderError(
      `Failed to adapt TxDOT data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'TxDOT',
      error
    );
  }
};

// ============================================================================
// ADAPTER: Generic (Fallback)
// ============================================================================

/**
 * Generic adapter for unknown/new data sources
 * Attempts to map common field patterns with safe coordinate parsing
 */
export const adaptGeneric: EventAdapter = (raw: unknown): TrafficEvent => {
  try {
    const data = raw as any;

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid raw data: expected object');
    }

    // Common field patterns for ID
    const id =
      data.id ||
      data.event_id ||
      data.incident_id ||
      data.ID ||
      data.eventId ||
      data.incidentId ||
      data.uuid ||
      data.guid;

    if (!id) {
      throw new Error('Could not find identifier field');
    }

    // Common field patterns for headline/title
    const headline =
      data.headline ||
      data.title ||
      data.name ||
      data.description ||
      data.summary ||
      data.event_description ||
      'Traffic Event';

    // Try to find geometry with safe parsing
    let geometry: Geometry;

    if (validateGeometry(data.geometry)) {
      geometry = data.geometry;
    } else if (validateGeometry(data.location)) {
      geometry = data.location;
    } else if (data.coordinates && Array.isArray(data.coordinates)) {
      // Validate array coordinates
      const coordResult = safeParseGeoJSONCoordinates(data.coordinates);
      if (!coordResult.success) {
        throw new CoordinateParseError(
          `Invalid array coordinates: ${coordResult.error}`,
          data.coordinates
        );
      }
      geometry = {
        type: 'Point',
        coordinates: [coordResult.longitude!, coordResult.latitude!],
      };
    } else if (data.lat !== undefined && data.lon !== undefined) {
      // lat/lon fields - parse safely
      geometry = createPointGeometry(data.lat, data.lon);
    } else if (data.latitude !== undefined && data.longitude !== undefined) {
      // latitude/longitude fields - parse safely
      geometry = createPointGeometry(data.latitude, data.longitude);
    } else {
      throw new Error('Could not find valid geometry data');
    }

    // Try to determine event type from various fields
    const eventTypeRaw =
      data.type ||
      data.event_type ||
      data.category ||
      data.incident_type ||
      data.eventType ||
      'other';

    const event: TrafficEvent = {
      id: safeString(id),
      headline: safeString(headline),
      eventType: mapEventType(safeString(eventTypeRaw), 'Generic'),
      severity: mapSeverity(data.severity || data.impact || data.priority),
      geometry,
      source: 'Generic',
      description: safeString(data.details || data.full_description || data.comments),
      updated: safeDate(data.updated || data.last_updated || data.modified),
      rawData: data,
    };

    // Try to find time fields
    event.startTime = safeDate(data.start_time || data.start_date || data.begin_time);
    event.endTime = safeDate(data.end_time || data.end_date || data.finish_time);

    // Try to find road information
    if (data.road || data.street || data.highway) {
      event.roads = [safeString(data.road || data.street || data.highway)];
    } else if (Array.isArray(data.roads || data.streets || data.affected_roads)) {
      event.roads = (data.roads || data.streets || data.affected_roads)
        .map((r: any) => safeString(r))
        .filter(Boolean);
    }

    logger.info('Successfully adapted data using generic adapter', { id: event.id });

    return event;
  } catch (error) {
    if (error instanceof CoordinateParseError) {
      logger.error('Generic adapter coordinate parsing failed', {
        lat: error.latitude,
        lng: error.longitude,
        error: error.message,
      });
    }

    throw new DataProviderError(
      `Failed to adapt generic data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'Generic',
      error
    );
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Export all adapters
 */
export const adapters = {
  bayArea511: adaptBayArea511,
  nycDot: adaptNYCDOT,
  txDot: adaptTxDOT,
  generic: adaptGeneric,
} as const;

/**
 * Get adapter by provider name
 */
export function getAdapter(provider: string): EventAdapter {
  const normalized = provider.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normalized.includes('511') || normalized.includes('bayarea')) {
    return adaptBayArea511;
  }
  if (normalized.includes('nyc') || normalized.includes('newyork')) {
    return adaptNYCDOT;
  }
  if (normalized.includes('texas') || normalized.includes('txdot')) {
    return adaptTxDOT;
  }

  return adaptGeneric;
}
