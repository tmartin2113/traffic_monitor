/**
 * @file adapters/bayArea511.ts
 * @description Bay Area 511 adapter with safe coordinate parsing
 * @version 2.0.0 - FIXED: Added NaN validation
 */

import { TrafficEvent, EventType, EventSeverity, Geometry } from '@/types/api.types';
import { safeParseGeometry, safeParseInt } from './helpers';
import { DataProviderError } from './errors';

/**
 * Adapt Bay Area 511 event data
 */
export function adaptBayArea511(raw: unknown): TrafficEvent {
  if (!raw || typeof raw !== 'object') {
    throw new DataProviderError('Invalid data: expected object', 'BayArea511');
  }

  const data = raw as any;

  // Required fields
  if (!data.id) {
    throw new DataProviderError('Missing required field: id', 'BayArea511');
  }

  // ✅ FIXED: Safe geometry parsing with NaN validation
  const geometry = safeParseGeometry(data.geography || data.geometry || data.location);
  
  if (!geometry) {
    throw new DataProviderError(
      `Invalid or missing geometry for event ${data.id}`,
      'BayArea511'
    );
  }

  const event: TrafficEvent = {
    id: String(data.id),
    headline: data.headline || data.event_description || 'Traffic Event',
    eventType: mapEventType(data.event_type),
    severity: mapSeverity(data.severity),
    geometry,
    source: 'BayArea511',
    description: data.description,
    direction: data.direction,
    startTime: safeDate(data.created),
    endTime: safeDate(data.end_time),
    updated: safeDate(data.updated),
    
    // ✅ FIXED: Safe integer parsing
    lanesAffected: safeParseInt(data.lanes_closed),
    
    rawData: data
  };

  // Parse roads
  if (Array.isArray(data.roads)) {
    event.roads = data.roads
      .filter((r: any) => r && typeof r === 'object')
      .map((r: any) => r.name)
      .filter(Boolean);
  }

  return event;
}

/**
 * Map event type
 */
function mapEventType(type: string | undefined): EventType {
  if (!type) return EventType.OTHER;

  const normalized = type.toUpperCase().replace(/[_\s-]/g, '');

  const mapping: Record<string, EventType> = {
    'ACCIDENT': EventType.ACCIDENT,
    'CRASH': EventType.ACCIDENT,
    'CONSTRUCTION': EventType.CONSTRUCTION,
    'ROADWORK': EventType.CONSTRUCTION,
    'ROADCLOSURE': EventType.ROAD_CLOSURE,
    'CLOSURE': EventType.ROAD_CLOSURE,
    'LANECLOSURE': EventType.LANE_CLOSURE,
    'SPECIALEVENT': EventType.SPECIAL_EVENT,
    'EVENT': EventType.SPECIAL_EVENT,
    'WEATHER': EventType.WEATHER,
    'HAZARD': EventType.HAZARD,
    'CONGESTION': EventType.TRAFFIC_CONGESTION,
    'TRAFFIC': EventType.TRAFFIC_CONGESTION,
  };

  return mapping[normalized] || EventType.OTHER;
}

/**
 * Map severity
 */
function mapSeverity(severity: string | undefined): EventSeverity {
  if (!severity) return EventSeverity.UNKNOWN;

  const normalized = severity.toLowerCase();

  if (normalized.includes('critical') || normalized.includes('severe')) {
    return EventSeverity.CRITICAL;
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

/**
 * Safe date parsing
 */
function safeDate(value: any): string | undefined {
  if (!value) return undefined;

  try {
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date.toISOString();
  } catch {
    return undefined;
  }
}
