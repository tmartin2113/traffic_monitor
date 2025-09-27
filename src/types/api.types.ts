/**
 * API Type Definitions
 * Complete TypeScript types for 511.org Traffic and WZDx APIs
 * 
 * @module types/api
 * @version 2.0.0
 */

// ============================================================================
// Enumerations
// ============================================================================

/**
 * Event types as defined by 511.org API
 */
export enum EventType {
  CONSTRUCTION = 'CONSTRUCTION',
  INCIDENT = 'INCIDENT',
  SPECIAL_EVENT = 'SPECIAL_EVENT',
  ROAD_CLOSURE = 'ROAD_CLOSURE',
  WEATHER_CONDITION = 'WEATHER_CONDITION',
  EMERGENCY_ROADWORK = 'EMERGENCY_ROADWORK',
  PLANNED_EVENT = 'PLANNED_EVENT',
  TRAFFIC_HAZARD = 'TRAFFIC_HAZARD'
}

/**
 * Event severity levels
 */
export enum EventSeverity {
  MINOR = 'Minor',
  MODERATE = 'Moderate',
  MAJOR = 'Major',
  SEVERE = 'Severe',
  UNKNOWN = 'Unknown'
}

/**
 * Event status values
 */
export enum EventStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  PENDING = 'PENDING',
  CANCELLED = 'CANCELLED'
}

/**
 * Road state conditions
 */
export enum RoadState {
  CLOSED = 'CLOSED',
  RESTRICTED = 'RESTRICTED',
  OPEN = 'OPEN',
  IMPASSABLE = 'IMPASSABLE',
  PARTIALLY_CLOSED = 'PARTIALLY_CLOSED',
  REDUCED_LANES = 'REDUCED_LANES'
}

/**
 * Traffic impact levels
 */
export enum ImpactLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  SEVERE = 'SEVERE',
  NONE = 'NONE'
}

/**
 * Data source types
 */
export enum SourceType {
  CALTRANS = 'Caltrans',
  CHP = 'CHP',
  TIC = 'TIC',
  WAZE = 'Waze',
  MUNICIPAL = 'Municipal',
  CONTRACTOR = 'Contractor',
  OTHER = 'Other'
}

/**
 * Direction identifiers
 */
export enum Direction {
  NORTHBOUND = 'Northbound',
  SOUTHBOUND = 'Southbound',
  EASTBOUND = 'Eastbound',
  WESTBOUND = 'Westbound',
  BOTH = 'Both',
  INNER_LOOP = 'Inner Loop',
  OUTER_LOOP = 'Outer Loop',
  CLOCKWISE = 'Clockwise',
  COUNTER_CLOCKWISE = 'Counter-Clockwise',
  UNDEFINED = 'Undefined'
}

/**
 * Lane types
 */
export enum LaneType {
  GENERAL = 'general-purpose-lane',
  HOV = 'hov-lane',
  EXPRESS = 'express-lane',
  TOLL = 'toll-lane',
  SHOULDER = 'shoulder',
  BIKE = 'bike-lane',
  PARKING = 'parking-lane',
  MEDIAN = 'median',
  CENTER_TURN = 'center-turn-lane',
  AUXILIARY = 'auxiliary-lane'
}

// ============================================================================
// Geographic Types
// ============================================================================

/**
 * GeoJSON Point geometry
 */
export interface PointGeometry {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

/**
 * GeoJSON LineString geometry
 */
export interface LineStringGeometry {
  type: 'LineString';
  coordinates: number[][]; // Array of [longitude, latitude] pairs
}

/**
 * GeoJSON Polygon geometry
 */
export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: number[][][]; // Array of linear rings
}

/**
 * GeoJSON MultiPoint geometry
 */
export interface MultiPointGeometry {
  type: 'MultiPoint';
  coordinates: number[][];
}

/**
 * GeoJSON MultiLineString geometry
 */
export interface MultiLineStringGeometry {
  type: 'MultiLineString';
  coordinates: number[][][];
}

/**
 * Combined geography type
 */
export type Geography = 
  | PointGeometry 
  | LineStringGeometry 
  | PolygonGeometry
  | MultiPointGeometry
  | MultiLineStringGeometry;

