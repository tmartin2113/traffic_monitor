/**
 * useTrafficEvents Hook
 * Manages fetching and filtering of traffic events
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { trafficAPI } from '@services/api/trafficApi';
import { rateLimiter } from '@services/rateLimit/RateLimiter';
import {
  TrafficEvent,
  EventType,
  EventSeverity,
  RoadState
} from '@types/api.types';
import type { FilterState } from '@types/filter.types';
import { POLLING_CONFIG } from '@utils/constants';

interface UseTrafficEventsOptions {
  enabled?: boolean;
  pollingInterval?: number;
  staleTime?: number;
}

interface UseTrafficEventsResult {
  events: TrafficEvent[];
  filteredEvents: TrafficEvent[];
  closureEvents: TrafficEvent[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  rateLimitInfo: RateLimitInfo | null;
  lastUpdated: Date | null;
}

interface RateLimitInfo {
  remaining: number;
  total: number;
  resetTime: number | null;
}

/**
 * Custom hook for managing traffic events
 */
export function useTrafficEvents(
  apiKey: string | null,
  filters: FilterState,
  options: UseTrafficEventsOptions = {}
): UseTrafficEventsResult {
  const queryClient = useQueryClient();
  
  const {
    enabled = true,
    pollingInterval = POLLING_CONFIG.DEFAULT_INTERVAL_MS,
    staleTime = 30000
  } = options;

  // Query for fetching events
  const {
    data: events = [],
    isLoading,
    isError,
    error,
    refetch,
    dataUpdatedAt
  } = useQuery({
    queryKey: ['traffic-events', apiKey, filters.eventType, filters.severity],
    queryFn: async () => {
      if (!apiKey) {
        throw new Error('API key is required');
      }

      const params: any = {};
      
      if (filters.eventType) {
        params.event_type = filters.eventType;
      }
      
      if (filters.severity) {
        params.severity = filters.severity;
      }

      const response = await trafficAPI.fetchGeofencedEvents(params);
      return response;
    },
    enabled: Boolean(apiKey) && enabled,
    staleTime,
    gcTime: 300000, // 5 minutes
    refetchInterval: pollingInterval,
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Apply client-side filters
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // Filter by closure status
    if (filters.closuresOnly) {
      filtered = filtered.filter(isRoadClosure);
    }

    // Filter by active status
    if (filters.activeOnly) {
      filtered = filtered.filter(event => event.status === 'ACTIVE');
    }

    // Filter by search term
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(event =>
        event.headline?.toLowerCase().includes(searchLower) ||
        event.description?.toLowerCase().includes(searchLower) ||
        event.roads?.some(road =>
          road.name?.toLowerCase().includes(searchLower) ||
          road.from?.toLowerCase().includes(searchLower) ||
          road.to?.toLowerCase().includes(searchLower)
        ) ||
        event.areas?.some(area =>
          area.name?.toLowerCase().includes(searchLower)
        )
      );
    }

    // Filter by severity levels
    if (filters.severityLevels && filters.severityLevels.length > 0) {
      filtered = filtered.filter(event =>
        filters.severityLevels!.includes(event.severity)
      );
    }

    // Filter by date range
    if (filters.dateRange) {
      const { start, end } = filters.dateRange;
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.updated);
        return (!start || eventDate >= start) && (!end || eventDate <= end);
      });
    }

    // Sort events
    return sortEvents(filtered, filters.sortBy || 'severity');
  }, [events, filters]);

  // Get closure events
  const closureEvents = useMemo(() => {
    return filteredEvents.filter(isRoadClosure);
  }, [filteredEvents]);

  // Get rate limit info
  const rateLimitInfo = useMemo((): RateLimitInfo => {
    const info = rateLimiter.getInfo();
    return {
      remaining: info.remaining,
      total: 60,
      resetTime: info.resetTime
    };
  }, [events]); // Update when events change (after API call)

  // Prefetch related data
  const prefetchEventDetails = useCallback(async (eventId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ['event-details', eventId],
      queryFn: () => trafficAPI.getEventById(eventId),
      staleTime: 60000,
    });
  }, [queryClient]);

  // Clear cache
  const clearCache = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['traffic-events'] });
    trafficAPI.clearCache();
  }, [queryClient]);

  return {
    events,
    filteredEvents,
    closureEvents,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    rateLimitInfo,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
  };
}

/**
 * Check if an event represents a road closure
 */
function isRoadClosure(event: TrafficEvent): boolean {
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
        road.lane_status === 'blocked') {
      return true;
    }

    // Check if all lanes are affected
    if (road.impacted_lane_type?.toLowerCase().includes('all lanes')) {
      return true;
    }

    // Check for closure keywords in advisories
    if (road.road_advisory?.toLowerCase().includes('closed')) {
      return true;
    }

    return false;
  });
}

/**
 * Sort events by specified criteria
 */
function sortEvents(events: TrafficEvent[], sortBy: string): TrafficEvent[] {
  const sorted = [...events];

  switch (sortBy) {
    case 'severity':
      return sorted.sort((a, b) => {
        const severityOrder = {
          SEVERE: 0,
          MAJOR: 1,
          MODERATE: 2,
          MINOR: 3,
          UNKNOWN: 4,
        };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

    case 'recent':
      return sorted.sort((a, b) => {
        const dateA = new Date(a.updated).getTime();
        const dateB = new Date(b.updated).getTime();
        return dateB - dateA;
      });

    case 'type':
      return sorted.sort((a, b) => {
        return a.event_type.localeCompare(b.event_type);
      });

    case 'location':
      // Sort by road name if available
      return sorted.sort((a, b) => {
        const roadA = a.roads?.[0]?.name || '';
        const roadB = b.roads?.[0]?.name || '';
        return roadA.localeCompare(roadB);
      });

    default:
      return sorted;
  }
}

/**
 * Custom hook for searching events
 */
export function useEventSearch(
  events: TrafficEvent[],
  searchTerm: string,
  limit: number = 10
): TrafficEvent[] {
  return useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    const searchLower = searchTerm.toLowerCase();
    const results = events.filter(event => {
      const headline = event.headline?.toLowerCase() || '';
      const description = event.description?.toLowerCase() || '';
      
      // Calculate relevance score
      let score = 0;
      if (headline.includes(searchLower)) score += 2;
      if (description.includes(searchLower)) score += 1;
      
      return score > 0;
    });

    // Sort by relevance and return limited results
    return results
      .sort((a, b) => {
        // Prioritize headline matches
        const aInHeadline = a.headline?.toLowerCase().includes(searchLower) ? 1 : 0;
        const bInHeadline = b.headline?.toLowerCase().includes(searchLower) ? 1 : 0;
        return bInHeadline - aInHeadline;
      })
      .slice(0, limit);
  }, [events, searchTerm, limit]);
}

/**
 * Custom hook for event statistics
 */
export function useEventStatistics(events: TrafficEvent[]) {
  return useMemo(() => {
    const stats = {
      total: events.length,
      bySeverity: {} as Record<EventSeverity, number>,
      byType: {} as Record<EventType, number>,
      closures: 0,
      recentEvents: 0,
    };

    const now = Date.now();
    const recentThreshold = 30 * 60 * 1000; // 30 minutes

    events.forEach(event => {
      // Count by severity
      stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;

      // Count by type
      stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;

      // Count closures
      if (isRoadClosure(event)) {
        stats.closures++;
      }

      // Count recent events
      const eventTime = new Date(event.updated).getTime();
      if (now - eventTime < recentThreshold) {
        stats.recentEvents++;
      }
    });

    return stats;
  }, [events]);
}
