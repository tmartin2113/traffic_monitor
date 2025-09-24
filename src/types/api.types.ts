/**
 * API Type Definitions
 * Complete type definitions for 511.org API responses
 */

// Event Types Enum
export enum EventType {
  CONSTRUCTION = 'CONSTRUCTION',
  INCIDENT = 'INCIDENT',
  SPECIAL_EVENT = 'SPECIAL_EVENT',
  ROAD_CONDITION = 'ROAD_CONDITION',
  WEATHER_CONDITION = 'WEATHER_CONDITION',
}

// Event Severity Enum
export enum EventSeverity {
  SEVERE = 'SEVERE',
  MAJOR = 'MAJOR',
  MODERATE = 'MODERATE',
  MINOR = 'MINOR',
  UNKNOWN = 'UNKNOWN',
}

// Event Status Enum
export enum EventStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  ALL = 'ALL',
}

// Road State Enum
export enum RoadState {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  PARTIAL = 'PARTIAL',
  UNKNOWN = 'UNKNOWN',
}

// Main Traffic Event Interface
export interface TrafficEvent {
  id: string;
  status: EventStatus;
  headline: string;
  description?: string;
  event_type: EventType;
  event_subtypes?: EventSubtype[];
  severity: EventSeverity;
  created: string;
  updated: string;
  geography: Geography;
  '+closure_geometry'?: ClosureGeometry;
  roads?: Road[];
  areas?: Area[];
  detour?: string;
  url?: string;
  jurisdiction_url?: string;
  schedules?: Schedule[];
  grouped_events?: GroupedEvent[];
  attachments?: Attachment[];
  source_type?: SourceType;
  source_name?: string;
  
  // Additional fields from 511.org extensions
  '+lane_type'?: string;
  '+road_advisory'?: string;
  '+lane_status'?: string;
  '+article'?: string;
}

// Event Subtype Interface
export interface EventSubtype {
  id: string;
  name: string;
}

// Geography Interface (supports both Point and LineString)
export interface Geography {
  type: 'Point' | 'LineString' | 'MultiPoint' | 'MultiLineString';
  coordinates: number[] | number[][];
}

// Closure Geometry Interface
export interface ClosureGeometry {
  type: 'LineString' | 'MultiLineString';
  coordinates: number[][];
}

// Road Interface
export interface Road {
  id?: string;
  name: string;
  from?: string;
  to?: string;
  direction?: string;
  state?: RoadState;
  lanes_closed?: number;
  total_lanes?: number;
  impacted?: boolean;
  delay?: string;
}

// Area Interface
export interface Area {
  id?: string;
  name: string;
  url?: string;
}

// Schedule Interface
export interface Schedule {
  recurring_schedules?: RecurringSchedule[];
  exceptions?: Exception[];
  intervals?: Interval[];
  start_date?: string;
  end_date?: string;
}

// Recurring Schedule Interface
export interface RecurringSchedule {
  start_date: string;
  end_date?: string;
  daily_start_time?: string;
  daily_end_time?: string;
  days?: number[];
}

// Exception Interface
export interface Exception {
  date: string;
  times?: string[];
}

// Interval Interface
export interface Interval {
  start: string;
  end?: string;
}

// Grouped Event Interface
export interface GroupedEvent {
  related: string;
}

// Attachment Interface
export interface Attachment {
  related: string;
  type?: string;
  length?: number;
  title?: string;
  hreflang?: string;
}

// Source Type Enum
export enum SourceType {
  CALTRANS = 'Caltrans',
  CHP = 'CHP',
  TIC = 'TIC',
}

// API Response Types
export interface TrafficEventsResponse {
  events: TrafficEvent[];
  pagination?: Pagination;
  meta?: Meta;
}

// Pagination Interface
export interface Pagination {
  offset: number;
  limit?: number;
  next_url?: string;
  previous_url?: string;
}

// Meta Interface
export interface Meta {
  url: string;
  up_url?: string;
  version: string;
  generated?: string;
  count?: number;
}

// API Error Response
export interface APIErrorResponse {
  error: {
    code: number;
    message: string;
    details?: string;
  };
}

