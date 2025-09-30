/**
 * @file types/TrafficEvent.ts
 * @description Core type definitions for traffic event abstraction layer
 * @version 1.0.0
 */

import { GeoJSON } from 'geojson';

/**
 * Severity levels for traffic events following standard incident management classifications
 */
export enum EventSeverity {
  CRITICAL = 'critical',
  MAJOR = 'major',
  MODERATE = 'moderate',
  MINOR = 'minor',
  UNKNOWN = 'unknown'
}

/**
 * Standard event types across all traffic data sources
 */
export enum EventType {
  ACCIDENT = 'accident',
  CONSTRUCTION = 'construction',
  ROAD_CLOSURE = 'road_closure',
  LANE_CLOSURE = 'lane_closure',
  SPECIAL_EVENT = 'special_event',
  WEATHER = 'weather',
  TRAFFIC_CONGESTION = 'traffic_congestion',
  HAZARD = 'hazard',
  OTHER = 'other'
}

/**
 * Common traffic event interface that all API responses must be adapted to
 * This serves as the contract between data sources and the UI layer
 */
export interface TrafficEvent {
  /** Unique identifier for the event */
  id: string;
  
  /** Human-readable headline or title */
  headline: string;
  
  /** Standardized event type */
  eventType: EventType;
  
  /** Severity level of the incident */
  severity?: EventSeverity;
  
  /** Geographic data in GeoJSON format for map rendering */
  geometry: GeoJSON.Geometry;
  
  /** List of affected roads or highways */
  roads?: string[];
  
  /** ISO 8601 timestamp for event start */
  startTime?: string;
  
  /** ISO 8601 timestamp for event end (if known) */
  endTime?: string;
  
  /** ISO 8601 timestamp for last update */
  updated?: string;
  
  /** Data source identifier */
  source: string;
  
  /** Additional description or details */
  description?: string;
  
  /** Direction of travel affected (e.g., 'Northbound', 'Both directions') */
  direction?: string;
  
  /** Number of lanes affected */
  lanesAffected?: number;
  
  /** Original raw data for debugging purposes */
  rawData?: Record<string, unknown>;
  
  /** Additional metadata that might be source-specific */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for a data provider
 */
export interface DataProviderConfig {
  /** Display name for the provider */
  name: string;
  
  /** Base URL for the API */
  baseUrl: string;
  
  /** Default query parameters */
  defaultParams?: Record<string, string | number | boolean>;
  
  /** API key if required */
  apiKey?: string;
  
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Rate limiting configuration */
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  
  /** Custom headers for requests */
  headers?: Record<string, string>;
}

/**
 * Provider interface that all data sources must implement
 */
export interface DataProvider {
  /** Provider configuration */
  config: DataProviderConfig;
  
  /** Fetch events from the data source */
  fetchEvents(): Promise<TrafficEvent[]>;
  
  /** Validate provider configuration */
  validateConfig(): boolean;
  
  /** Get provider health status */
  healthCheck(): Promise<boolean>;
}

/**
 * Error types for better error handling
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

/**
 * Adapter function signature
 */
export type EventAdapter<T = unknown> = (rawData: T) => TrafficEvent;

/**
 * Provider registry type
 */
export type ProviderRegistry = Record<string, DataProvider>;

/**
 * Fetch options for providers
 */
export interface FetchOptions {
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  
  /** Force cache refresh */
  forceRefresh?: boolean;
  
  /** Include raw data in response */
  includeRaw?: boolean;
}

/**
 * Provider metrics for monitoring
 */
export interface ProviderMetrics {
  provider: string;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastError?: string;
  lastSuccessfulFetch?: string;
}
