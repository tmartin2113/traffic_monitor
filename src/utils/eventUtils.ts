/**
 * Event Utility Functions
 * Utilities for processing and analyzing traffic events
 */

import {
  TrafficEvent,
  EventType,
  EventSeverity,
  Road,
  Area,
  Geography,
} from '@/types/api.types';
import {
  EVENT_TYPE_CONFIG,
  SEVERITY_CONFIG,
} from './constants';
import { isRecentEvent, isStaleEvent } from './dateUtils';

/**
 * Check if event is a road closure
 */
export function isRoadClosure(event: TrafficEvent): boolean {
  // Check road states
  if (event.roads?.some(road => 
    road.state === 'CLOSED' || 
    road.state?.toLowerCase() === 'closed'
  )) {
    return true;
  }

  // Check lane status extension
  if (event['+lane_status']?.toLowerCase().includes('closed')) {
    return true;
  }

  // Check headline for closure keywords
  const closureKeywords = ['closed', 'closure', 'shut down', 'blocked'];
  const headline = event.headline?.toLowerCase() || '';
  
  return closureKeywords.some(keyword => headline.includes(keyword));
}

/**
 * Check if event is a partial closure
 */
export function isPartialClosure(event: TrafficEvent): boolean {
  if (event.roads?.some(road => 
    road.state === 'PARTIAL' || 
    road.state?.toLowerCase() === 'partial' ||
    (road.lanes_closed && road.lanes_closed > 0 && road.total_lanes && road.lanes_closed < road.total_lanes)
  )) {
    return true;
  }

  const partialKeywords = ['lane closed', 'lanes closed', 'partially closed', 'reduced to'];
  const headline = event.headline?.toLowerCase() || '';
  
  return partialKeywords.some(keyword => headline.includes(keyword));
}

/**
 * Get event icon based on type
 */
export function getEventIcon(event: TrafficEvent): string {
  if (isRoadClosure(event)) {
    return '🚫';
  }
  
  const config = EVENT_TYPE_CONFIG[event.event_type];
  return config?.icon || '📍';
}

/**
 * Get event color based on severity
 */
export function getEventColor(event: TrafficEvent): string {
  if (isRoadClosure(event)) {
    return '#DC2626'; // Red for closures
  }
  
  const severityConfig = SEVERITY_CONFIG[event.severity];
  return severityConfig?.color || '#6B7280';
}

/**
 * Get primary road from event
 */
export function getPrimaryRoad(event: TrafficEvent): string {
  if (!event.roads || event.roads.length === 0) {
    return 'Unknown location';
  }

  const road = event.roads[0];
  let roadName = road.name;

  if (road.from && road.to) {
    roadName += ` between ${road.from} and ${road.to}`;
  } else if (road.from) {
    roadName += ` from ${road.from}`;
  } else if (road.to) {
    roadName += ` to ${road.to}`;
  }

  if (road.direction) {
    roadName += ` ${road.direction}`;
  }

  return roadName;
}

/**
 * Get affected areas from event
 */
export function getAffectedAreas(event: TrafficEvent): string[] {
  if (!event.areas) return [];
  return event.areas.map(area => area.name);
}

/**
 * Get impact description
 */
export function getImpactDescription(event: TrafficEvent): string {
  if (isRoadClosure(event)) {
    return 'Road Closed';
  }

  if (isPartialClosure(event)) {
    const lanesInfo = getLanesClosedInfo(event);
    if (lanesInfo) {
      return lanesInfo;
    }
    return 'Partial Closure';
  }

  const severityConfig = SEVERITY_CONFIG[event.severity];
  return severityConfig?.label || 'Impact Unknown';
}

/**
 * Get lanes closed information
 */
export function getLanesClosedInfo(event: TrafficEvent): string | null {
  for (const road of event.roads || []) {
    if (road.lanes_closed && road.total_lanes) {
      return `${road.lanes_closed} of ${road.total_lanes} lanes closed`;
    } else if (road.lanes_closed) {
      return `${road.lanes_closed} lane${road.lanes_closed > 1 ? 's' : ''} closed`;
    }
  }

  return null;
}

/**
 * Calculate event priority score
 */
export function calculateEventPriority(event: TrafficEvent): number {
  let score = 0;

  // Severity weight (0-40 points)
  const severityWeight = SEVERITY_CONFIG[event.severity]?.weight || 0;
  score += severityWeight * 10;

  //