// Request Parameters
export interface TrafficEventParams {
  format?: 'json' | 'xml';
  api_key: string;
  status?: EventStatus;
  event_type?: EventType | EventType[];
  severity?: EventSeverity | EventSeverity[];
  bbox?: string;
  geography?: string;
  tolerance?: number;
  jurisdiction?: string;
  created?: string;
  updated?: string;
  road_name?: string;
  area?: string;
  limit?: number;
  offset?: number;
  in_effect_on?: string;
  include_all_defined_enums?: boolean;
}

// WZDx (Work Zone Data Exchange) Types
export interface WZDxResponse {
  road_event_feed_info: RoadEventFeedInfo;
  type: 'FeatureCollection';
  features: WZDxFeature[];
}

export interface RoadEventFeedInfo {
  publisher: string;
  version: string;
  license: string;
  update_frequency: number;
  contact_name: string;
  contact_email: string;
  update_date: string;
  data_sources: DataSource[];
}

export interface DataSource {
  update_date: string;
  data_source_id: string;
  jurisdiction_id: string;
  organization_name: string;
  update_frequency: number;
  contact_name: string;
  contact_email: string;
}

export interface WZDxFeature {
  type: 'Feature';
  id: string;
  geometry: Geography;
  properties: WZDxProperties;
}

export interface WZDxProperties {
  core_details: CoreDetails;
  start_date: string;
  end_date: string;
  event_status: 'active' | 'pending' | 'completed';
  start_date_accuracy: DateAccuracy;
  end_date_accuracy: DateAccuracy;
  beginning_accuracy?: LocationAccuracy;
  ending_accuracy?: LocationAccuracy;
  location_method?: LocationMethod;
  vehicle_impact?: VehicleImpact;
  beginning_cross_street?: string;
  ending_cross_street?: string;
  worker_presence?: WorkerPresence;
  reduced_speed_limit?: number;
  restrictions?: Restriction[];
  description?: string;
  creation_date?: string;
  update_date?: string;
}

export interface CoreDetails {
  event_type: 'work-zone' | 'detour' | 'moving-operation';
  data_source_id: string;
  road_names: string[];
  direction: string;
  creation_date: string;
  update_date: string;
  description?: string;
  relationship?: {
    relationship_id: string;
    relationship_type: 'first' | 'next' | 'related';
  };
}

export type DateAccuracy = 'estimated' | 'verified';
export type LocationAccuracy = 'estimated' | 'verified';
export type LocationMethod = 'channel-device-method' | 'sign-method' | 'other' | 'unknown';
export type VehicleImpact = 'all-lanes-closed' | 'some-lanes-closed' | 'all-lanes-open' | 'alternating-one-way' | 'unknown';

export interface WorkerPresence {
  are_workers_present: boolean;
  method?: 'camera-monitoring' | 'check-in-app' | 'scheduled' | 'other';
  confidence?: 'low' | 'medium' | 'high';
  last_confirmed?: string;
}

export interface Restriction {
  type: 'no-trucks' | 'travel-peak-hours-only' | 'hov-3' | 'hov-2' | 'no-parking' | 'other';
  value?: string;
}

// Type Guards
export function isTrafficEvent(obj: any): obj is TrafficEvent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'status' in obj &&
    'headline' in obj &&
    'event_type' in obj &&
    'severity' in obj &&
    'created' in obj &&
    'updated' in obj &&
    'geography' in obj
  );
}

export function isPointGeography(geography: Geography): geography is Geography & { coordinates: number[] } {
  return geography.type === 'Point' && Array.isArray(geography.coordinates);
}

export function isLineStringGeography(geography: Geography): geography is Geography & { coordinates: number[][] } {
  return (
    (geography.type === 'LineString' || geography.type === 'MultiLineString') &&
    Array.isArray(geography.coordinates) &&
    Array.isArray(geography.coordinates[0])
  );
}

// Utility Types
export type EventsByType = Record<EventType, TrafficEvent[]>;
export type EventsBySeverity = Record<EventSeverity, TrafficEvent[]>;
export type EventsByArea = Map<string, TrafficEvent[]>;
export type EventsByRoad = Map<string, TrafficEvent[]>;
