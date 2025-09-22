/**
 * API Type Definitions for 511.org Traffic Events API
 * Based on Open511 specification
 */

export interface TrafficEvent {
  id: string;
  status: EventStatus;
  headline: string;
  event_type: EventType;
  event_subtypes?: EventSubtype[];
  severity: EventSeverity;
  certainty?: EventCertainty;
  created: string; // ISO 8601 datetime
  updated: string; // ISO 8601 datetime
  geography: Geography;
  closure_geometry?: ClosureGeometry;
  roads?: Road[];
  areas?: Area[];
  schedules?: Schedule[];
  description?: string;
  detour?: string;
  grouped_events?: GroupedEvent[];
  attachments?: Attachment[];
  source_type?: SourceType;
  source_id?: string;
  '+closure_geometry'?: ClosureGeometry; // Extension field
}

export enum EventStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum EventType {
  CONSTRUCTION = 'CONSTRUCTION',
  SPECIAL_EVENT = 'SPECIAL_EVENT',
  INCIDENT = 'INCIDENT',
  WEATHER_CONDITION = 'WEATHER_CONDITION',
  ROAD_CONDITION = 'ROAD_CONDITION',
}

export enum EventSeverity {
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  MAJOR = 'MAJOR',
  SEVERE = 'SEVERE',
  UNKNOWN = 'UNKNOWN',
}

export enum EventCertainty {
  OBSERVED = 'OBSERVED',
  LIKELY = 'LIKELY',
  POSSIBLE = 'POSSIBLE',
  UNKNOWN = 'UNKNOWN',
}

export type EventSubtype = string; // Many possible values from spec

export interface Geography {
  type: 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon';
  coordinates: number[] | number[][] | number[][][];
}

export interface ClosureGeometry {
  type: 'MultiLineString';
  coordinates: number[][][];
}

export interface Road {
  name: string;
  from?: string;
  to?: string;
  direction?: RoadDirection;
  state?: RoadState;
  impacted_lane_type?: string;
  road_advisory?: string;
  lane_status?: LaneStatus;
  article?: string;
  lanes_open?: number;
  lanes_closed?: number;
  impacted_systems?: ImpactedSystem[];
  restrictions?: Restriction[];
}

export enum RoadDirection {
  EASTBOUND = 'Eastbound',
  WESTBOUND = 'Westbound',
  NORTHBOUND = 'Northbound',
  SOUTHBOUND = 'Southbound',
  EASTBOUND_WESTBOUND = 'Eastbound and Westbound',
  NORTHBOUND_SOUTHBOUND = 'Northbound and Southbound',
  BOTH = 'Both',
}

export enum RoadState {
  CLOSED = 'CLOSED',
  SOME_LANES_CLOSED = 'SOME_LANES_CLOSED',
  SINGLE_LANE_ALTERNATING = 'SINGLE_LANE_ALTERNATING',
  ALL_LANES_OPEN = 'ALL_LANES_OPEN',
}

export enum LaneStatus {
  AFFECTED = 'affected',
  BLOCKED = 'blocked',
  CLOSED = 'closed',
  OPEN = 'open',
  REMAIN_CLOSED = 'remain closed',
  REMAINS_CLOSED = 'remains closed',
}

export enum ImpactedSystem {
  ROAD = 'ROAD',
  SIDEWALK = 'SIDEWALK',
  BIKELANE = 'BIKELANE',
  PARKING = 'PARKING',
}

export interface Restriction {
  restriction_type: RestrictionType;
  value: number;
}

export enum RestrictionType {
  SPEED = 'SPEED',
  WIDTH = 'WIDTH',
  HEIGHT = 'HEIGHT',
  WEIGHT = 'WEIGHT',
  AXLE_WEIGHT = 'AXLE_WEIGHT',
}

export interface Area {
  name: string;
  id: string;
  url?: string;
}

export interface Schedule {
  recurring_schedules?: RecurringSchedule[];
  exceptions?: Exception[];
  intervals?: Interval[];
}

export interface RecurringSchedule {
  start_date: string;
  end_date?: string;
  daily_start_time?: string;
  daily_end_time?: string;
  days?: number[];
}

export interface Exception {
  date: string;
  times?: string[];
}

export interface Interval {
  start: string;
  end?: string;
}

export interface GroupedEvent {
  related: string;
}

export interface Attachment {
  related: string;
  type?: string;
  length?: number;
  title?: string;
  hreflang?: string;
}

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

export interface Pagination {
  offset: number;
  limit?: number;
  next_url?: string;
  previous_url?: string;
}

export interface Meta {
  url: string;
  up_url?: string;
  version: string;
}

// WZDx Types
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
}

export interface CoreDetails {
  event_type: 'work-zone' | 'detour';
  data_source_id: string;
  road_names: string[];
  direction: string;
  creation_date: string;
  update_date: string;
  description?: string;
}

export type DateAccuracy = 'estimated' | 'verified';
export type LocationAccuracy = 'estimated' | 'verified';
export type LocationMethod = 'channel-device-method' | 'other' | 'unknown';
export type VehicleImpact = 'unknown' | 'alternating-one-way';

export interface WorkerPresence {
  are_workers_present: boolean;
}