/**
 * Bounding box coordinates
 */
export interface BoundingBox {
  xmin: number; // West longitude
  ymin: number; // South latitude
  xmax: number; // East longitude
  ymax: number; // North latitude
}

// ============================================================================
// Road and Area Types
// ============================================================================

/**
 * Road information
 */
export interface Road {
  id?: string;
  name: string;
  from?: string;
  to?: string;
  direction?: Direction | string;
  state?: RoadState;
  lanes_blocked?: LaneInfo[];
  closure_type?: 'FULL' | 'PARTIAL' | 'INTERMITTENT';
  impacted_systems?: ImpactedSystem[];
  restrictions?: VehicleRestriction[];
  detour?: DetourInfo;
}

/**
 * Lane information
 */
export interface LaneInfo {
  lane_number?: number;
  lane_type?: LaneType;
  status: 'CLOSED' | 'BLOCKED' | 'RESTRICTED' | 'OPEN';
  affected_direction?: Direction;
}

/**
 * Impacted system information
 */
export interface ImpactedSystem {
  system_id: string;
  name: string;
  impact_level?: ImpactLevel;
}

/**
 * Vehicle restriction details
 */
export interface VehicleRestriction {
  vehicle_type?: 'ALL' | 'TRUCK' | 'OVERSIZED' | 'HAZMAT' | 'PASSENGER';
  restriction_type?: 'NO_ACCESS' | 'HEIGHT_LIMIT' | 'WEIGHT_LIMIT' | 'WIDTH_LIMIT';
  limit_value?: number;
  limit_unit?: 'feet' | 'meters' | 'tons' | 'pounds';
}

/**
 * Detour information
 */
export interface DetourInfo {
  description?: string;
  roads?: string[];
  distance?: number;
  estimated_delay?: number;
  geometry?: Geography;
}

/**
 * Area information
 */
export interface Area {
  id: string;
  name: string;
  url?: string;
  type?: 'CITY' | 'COUNTY' | 'NEIGHBORHOOD' | 'REGION';
}

// ============================================================================
// Schedule Types
// ============================================================================

/**
 * Event schedule
 */
export interface Schedule {
  recurring_schedules?: RecurringSchedule[];
  exceptions?: ScheduleException[];
  intervals?: ScheduleInterval[];
}

/**
 * Recurring schedule pattern
 */
export interface RecurringSchedule {
  start_date: string;
  end_date?: string;
  daily_start_time?: string;
  daily_end_time?: string;
  days?: number[]; // 0=Sunday, 6=Saturday
  active_periods?: TimePeriod[];
}

/**
 * Schedule exception
 */
export interface ScheduleException {
  date: string;
  times?: string[];
  status?: 'CANCELLED' | 'MODIFIED' | 'ACTIVE';
}

/**
 * Schedule interval
 */
export interface ScheduleInterval {
  start: string;
  end?: string;
}

/**
 * Time period
 */
export interface TimePeriod {
  start_time: string;
  end_time: string;
}

// ============================================================================
// Main Event Types
// ============================================================================

/**
 * Main traffic event structure
 */
export interface TrafficEvent {
  // Core identifiers
  id: string;
  self?: string;
  jurisdiction?: string;
  
  // Event classification
  event_type: EventType;
  event_subtypes?: string[];
  severity: EventSeverity;
  status: EventStatus;
  
  // Descriptive information
  headline?: string;
  description?: string;
  
  // Temporal data
  created: string;
  updated: string;
  schedule?: Schedule;
  
  // Geographic data
  geography?: Geography;
  roads?: Road[];
  areas?: Area[];
  
  // Impact and priority
  impact?: EventImpact;
  priority?: number;
  
  // Source and metadata
  source?: EventSource;
  attachments?: Attachment[];
  grouped_events?: GroupedEvent[];
  
  // Additional fields
  [key: string]: any;
}

/**
 * Event impact information
 */
export interface EventImpact {
  level: ImpactLevel;
  delay?: number; // minutes
  queue_length?: number; // miles/km
  affected_lanes?: number;
  total_lanes?: number;
  speed?: number; // mph or km/h
}

/**
 * Event source information
 */
