/**
 * Event Utility Functions
 * Helper functions for working with traffic events
 */

import { TrafficEvent, RoadState, EventType, EventSeverity } from '@types/api.types';
import { formatDistanceToNow, parseISO, differenceInMinutes } from 'date-fns';

/**
 * Check if an event represents a road closure
 */
export function isRoadClosure(event: TrafficEvent): boolean {
  if (!event.roads || event.roads.length === 0) {
    return false;
  }

  return event.roads.some(road => {
    // Check for explicit closure states
    if (road.state === RoadState.CLOSED || 
        road.state === RoadState.SOME_LANES_CLOSED) {
      return true;
    }

    // Check lane status
    if (road.lane_status === 'closed' || 
        road.lane_status === 'blocked' ||
        road.lane_status === 'remain closed' ||
        road.lane_status === 'remains closed') {
      return true;
    }

    // Check if all lanes are closed
    if (road.lanes_closed && road.lanes_open === 0) {
      return true;
    }

    // Check for closure keywords in advisories
    const advisory = road.road_advisory?.toLowerCase() || '';
    if (advisory.includes('closed') || 
        advisory.includes('closure') ||
        advisory.includes('shut down')) {
      return true;
    }

    // Check impacted lane type
    const impactedLanes = road.impacted_lane_type?.toLowerCase() || '';
    if (impactedLanes.includes('all lanes') || 
        impactedLanes.includes('full closure')) {
      return true;
    }

    return false;
  });
}

/**
 * Check if an event is a partial closure
 */
export function isPartialClosure(event: TrafficEvent): boolean {
  if (!event.roads || event.roads.length === 0) {
    return false;
  }

  return event.roads.some(road => {
    // Check for partial closure states
    if (road.state === RoadState.SOME_LANES_CLOSED) {
      return true;
    }

    // Check if some lanes are closed but not all
    if (road.lanes_closed && road.lanes_closed > 0 && 
        road.lanes_open && road.lanes_open > 0) {
      return true;
    }

    // Check advisory for partial closure keywords
    const advisory = road.road_advisory?.toLowerCase() || '';
    if (advisory.includes('lane') && 
        (advisory.includes('closed') || advisory.includes('blocked'))) {
      return true;
    }

    return false;
  });
}

/**
 * Get the severity level of an event (1-5)
 */
export function getSeverityLevel(event: TrafficEvent): number {
  const severityMap: Record<EventSeverity, number> = {
    [EventSeverity.SEVERE]: 1,
    [EventSeverity.MAJOR]: 2,
    [EventSeverity.MODERATE]: 3,
    [EventSeverity.MINOR]: 4,
    [EventSeverity.UNKNOWN]: 5,
  };

  return severityMap[event.severity] || 5;
}

/**
 * Format event time in a human-readable format
 */
