/**
 * Event Type Definitions
 * Extended types for event handling and display
 */

import { TrafficEvent, EventType, EventSeverity } from './api.types';
import { MapCenter } from './map.types';

// Enhanced event with computed properties
export interface EnhancedTrafficEvent extends TrafficEvent {
  // Computed properties
  isClosure: boolean;
  isRecent: boolean;
  isStale: boolean;
  primaryRoad: string;
  impactLevel: ImpactLevel;
  displayPriority: number;
  distance?: number; // Distance from user/center in meters
  estimatedDuration?: number; // In minutes
}

export enum ImpactLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MODERATE = 'MODERATE',
  LOW = 'LOW',
  MINIMAL = 'MINIMAL',
}

// Event grouping types
export interface EventGroup {
  id: string;
  name: string;
  type: 'location' | 'type' | 'severity' | 'time';
  events: TrafficEvent[];
  count: number;
  center?: MapCenter;
  radius?: number;
}

// Event cluster for map display
export interface EventCluster {
  id: string;
  center: MapCenter;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  events: TrafficEvent[];
  count: number;
  severityCounts: Record<EventSeverity, number>;
  typeCounts: Record<EventType, number>;
}

// Event notification
export interface EventNotification {
  id: string;
  eventId: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  priority: NotificationPriority;
}

export enum NotificationType {
  NEW_CLOSURE = 'NEW_CLOSURE',
  SEVERITY_INCREASE = 'SEVERITY_INCREASE',
  NEARBY_EVENT = 'NEARBY_EVENT',
  FAVORITE_UPDATE = 'FAVORITE_UPDATE',
  ROUTE_IMPACT = 'ROUTE_IMPACT',
  EVENT_CLEARED = 'EVENT_CLEARED',
}

export enum NotificationPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

// Event statistics
export interface EventStatistics {
  total: number;
  active: number;
  archived: number;
  
  // By type
  incidents: number;
  construction: number;
  specialEvents: number;
  roadConditions: number;
  weatherConditions: number;
  
  // By severity
  severe: number;
  major: number;
  moderate: number;
  minor: number;
  unknown: number;
  
  // By impact
  closures: number;
  partialClosures: number;
  laneReductions: number;
  
  // Time-based
  recentEvents: number; // Last 30 minutes
  todayEvents: number;
  weekEvents: number;
  
  // Geographic
  eventsByArea: Map<string, number>;
  eventsByRoad: Map<string, number>;
  
  // Trends
  trendsHourly: number[];
  trendsDaily: number[];
  averageResponseTime?: number; // In minutes
}

// Event timeline item
export interface EventTimelineItem {
  id: string;
  eventId: string;
  timestamp: Date;
  type: TimelineEventType;
  description: string;
  data?: any;
}

export enum TimelineEventType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  SEVERITY_CHANGED = 'SEVERITY_CHANGED',
  LANES_CLOSED = 'LANES_CLOSED',
  LANES_OPENED = 'LANES_OPENED',
  ROAD_CLOSED = 'ROAD_CLOSED',
  ROAD_OPENED = 'ROAD_OPENED',
  CLEARED = 'CLEARED',
}

// Event comparison for changes
export interface EventComparison {
  eventId: string;
  previousState: Partial<TrafficEvent>;
  currentState: Partial<TrafficEvent>;
  changes: EventChange[];
  timestamp: Date;
}

export interface EventChange {
  field: string;
  previousValue: any;
  currentValue: any;
  changeType: 'added' | 'removed' | 'modified';
  impact: ImpactLevel;
}

// Route impact analysis
export interface RouteImpact {
  routeId: string;
  affectedEvents: TrafficEvent[];
  totalDelay: number; // In minutes
  alternativeRoutes: AlternativeRoute[];
  recommendedAction: 'use_current' | 'use_alternative' | 'delay_travel';
}

export interface AlternativeRoute {
  id: string;
  name: string;
  distance: number; // In meters
  estimatedTime: number; // In minutes
  delay: number; // Additional time in minutes
  avoidedEvents: string[];
}

// Event prediction (for future ML integration)
export interface EventPrediction {
  eventType: EventType;
  location: MapCenter;
  probability: number;
  expectedTime: Date;
  expectedDuration: number; // In minutes
  confidence: number; // 0-1
  factors: string[];
}

// Event subscription for real-time updates
export interface EventSubscription {
  id: string;
  userId?: string;
  type: SubscriptionType;
  filters: SubscriptionFilters;
  notification: {
    enabled: boolean;
    channels: NotificationChannel[];
    threshold?: EventSeverity;
  };
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum SubscriptionType {
  ALL_EVENTS = 'ALL_EVENTS',
  CLOSURES_ONLY = 'CLOSURES_ONLY',
  AREA_BASED = 'AREA_BASED',
  ROUTE_BASED = 'ROUTE_BASED',
  SEVERITY_BASED = 'SEVERITY_BASED',
}

export interface SubscriptionFilters {
  eventTypes?: EventType[];
  severities?: EventSeverity[];
  areas?: string[];
  roads?: string[];
  radius?: number;
  center?: MapCenter;
  keywords?: string[];
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  PUSH = 'PUSH',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

// Event export formats
export interface EventExport {
  format: ExportFormat;
  events: TrafficEvent[];
  filters?: any;
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeClosures?: boolean;
  includeDetails?: boolean;
}

export enum ExportFormat {
  JSON = 'JSON',
  CSV = 'CSV',
  PDF = 'PDF',
  KML = 'KML',
  GEOJSON = 'GEOJSON',
}

// Event action types for user interactions
export interface EventAction {
  type: EventActionType;
  eventId: string;
  timestamp: Date;
  userId?: string;
  data?: any;
}

export enum EventActionType {
  VIEW = 'VIEW',
  SELECT = 'SELECT',
  FAVORITE = 'FAVORITE',
  UNFAVORITE = 'UNFAVORITE',
  SHARE = 'SHARE',
  REPORT = 'REPORT',
  NAVIGATE = 'NAVIGATE',
  HIDE = 'HIDE',
  UNHIDE = 'UNHIDE',
}

// Event severity configuration
export interface SeverityConfig {
  level: EventSeverity;
  label: string;
  color: string;
  priority: number;
  icon?: string;
  notificationRequired?: boolean;
  autoExpand?: boolean;
}

// Event type configuration
export interface EventTypeConfig {
  type: EventType;
  label: string;
  icon: string;
  color: string;
  priority: number;
  defaultSeverity?: EventSeverity;
  canBeClosure?: boolean;
}
