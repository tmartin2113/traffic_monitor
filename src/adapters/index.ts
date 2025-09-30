/**
 * @file adapters/index.ts
 * @description Adapter implementations for various traffic data APIs
 * @version 1.0.0
 */

import {
  TrafficEvent,
  EventType,
  EventSeverity,
  EventAdapter,
  DataProviderError
} from '../types/TrafficEvent';
import { Geometry } from 'geojson';

/**
 * Logger interface for production environments
 */
interface Logger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, error?: unknown) => void;
}

/**
 * Production-ready logger implementation
 */
const logger: Logger = {
  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[ADAPTER] ${message}`, data);
    }
  },
  info: (message: string, data?: unknown) => {
    console.info(`[ADAPTER] ${message}`, data);
  },
  warn: (message: string, data?: unknown) => {
    console.warn(`[ADAPTER] ${message}`, data);
  },
  error: (message: string, error?: unknown) => {
    console.error(`[ADAPTER] ${message}`, error);
  }
};

/**
 * Utility function to safely extract string value
 */
const safeString = (value: unknown, defaultValue = ''): string => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return defaultValue;
  return String(value);
};

/**
 * Utility function to safely parse ISO date strings
 */
const safeDate = (value: unknown): string | undefined => {
  if (!value) return undefined;
  try {
    const date = new Date(String(value));
    return isNaN(date.getTime()) ? undefined : date.toISOString();
  } catch {
    return undefined;
  }
};

/**
 * Map raw event type strings to standardized EventType enum
 */
const mapEventType = (rawType: string, source: string): EventType => {
  const normalized = rawType.toLowerCase().replace(/[_\s-]/g, '');
  
  const typeMap: Record<string, EventType> = {
    accident: EventType.ACCIDENT,
    collision: EventType.ACCIDENT,
    crash: EventType.ACCIDENT,
    construction: EventType.CONSTRUCTION,
    roadwork: EventType.CONSTRUCTION,
    maintenance: EventType.CONSTRUCTION,
    closure: EventType.ROAD_CLOSURE,
    roadclosure: EventType.ROAD_CLOSURE,
    laneclosure: EventType.LANE_CLOSURE,
    specialevent: EventType.SPECIAL_EVENT,
    event: EventType.SPECIAL_EVENT,
    weather: EventType.WEATHER,
    snow: EventType.WEATHER,
    ice: EventType.WEATHER,
    flood: EventType.WEATHER,
    congestion: EventType.TRAFFIC_CONGESTION,
    traffic: EventType.TRAFFIC_CONGESTION,
    hazard: EventType.HAZARD,
    debris: EventType.HAZARD,
    obstruction: EventType.HAZARD
  };
  
  const mappedType = typeMap[normalized];
  if (!mappedType) {
    logger.debug(`Unknown event type '${rawType}' from ${source}, defaulting to OTHER`);
    return EventType.OTHER;
  }
  
  return mappedType;
};

/**
 * Map severity strings to standardized EventSeverity enum
 */
const mapSeverity = (rawSeverity: unknown): EventSeverity => {
  if (!rawSeverity) return EventSeverity.UNKNOWN;
  
  const normalized = String(rawSeverity).toLowerCase();
  
  const severityMap: Record<string, EventSeverity> = {
    critical: EventSeverity.CRITICAL,
    severe: EventSeverity.CRITICAL,
    high: EventSeverity.MAJOR,
    major: EventSeverity.MAJOR,
    medium: EventSeverity.MODERATE,
    moderate: EventSeverity.MODERATE,
    low: EventSeverity.MINOR,
    minor: EventSeverity.MINOR,
    minimal: EventSeverity.MINOR
  };
  
  return severityMap[normalized] || EventSeverity.UNKNOWN;
};

/**
 * Validate GeoJSON geometry
 */
const validateGeometry = (geometry: unknown): geometry is Geometry => {
  if (!geometry || typeof geometry !== 'object') return false;
  const geo = geometry as any;
  return geo.type && (geo.coordinates || geo.geometries);
};

/**
 * Bay Area 511 API Adapter
 */
export const adaptBayArea511: EventAdapter = (raw: unknown): TrafficEvent => {
  try {
    const data = raw as any;
    
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid raw data: expected object');
    }
    
    if (!data.id) {
      throw new Error('Missing required field: id');
    }
    
    // Determine which geometry to use
    let geometry = data.closure_geography || data.geography;
    if (!validateGeometry(geometry)) {
      throw new Error('Invalid or missing geometry data');
    }
    
    const event: TrafficEvent = {
      id: safeString(data.id),
      headline: safeString(data.headline, 'Traffic Incident'),
      eventType: mapEventType(safeString(data.event_type, 'other'), 'BayArea511'),
      severity: mapSeverity(data.severity),
      geometry: geometry as Geometry,
      source: 'BayArea511',
      description: safeString(data.description),
      direction: safeString(data.direction),
      updated: safeDate(data.updated),
      rawData: data
    };
    
    // Extract roads if available
    if (Array.isArray(data.roads)) {
      event.roads = data.roads
        .filter((r: any) => r && typeof r === 'object' && r.name)
        .map((r: any) => safeString(r.name));
    }
    
    // Extract schedule information
    if (Array.isArray(data.schedules) && data.schedules.length > 0) {
      const schedule = data.schedules[0];
      event.startTime = safeDate(schedule.start_date);
      event.endTime = safeDate(schedule.end_date);
    }
    
    // Add lanes affected if available
    if (data.lanes_affected !== undefined) {
      event.lanesAffected = parseInt(String(data.lanes_affected), 10) || undefined;
    }
    
    return event;
  } catch (error) {
    logger.error('Bay Area 511 adapter error', { error, raw });
    throw new DataProviderError(
      `Failed to adapt Bay Area 511 data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'BayArea511',
      error
    );
  }
};