export function formatEventTime(timestamp: string): string {
  try {
    const date = parseISO(timestamp);
    const now = new Date();
    const diffMinutes = differenceInMinutes(now, date);

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} min ago`;
    } else if (diffMinutes < 1440) { // Less than 24 hours
      const hours = Math.floor(diffMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return formatDistanceToNow(date, { addSuffix: true });
    }
  } catch {
    return 'Unknown time';
  }
}

/**
 * Check if an event is recent (within threshold)
 */
export function isRecentEvent(event: TrafficEvent, thresholdMinutes: number = 30): boolean {
  try {
    const eventDate = parseISO(event.updated);
    const now = new Date();
    const diffMinutes = differenceInMinutes(now, eventDate);
    return diffMinutes <= thresholdMinutes;
  } catch {
    return false;
  }
}

/**
 * Check if an event is stale (older than threshold)
 */
export function isStaleEvent(event: TrafficEvent, thresholdHours: number = 24): boolean {
  try {
    const eventDate = parseISO(event.updated);
    const now = new Date();
    const diffMinutes = differenceInMinutes(now, eventDate);
    return diffMinutes > thresholdHours * 60;
  } catch {
    return true;
  }
}

/**
 * Get the primary road name from an event
 */
export function getPrimaryRoad(event: TrafficEvent): string {
  if (!event.roads || event.roads.length === 0) {
    return 'Unknown location';
  }

  const primaryRoad = event.roads[0];
  let roadName = primaryRoad.name;

  // Add article if present (e.g., "the Bay Bridge")
  if (primaryRoad.article) {
    roadName = `${primaryRoad.article} ${roadName}`;
  }

  return roadName;
}

/**
 * Get a formatted road description
 */
export function getRoadDescription(event: TrafficEvent): string {
  if (!event.roads || event.roads.length === 0) {
    return 'No road information available';
  }

  const descriptions: string[] = [];

  event.roads.forEach(road => {
    let desc = road.name;

    if (road.from && road.to) {
      desc += ` from ${road.from} to ${road.to}`;
    } else if (road.from) {
      desc += ` from ${road.from}`;
    } else if (road.to) {
      desc += ` to ${road.to}`;
    }

    if (road.direction) {
      desc += ` ${road.direction}`;
    }

    descriptions.push(desc);
  });

  return descriptions.join('; ');
}

/**
 * Get impact level description
 */
export function getImpactDescription(event: TrafficEvent): string {
  const impacts: string[] = [];

  if (isRoadClosure(event)) {
    impacts.push('Road Closed');
  } else if (isPartialClosure(event)) {
    impacts.push('Lanes Closed');
  }

  event.roads?.forEach(road => {
    if (road.lanes_closed && road.lanes_closed > 0) {
      impacts.push(`${road.lanes_closed} lane${road.lanes_closed > 1 ? 's' : ''} closed`);
    }

    if (road.impacted_systems?.length) {
      const systems = road.impacted_systems.map(s => s.toLowerCase()).join(', ');
      impacts.push(`Affects: ${systems}`);
    }
  });

  return impacts.length > 0 ? impacts.join(' • ') : 'Minor impact';
}

/**
 * Calculate event duration
 */
export function getEventDuration(event: TrafficEvent): string {
  try {
    const created = parseISO(event.created);
    const now = new Date();
    const diffMinutes = differenceInMinutes(now, created);

    if (diffMinutes < 60) {
      return `${diffMinutes} minutes`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      return `${days} day${days > 1 ? 's' : ''}`;
    }
  } catch {
    return 'Unknown duration';
  }
}

/**
 * Check if event is scheduled
 */
export function isScheduledEvent(event: TrafficEvent): boolean {
  return event.event_type === EventType.CONSTRUCTION || 
         event.event_type === EventType.SPECIAL_EVENT ||
         (event.schedules && event.schedules.length > 0);
}

/**
 * Get event icon based on type and severity
 */
export function getEventIcon(event: TrafficEvent): string {
  const iconMap: Record<EventType, string> = {
    [EventType.CONSTRUCTION]: '🚧',
    [EventType.INCIDENT]: '⚠️',
    [EventType.SPECIAL_EVENT]: '📍',
    [EventType.ROAD_CONDITION]: '🛣️',
    [EventType.WEATHER_CONDITION]: '🌧️',
  };

  if (isRoadClosure(event)) {
    return '🚫';
  }

  return iconMap[event.event_type] || '📌';
}

/**
 * Get event color based on severity
 */
export function getEventColor(event: TrafficEvent): string {
  const colorMap: Record<EventSeverity, string> = {
    [EventSeverity.SEVERE]: '#dc2626',
    [EventSeverity.MAJOR]: '#ea580c',
    [EventSeverity.MODERATE]: '#f59e0b',
    [EventSeverity.MINOR]: '#3b82f6',
    [EventSeverity.UNKNOWN]: '#6b7280',
  };

  return colorMap[event.severity] || '#6b7280';
}

/**
 * Sort events by priority
 */
export function sortEventsByPriority(events: TrafficEvent[]): TrafficEvent[] {
  return [...events].sort((a, b) => {
    // First, sort by closure status
    const aIsClosed = isRoadClosure(a);
    const bIsClosed = isRoadClosure(b);
    if (aIsClosed && !bIsClosed) return -1;
    if (!aIsClosed && bIsClosed) return 1;

    // Then by severity
    const aSeverity = getSeverityLevel(a);
    const bSeverity = getSeverityLevel(b);
    if (aSeverity !== bSeverity) return aSeverity - bSeverity;

    // Then by recency
    const aTime = new Date(a.updated).getTime();
    const bTime = new Date(b.updated).getTime();
    return bTime - aTime;
  });
}

/**
 * Group events by type
 */
export function groupEventsByType(events: TrafficEvent[]): Map<EventType, TrafficEvent[]> {
  const grouped = new Map<EventType, TrafficEvent[]>();

  events.forEach(event => {
    const type = event.event_type;
    if (!grouped.has(type)) {
      grouped.set(type, []);
    }
    grouped.get(type)!.push(event);
  });

  return grouped;
}

/**
 * Filter events by road name
 */
export function filterEventsByRoad(events: TrafficEvent[], roadName: string): TrafficEvent[] {
  const searchTerm = roadName.toLowerCase();
  
  return events.filter(event => {
    if (!event.roads) return false;
    
    return event.roads.some(road => 
      road.name?.toLowerCase().includes(searchTerm)
    );
  });
}

/**
 * Get affected areas from event
 */
export function getAffectedAreas(event: TrafficEvent): string[] {
  const areas: Set<string> = new Set();

  // Add areas from the event
  event.areas?.forEach(area => {
    areas.add(area.name);
  });

  // Try to extract areas from road names (e.g., "San Francisco" from "US-101 San Francisco")
  event.roads?.forEach(road => {
    const match = road.name?.match(/\b(San Francisco|Oakland|San Jose|Berkeley|Fremont|Hayward|San Mateo|Redwood City|Palo Alto|Mountain View|Sunnyvale|Santa Clara|Cupertino)\b/i);
    if (match) {
      areas.add(match[1]);
    }
  });

  return Array.from(areas);
}
