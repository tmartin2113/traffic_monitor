/**
 * Type Definitions Exports
 * 
 * @module types
 * @description Centralized export point for all TypeScript type definitions.
 * Provides comprehensive type safety across the application.
 * 
 * @author Senior Development Team
 * @since 1.0.0
 * @license MIT
 */

// API Types
export type {
  // Core Event Types
  TrafficEvent,
  TrafficEventsResponse,
  WZDxResponse,
  WZDxFeature,
  WZDxProperties,
  
  // Enums
  EventType,
  EventSeverity,
  EventStatus,
  RoadState,
  
  // Sub-types
  EventRoad,
  EventArea,
  EventSchedule,
  EventGeography,
  ClosureGeometry,
  CoreDetails,
  DataSource,
  
  // API Parameters
  TrafficEventParams,
  WZDxParams,
} from './api.types';

// Event Types
export type {
  EventCategory,
  EventPriority,
  EventImpact,
  EventTimeframe,
  EventLocation,
  EventMetadata,
  ProcessedEvent,
  EventStatistics,
  EventGrouping,
} from './event.types';

// Map Types
export type {
  MapCenter,
  MapBounds,
  MapCoordinates,
  MapRef,
  MapOptions,
  MapControls,
  MapLayerConfig,
  MapMarkerConfig,
  MapPolylineConfig,
  MapClusterConfig,
  GeofenceConfig,
  LocationPermission,
} from './map.types';

// Filter Types
export type {
  FilterState,
  FilterOptions,
  SortOptions,
  DateRange,
  SearchCriteria,
  FilterPreset,
  FilterValidation,
} from './filter.types';

// Re-export all enums for convenience
export { 
  EventType,
  EventSeverity,
  EventStatus,
  RoadState 
} from './api.types';

/**
 * Utility type for nullable values
 */
export type Nullable<T> = T | null;

/**
 * Utility type for optional values
 */
export type Optional<T> = T | undefined;

/**
 * Utility type for async function returns
 */
export type AsyncReturn<T> = Promise<T>;

/**
 * Utility type for error handling
 */
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Utility type for paginated responses
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Utility type for timestamped data
 */
export interface Timestamped<T> {
  data: T;
  timestamp: number;
  expiresAt?: number;
}

/**
 * Utility type for geospatial data
 */
export interface GeoJSON<T = any> {
  type: 'Feature' | 'FeatureCollection';
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
    coordinates: number[] | number[][] | number[][][];
  };
  properties: T;
}

/**
 * Type guards for runtime type checking
 */
export const TypeGuards = {
  isTrafficEvent: (value: unknown): value is TrafficEvent => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      'event_type' in value &&
      'severity' in value
    );
  },
  
  isWZDxFeature: (value: unknown): value is WZDxFeature => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      value.type === 'Feature' &&
      'geometry' in value &&
      'properties' in value
    );
  },
  
  isMapBounds: (value: unknown): value is MapBounds => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'north' in value &&
      'south' in value &&
      'east' in value &&
      'west' in value
    );
  },
  
  isFilterState: (value: unknown): value is FilterState => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'eventType' in value ||
      'severity' in value ||
      'searchTerm' in value
    );
  },
} as const;

/**
 * Type assertion helpers
 */
export function assertType<T>(value: unknown, guard: (value: unknown) => value is T): asserts value is T {
  if (!guard(value)) {
    throw new TypeError('Type assertion failed');
  }
}

/**
 * Deep readonly utility type
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends (infer U)[]
    ? DeepReadonly<U>[]
    : T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

/**
 * Deep partial utility type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

// Version information
export const TYPES_VERSION = '1.0.0' as const;