/**
 * NYC DOT Open Data Adapter
 */
export const adaptNYCDOT: EventAdapter = (raw: unknown): TrafficEvent => {
  try {
    const data = raw as any;
    
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid raw data: expected object');
    }
    
    if (!data.event_id) {
      throw new Error('Missing required field: event_id');
    }
    
    if (!validateGeometry(data.geometry)) {
      throw new Error('Invalid or missing geometry data');
    }
    
    const event: TrafficEvent = {
      id: safeString(data.event_id),
      headline: safeString(data.description || data.title, 'NYC Traffic Event'),
      eventType: mapEventType(safeString(data.category || data.event_type, 'other'), 'NYCDOT'),
      severity: mapSeverity(data.impact || data.severity),
      geometry: data.geometry as Geometry,
      source: 'NYCDOT',
      description: safeString(data.full_description || data.details),
      direction: safeString(data.direction_affected),
      startTime: safeDate(data.start_date || data.start_datetime),
      endTime: safeDate(data.end_date || data.end_datetime),
      updated: safeDate(data.modified_date || data.last_updated),
      rawData: data
    };
    
    // Handle roads
    if (data.road_name) {
      event.roads = [safeString(data.road_name)];
    } else if (Array.isArray(data.affected_roads)) {
      event.roads = data.affected_roads.map((r: any) => safeString(r));
    }
    
    // Add borough information to metadata
    if (data.borough) {
      event.metadata = { borough: safeString(data.borough) };
    }
    
    return event;
  } catch (error) {
    logger.error('NYC DOT adapter error', { error, raw });
    throw new DataProviderError(
      `Failed to adapt NYC DOT data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NYCDOT',
      error
    );
  }
};

/**
 * TxDOT (Texas) Adapter
 */
export const adaptTxDOT: EventAdapter = (raw: unknown): TrafficEvent => {
  try {
    const data = raw as any;
    
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid raw data: expected object');
    }
    
    if (!data.incident_id && !data.id) {
      throw new Error('Missing required field: incident_id or id');
    }
    
    // TxDOT may provide coordinates instead of GeoJSON
    let geometry: Geometry;
    if (validateGeometry(data.geometry)) {
      geometry = data.geometry as Geometry;
    } else if (data.latitude && data.longitude) {
      geometry = {
        type: 'Point',
        coordinates: [parseFloat(data.longitude), parseFloat(data.latitude)]
      };
    } else {
      throw new Error('No valid geometry data found');
    }
    
    const event: TrafficEvent = {
      id: safeString(data.incident_id || data.id),
      headline: safeString(data.description || data.incident_description, 'Texas Traffic Incident'),
      eventType: mapEventType(safeString(data.incident_type || data.type, 'other'), 'TxDOT'),
      severity: mapSeverity(data.severity_level || data.impact),
      geometry,
      source: 'TxDOT',
      description: safeString(data.full_description || data.comments),
      direction: safeString(data.direction || data.travel_direction),
      startTime: safeDate(data.start_time || data.reported_time),
      endTime: safeDate(data.estimated_end_time || data.cleared_time),
      updated: safeDate(data.last_updated || data.update_time),
      rawData: data
    };
    
    // Handle highway/road information
    if (data.highway) {
      event.roads = [safeString(data.highway)];
    } else if (data.roadway) {
      event.roads = [safeString(data.roadway)];
    }
    
    // Add county information
    if (data.county) {
      event.metadata = { county: safeString(data.county) };
    }
    
    // Handle lane information
    if (data.lanes_blocked) {
      event.lanesAffected = parseInt(String(data.lanes_blocked), 10) || undefined;
    }
    
    return event;
  } catch (error) {
    logger.error('TxDOT adapter error', { error, raw });
    throw new DataProviderError(
      `Failed to adapt TxDOT data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'TxDOT',
      error
    );
  }
};