export interface EventSource {
  type: SourceType;
  id?: string;
  last_updated?: string;
  accuracy?: 'HIGH' | 'MEDIUM' | 'LOW';
  agency?: string;
}

/**
 * Attachment/link information
 */
export interface Attachment {
  related: string;
  type?: string;
  length?: number;
  title?: string;
  hreflang?: string;
}

/**
 * Grouped event reference
 */
export interface GroupedEvent {
  related: string;
  relationship?: 'PARENT' | 'CHILD' | 'SIBLING' | 'RELATED';
}

// ============================================================================
// WZDx Types (Work Zone Data Exchange)
// ============================================================================

/**
 * WZDx main response structure
 */
export interface WZDxResponse {
  road_event_feed_info: RoadEventFeedInfo;
  type: 'FeatureCollection';
  features: WZDxFeature[];
}

/**
 * Road event feed metadata
 */
export interface RoadEventFeedInfo {
  publisher: string;
  version: string;
  license: string;
  update_frequency: number; // seconds
  contact_name: string;
  contact_email: string;
  update_date: string;
  data_sources: DataSource[];
}

/**
 * Data source information
 */
export interface DataSource {
  data_source_id: string;
  jurisdiction_id?: string;
  organization_name: string;
  update_frequency?: number;
  contact_name?: string;
  contact_email?: string;
  update_date: string;
}

/**
 * WZDx feature
 */
export interface WZDxFeature {
  type: 'Feature';
  id: string;
  geometry: Geography;
  properties: WZDxProperties;
}

/**
 * WZDx properties
 */
export interface WZDxProperties {
  core_details: CoreDetails;
  start_date: string;
  end_date?: string;
  event_status: WZDxEventStatus;
  start_date_accuracy: DateAccuracy;
  end_date_accuracy?: DateAccuracy;
  beginning_accuracy?: LocationAccuracy;
  ending_accuracy?: LocationAccuracy;
  location_method?: LocationMethod;
  vehicle_impact?: VehicleImpact;
  beginning_cross_street?: string;
  ending_cross_street?: string;
  worker_presence?: WorkerPresence;
  reduced_speed_limit?: number;
  lanes?: WZDxLane[];
  road_event_type?: WZDxEventType;
  description?: string;
  restrictions?: WZDxRestriction[];
}

/**
 * WZDx core details
 */
export interface CoreDetails {
  event_type: 'work-zone' | 'detour';
  data_source_id: string;
  road_names: string[];
  direction: string;
  creation_date: string;
  update_date: string;
  description?: string;
  related_road_events?: string[];
}

/**
 * WZDx lane information
 */
export interface WZDxLane {
  order: number;
  status: 'open' | 'closed' | 'shift-left' | 'shift-right' | 'merge-left' | 'merge-right';
  type: LaneType | string;
  lane_edge_reference?: 'left' | 'right' | 'center';
}

/**
 * WZDx restriction
 */
export interface WZDxRestriction {
  type: string;
  value?: number;
  unit?: string;
}

/**
 * Worker presence information
 */
export interface WorkerPresence {
  are_workers_present: boolean;
  definition?: string;
  confidence?: 'low' | 'medium' | 'high';
  last_confirmed?: string;
}

// WZDx Enums
export type WZDxEventStatus = 'active' | 'pending' | 'completed' | 'cancelled';
export type WZDxEventType = 'work-zone' | 'detour' | 'road-closure' | 'incident';
export type DateAccuracy = 'estimated' | 'verified';
export type LocationAccuracy = 'estimated' | 'verified';
export type LocationMethod = 'channel-device-method' | 'sign-method' | 'other' | 'unknown';
export type VehicleImpact = 'all-lanes-closed' | 'some-lanes-closed' | 'all-lanes-open' | 'alternating-one-way' | 'unknown';

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Traffic events response
 */
export interface TrafficEventsResponse {
  events: TrafficEvent[];
  pagination?: Pagination;
  meta?: Meta;
}

/**
 * Pagination information
 */
export interface Pagination {
  offset: number;
  limit?: number;
  total?: number;
  next_url?: string;
  previous_url?: string;
  page?: number;
  total_pages?: number;
}

/**
 * Response metadata
 */