/**
 * Generic adapter for unknown/new data sources
 * Attempts to map common field patterns
 */
export const adaptGeneric: EventAdapter = (raw: unknown): TrafficEvent => {
  try {
    const data = raw as any;
    
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid raw data: expected object');
    }
    
    // Common field patterns for ID
    const id = data.id || data.event_id || data.incident_id || 
                data.ID || data.eventId || data.incidentId ||
                data.uuid || data.guid;
    
    if (!id) {
      throw new Error('Could not find identifier field');
    }
    
    // Common field patterns for headline/title
    const headline = data.headline || data.title || data.name ||
                    data.description || data.summary || data.event_description ||
                    'Traffic Event';
    
    // Try to find geometry
    let geometry: Geometry;
    if (validateGeometry(data.geometry)) {
      geometry = data.geometry;
    } else if (validateGeometry(data.location)) {
      geometry = data.location;
    } else if (data.coordinates && Array.isArray(data.coordinates)) {
      geometry = {
        type: 'Point',
        coordinates: data.coordinates
      };
    } else if (data.lat && data.lon) {
      geometry = {
        type: 'Point',
        coordinates: [parseFloat(data.lon), parseFloat(data.lat)]
      };
    } else if (data.latitude && data.longitude) {
      geometry = {
        type: 'Point',
        coordinates: [parseFloat(data.longitude), parseFloat(data.latitude)]
      };
    } else {
      throw new Error('Could not find valid geometry data');
    }
    
    // Try to determine event type from various fields
    const eventTypeRaw = data.type || data.event_type || data.category ||
                        data.incident_type || data.eventType || 'other';
    
    const event: TrafficEvent = {
      id: safeString(id),
      headline: safeString(headline),
      eventType: mapEventType(safeString(eventTypeRaw), 'Generic'),
      severity: mapSeverity(data.severity || data.impact || data.priority),
      geometry,
      source: 'Generic',
      description: safeString(data.details || data.full_description || data.comments),
      updated: safeDate(data.updated || data.last_updated || data.modified),
      rawData: data
    };
    
    // Try to find time fields
    event.startTime = safeDate(data.start_time || data.start_date || data.begin_time);
    event.endTime = safeDate(data.end_time || data.end_date || data.finish_time);
    
    // Try to find road information
    if (data.road || data.street || data.highway) {
      event.roads = [safeString(data.road || data.street || data.highway)];
    } else if (Array.isArray(data.roads || data.streets || data.affected_roads)) {
      event.roads = (data.roads || data.streets || data.affected_roads)
        .map((r: any) => safeString(r));
    }
    
    logger.info('Successfully adapted data using generic adapter', { id: event.id });
    
    return event;
  } catch (error) {
    logger.error('Generic adapter error', { error, raw });
    throw new DataProviderError(
      `Failed to adapt generic data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'Generic',
      error
    );
  }
};

/**
 * Export all adapters
 */
export const adapters = {
  bayArea511: adaptBayArea511,
  nycDot: adaptNYCDOT,
  txDot: adaptTxDOT,
  generic: adaptGeneric
} as const;