export interface Meta {
  url: string;
  up_url?: string;
  version: string;
  timestamp?: string;
  generated_at?: string;
  cache_control?: string;
  rate_limit?: RateLimitMeta;
}

/**
 * Rate limit metadata
 */
export interface RateLimitMeta {
  limit: number;
  remaining: number;
  reset: string;
  retry_after?: number;
}

// ============================================================================
// Filter Types
// ============================================================================

/**
 * API filter parameters
 */
export interface APIFilters {
  event_type?: EventType | EventType[];
  severity?: EventSeverity | EventSeverity[];
  status?: EventStatus;
  jurisdiction?: string | string[];
  bbox?: BoundingBox | string;
  updated_since?: string;
  created_since?: string;
  active_as_of?: string;
  limit?: number;
  offset?: number;
  format?: 'json' | 'xml' | 'geojson';
  include_geometry?: boolean;
  include_future?: boolean;
  include_archived?: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * API error response
 */
export interface APIError {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp?: string;
    path?: string;
  };
  status: number;
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  constraint?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Coordinate pair [longitude, latitude]
 */
export type Coordinate = [number, number];

/**
 * Date/time string in ISO 8601 format
 */
export type ISODateTime = string;

/**
 * Nullable type helper
 */
export type Nullable<T> = T | null;

/**
 * Optional type helper
 */
export type Optional<T> = T | undefined;

/**
 * Deep partial type helper
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extract enum values as union type
 */
export type EnumValues<T> = T[keyof T];

// ============================================================================
// Export Type Guards
// ============================================================================

/**
 * Type guard for TrafficEvent
 */
export function isTrafficEvent(obj: any): obj is TrafficEvent {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    obj.event_type in EventType &&
    obj.severity in EventSeverity &&
    obj.status in EventStatus
  );
}

/**
 * Type guard for WZDxFeature
 */
export function isWZDxFeature(obj: any): obj is WZDxFeature {
  return (
    obj &&
    obj.type === 'Feature' &&
    typeof obj.id === 'string' &&
    obj.geometry &&
    obj.properties &&
    obj.properties.core_details
  );
}

/**
 * Type guard for Geography
 */
export function isGeography(obj: any): obj is Geography {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.type === 'string' &&
    Array.isArray(obj.coordinates)
  );
}

/**
 * Type guard for road closure
 */
export function isRoadClosureEvent(event: TrafficEvent): boolean {
  return (
    event.event_type === EventType.ROAD_CLOSURE ||
    event.roads?.some(road => road.state === RoadState.CLOSED) ||
    false
  );
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Severity level priority (higher number = higher priority)
 */
export const SEVERITY_PRIORITY: Record<EventSeverity, number> = {
  [EventSeverity.SEVERE]: 4,
  [EventSeverity.MAJOR]: 3,
  [EventSeverity.MODERATE]: 2,
  [EventSeverity.MINOR]: 1,
  [EventSeverity.UNKNOWN]: 0
};

/**
 * Event type labels for UI
 */
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  [EventType.CONSTRUCTION]: 'Construction',
  [EventType.INCIDENT]: 'Incident',
  [EventType.SPECIAL_EVENT]: 'Special Event',
  [EventType.ROAD_CLOSURE]: 'Road Closure',
  [EventType.WEATHER_CONDITION]: 'Weather',
  [EventType.EMERGENCY_ROADWORK]: 'Emergency Work',
  [EventType.PLANNED_EVENT]: 'Planned Event',
  [EventType.TRAFFIC_HAZARD]: 'Traffic Hazard'
};

/**
 * Severity level colors for UI
 */
export const SEVERITY_COLORS: Record<EventSeverity, string> = {
  [EventSeverity.SEVERE]: '#DC2626',   // red-600
  [EventSeverity.MAJOR]: '#EA580C',    // orange-600
  [EventSeverity.MODERATE]: '#CA8A04', // yellow-600
  [EventSeverity.MINOR]: '#16A34A',    // green-600
  [EventSeverity.UNKNOWN]: '#6B7280'   // gray-500
};

export default {
  EventType,
  EventSeverity,
  EventStatus,
  RoadState,
  ImpactLevel,
  SourceType,
  Direction,
  LaneType
};
