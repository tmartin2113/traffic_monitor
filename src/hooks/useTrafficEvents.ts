/**
 * useTrafficEvents Hook with Differential Updates
 * Production-ready React hook for managing traffic events with intelligent synchronization
 * 
 * @module hooks/useTrafficEvents
 * @version 2.0.0
 */

import { useQuery, useQueryClient, useMutation, UseQueryResult } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  trafficAPI, 
  TrafficAPIError,
  DifferentialResponse,
  SyncState 
} from '@services/api/trafficApi';
import { differentialSync, SyncResult, SyncProgress } from '@services/sync/DifferentialSync';
import { rateLimiter } from '@services/rateLimit/RateLimiter';
import { cacheManager } from '@services/cache/CacheManager';
import { useEventStore } from '@stores/eventStore';
import {
  TrafficEvent,
  EventType,
  EventSeverity,
  RoadState
} from '@types/api.types';
import type { FilterState } from '@types/filter.types';
import { POLLING_CONFIG, SYNC_CONFIG } from '@utils/constants';
import { isPointInBounds, isLineIntersectsBounds } from '@utils/geoUtils';

// ============================================================================
// Type Definitions
// ============================================================================

export interface UseTrafficEventsOptions {
  enabled?: boolean;
  pollingInterval?: number;
  staleTime?: number;
  useDifferential?: boolean;
  enableRealtime?: boolean;
  prefetchRelated?: boolean;
  optimisticUpdates?: boolean;
  retryOnError?: boolean;
  onSyncProgress?: (progress: SyncProgress) => void;
  onSyncComplete?: (result: SyncResult) => void;
  onError?: (error: TrafficAPIError) => void;
}

export interface UseTrafficEventsResult {
  // Event data
  events: TrafficEvent[];
  filteredEvents: TrafficEvent[];
  closureEvents: TrafficEvent[];
  criticalEvents: TrafficEvent[];
  
  // State flags
  isLoading: boolean;
  isError: boolean;
  isSyncing: boolean;
  isStale: boolean;
  
  // Error and sync info
  error: TrafficAPIError | null;
  syncState: SyncState | null;
  lastSyncResult: SyncResult | null;
  
  // Actions
  refetch: () => Promise<void>;
  forceFullSync: () => Promise<void>;
  retryFailedSync: () => Promise<void>;
  clearCache: () => Promise<void>;
  
  // Rate limiting
  rateLimitInfo: RateLimitInfo;
  
  // Timestamps
  lastUpdated: Date | null;
  nextUpdateIn: number | null;
  
  // Statistics
  statistics: EventStatistics;
}

export interface RateLimitInfo {
  remaining: number;
  total: number;
  resetTime: Date | null;
  willReset: string | null;
}

export interface EventStatistics {
  total: number;
  active: number;
  closures: number;
  incidents: number;
  construction: number;
  bySeverity: Record<EventSeverity, number>;
  byType: Record<EventType, number>;
  recentlyUpdated: number;
  averageAge: number;
  dataQuality: number;
}

interface SyncMetadata {
  lastFullSync: Date | null;
  lastDifferentialSync: Date | null;
  syncCount: number;
  failureCount: number;
  averageSyncTime: number;
  totalDataTransferred: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if event is a road closure
 */
function isRoadClosure(event: TrafficEvent): boolean {
  return (
    event.roads?.some(road => road.state === RoadState.CLOSED) ||
    event.event_type === EventType.ROAD_CLOSURE ||
    event.event_subtypes?.includes('road-closure') ||
    event.headline?.toLowerCase().includes('closed') ||
    event.description?.toLowerCase().includes('closed') ||
    false
  );
}

/**
 * Check if event is critical severity
 */
function isCriticalEvent(event: TrafficEvent): boolean {
  return event.severity === EventSeverity.SEVERE ||
         event.severity === EventSeverity.MAJOR ||
         isRoadClosure(event);
}

/**
 * Calculate event age in minutes
 */
function getEventAge(event: TrafficEvent): number {
  const updated = new Date(event.updated).getTime();
  const now = Date.now();
  return Math.floor((now - updated) / 60000);
}

/**
 * Sort events by priority and severity
 */
function sortEvents(events: TrafficEvent[], sortBy: string = 'severity'): TrafficEvent[] {
  return [...events].sort((a, b) => {
    // Always prioritize closures
    const aIsClosure = isRoadClosure(a);
    const bIsClosure = isRoadClosure(b);
    if (aIsClosure && !bIsClosure) return -1;
    if (!aIsClosure && bIsClosure) return 1;

    switch (sortBy) {
      case 'severity': {
        const severityOrder = [
          EventSeverity.SEVERE,
          EventSeverity.MAJOR,
          EventSeverity.MODERATE,
          EventSeverity.MINOR
        ];
        return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
      }
      
      case 'updated': {
        return new Date(b.updated).getTime() - new Date(a.updated).getTime();
      }
      
      case 'created': {
        return new Date(b.created).getTime() - new Date(a.created).getTime();
      }
      
      case 'type': {
        return a.event_type.localeCompare(b.event_type);
      }
      
      default:
        return 0;
    }
  });
}

/**
 * Apply filters to events
 */
function applyFilters(events: TrafficEvent[], filters: FilterState): TrafficEvent[] {
  let filtered = [...events];

  // Filter by closure status
  if (filters.closuresOnly) {
    filtered = filtered.filter(isRoadClosure);
  }

  // Filter by active status
  if (filters.activeOnly) {
    filtered = filtered.filter(event => event.status === 'ACTIVE');
  }

  // Filter by event type
  if (filters.eventType && filters.eventType !== 'ALL') {
    filtered = filtered.filter(event => event.event_type === filters.eventType);
  }

  // Filter by severity
  if (filters.severity && filters.severity !== 'ALL') {
    filtered = filtered.filter(event => event.severity === filters.severity);
  }

  // Filter by severity levels (multiple)
  if (filters.severityLevels && filters.severityLevels.length > 0) {
    filtered = filtered.filter(event =>
      filters.severityLevels!.includes(event.severity)
    );
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
      ) ||
      false
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

  // Filter by recency
  if (filters.recentOnly) {
    const threshold = Date.now() - (filters.recentHours || 24) * 3600000;
    filtered = filtered.filter(event =>
      new Date(event.updated).getTime() > threshold
    );
  }

  // Apply custom filter function if provided
  if (filters.customFilter) {
    filtered = filtered.filter(filters.customFilter);
  }

  return sortEvents(filtered, filters.sortBy || 'severity');
}

/**
 * Calculate event statistics
 */
function calculateStatistics(events: TrafficEvent[]): EventStatistics {
  const now = Date.now();
  const recentThreshold = now - 3600000; // 1 hour
  
  const stats: EventStatistics = {
    total: events.length,
    active: 0,
    closures: 0,
    incidents: 0,
    construction: 0,
    bySeverity: {
      [EventSeverity.MINOR]: 0,
      [EventSeverity.MODERATE]: 0,
      [EventSeverity.MAJOR]: 0,
      [EventSeverity.SEVERE]: 0
    },
    byType: {} as Record<EventType, number>,
    recentlyUpdated: 0,
    averageAge: 0,
    dataQuality: 100
  };

  let totalAge = 0;
  let missingDataPoints = 0;

  for (const event of events) {
    // Status counts
    if (event.status === 'ACTIVE') stats.active++;
    
    // Type counts
    if (isRoadClosure(event)) stats.closures++;
    if (event.event_type === EventType.INCIDENT) stats.incidents++;
    if (event.event_type === EventType.CONSTRUCTION) stats.construction++;
    
    // Severity counts
    stats.bySeverity[event.severity]++;
    
    // Type counts
    stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;
    
    // Recent updates
    if (new Date(event.updated).getTime() > recentThreshold) {
      stats.recentlyUpdated++;
    }
    
    // Age calculation
    const age = getEventAge(event);
    totalAge += age;
    
    // Data quality checks
    if (!event.headline) missingDataPoints++;
    if (!event.description) missingDataPoints++;
    if (!event.geography) missingDataPoints++;
    if (!event.roads || event.roads.length === 0) missingDataPoints++;
  }

  // Calculate averages
  stats.averageAge = events.length > 0 ? Math.floor(totalAge / events.length) : 0;
  stats.dataQuality = Math.max(
    0,
    100 - Math.floor((missingDataPoints / Math.max(1, events.length * 4)) * 100)
  );

  return stats;
}

// ============================================================================
// Main Hook Implementation
// ============================================================================

export function useTrafficEvents(
  apiKey: string | null,
  filters: FilterState,
  options: UseTrafficEventsOptions = {}
): UseTrafficEventsResult {
  const queryClient = useQueryClient();
  const eventStore = useEventStore();
  
  // Options with defaults
  const {
    enabled = true,
    pollingInterval = POLLING_CONFIG.DEFAULT_INTERVAL_MS,
    staleTime = SYNC_CONFIG.STALE_TIME_MS || 30000,
    useDifferential = true,
    enableRealtime = false,
    prefetchRelated = true,
    optimisticUpdates = true,
    retryOnError = true,
    onSyncProgress,
    onSyncComplete,
    onError
  } = options;

  // State management
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [syncMetadata, setSyncMetadata] = useState<SyncMetadata>({
    lastFullSync: null,
    lastDifferentialSync: null,
    syncCount: 0,
    failureCount: 0,
    averageSyncTime: 0,
    totalDataTransferred: 0
  });

  // Refs for tracking
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncTimestampRef = useRef<string | null>(null);
  const failedSyncAttemptsRef = useRef(0);
  const realtimeConnectionRef = useRef<WebSocket | null>(null);

  // Initialize API with key
  useEffect(() => {
    if (apiKey) {
      trafficAPI.setApiKey(apiKey);
    }
  }, [apiKey]);

  // ============================================================================
  // Query Definitions
  // ============================================================================

  /**
   * Main query for fetching events
   */
  const eventsQuery = useQuery({
    queryKey: ['traffic-events', apiKey, filters.eventType, filters.severity],
    queryFn: async () => {
      if (!apiKey) {
        throw new TrafficAPIError('API key is required', 'MISSING_API_KEY');
      }

      const startTime = Date.now();
      
      try {
        // Check if we should use differential sync
        const syncState = trafficAPI.getSyncState();
        const shouldUseDifferential = useDifferential && 
                                     syncState.lastSyncTimestamp &&
                                     syncState.totalEvents > 0;

        let events: TrafficEvent[];
        let dataSize = 0;

        if (shouldUseDifferential) {
          // Fetch differential updates
          const differential = await trafficAPI.fetchDifferentialUpdates({
            api_key: apiKey,
            event_type: filters.eventType as EventType,
            severity: filters.severity as EventSeverity,
            since: syncState.lastSyncTimestamp
          });

          dataSize = differential.metadata.totalChanges * 1024; // Estimate

          if (differential.hasChanges) {
            // Apply differential to current state
            const currentEvents = queryClient.getQueryData<TrafficEvent[]>(
              ['traffic-events', apiKey, filters.eventType, filters.severity]
            ) || [];

            const syncResult = await applyDifferentialToEvents(
              currentEvents,
              differential,
              onSyncProgress
            );

            setLastSyncResult(syncResult);
            
            if (onSyncComplete) {
              onSyncComplete(syncResult);
            }

            events = syncResult.success ? 
              eventStore.getAllEvents() : 
              currentEvents;

            // Update sync metadata
            setSyncMetadata(prev => ({
              ...prev,
              lastDifferentialSync: new Date(),
              syncCount: prev.syncCount + 1,
              totalDataTransferred: prev.totalDataTransferred + dataSize
            }));
          } else {
            // No changes, return cached events
            events = queryClient.getQueryData<TrafficEvent[]>(
              ['traffic-events', apiKey, filters.eventType, filters.severity]
            ) || [];
          }
        } else {
          // Full sync
          events = await trafficAPI.fetchGeofencedEvents({
            api_key: apiKey,
            event_type: filters.eventType as EventType,
            severity: filters.severity as EventSeverity
          });

          dataSize = JSON.stringify(events).length;

          // Store in event store
          eventStore.setEvents(events);
          
          // Update sync metadata
          setSyncMetadata(prev => ({
            ...prev,
            lastFullSync: new Date(),
            syncCount: prev.syncCount + 1,
            totalDataTransferred: prev.totalDataTransferred + dataSize
          }));
        }

        // Update average sync time
        const syncTime = Date.now() - startTime;
        setSyncMetadata(prev => ({
          ...prev,
          averageSyncTime: prev.syncCount > 0 
            ? (prev.averageSyncTime * (prev.syncCount - 1) + syncTime) / prev.syncCount
            : syncTime
        }));

        // Reset failure counter on success
        failedSyncAttemptsRef.current = 0;

        return events;
      } catch (error) {
        failedSyncAttemptsRef.current++;
        
        setSyncMetadata(prev => ({
          ...prev,
          failureCount: prev.failureCount + 1
        }));

        if (onError && error instanceof TrafficAPIError) {
          onError(error);
        }

        throw error;
      }
    },
    enabled: Boolean(apiKey) && enabled,
    staleTime,
    gcTime: 300000, // 5 minutes
    refetchInterval: enabled && !isSyncing ? pollingInterval : false,
    refetchIntervalInBackground: true,
    retry: retryOnError ? 3 : false,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  /**
   * Mutation for force full sync
   */
  const forceFullSyncMutation = useMutation({
    mutationFn: async () => {
      if (!apiKey) throw new Error('API key required');
      
      setIsSyncing(true);
      
      // Clear cache and sync state
      await trafficAPI.clearCache();
      eventStore.clearEvents();
      
      // Fetch fresh data
      const events = await trafficAPI.fetchGeofencedEvents({
        api_key: apiKey,
        event_type: filters.eventType as EventType,
        severity: filters.severity as EventSeverity
      });
      
      eventStore.setEvents(events);
      
      return events;
    },
    onSuccess: (events) => {
      queryClient.setQueryData(
        ['traffic-events', apiKey, filters.eventType, filters.severity],
        events
      );
      
      setSyncMetadata(prev => ({
        ...prev,
        lastFullSync: new Date(),
        syncCount: prev.syncCount + 1
      }));
    },
    onError: (error) => {
      if (onError && error instanceof TrafficAPIError) {
        onError(error);
      }
    },
    onSettled: () => {
      setIsSyncing(false);
    }
  });

  // ============================================================================
  // Differential Sync Handler
  // ============================================================================

  /**
   * Apply differential updates to events
   */
  async function applyDifferentialToEvents(
    currentEvents: TrafficEvent[],
    differential: DifferentialResponse,
    progressCallback?: (progress: SyncProgress) => void
  ): Promise<SyncResult> {
    const syncEngine = differentialSync;
    
    // Configure sync options
    syncEngine['eventStore'] = eventStore;
    
    if (progressCallback) {
      syncEngine['options'].onProgress = progressCallback;
    }

    // Apply differential
    const result = await syncEngine.applyDifferential(differential, {
      atomic: true,
      validateFirst: true
    });

    return result;
  }

  // ============================================================================
  // Realtime Updates (WebSocket)
  // ============================================================================

  useEffect(() => {
    if (!enableRealtime || !apiKey) return;

    const connectRealtime = () => {
      const wsUrl = `${SYNC_CONFIG.WEBSOCKET_URL || 'wss://api.511.org/ws'}?api_key=${apiKey}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Realtime connection established');
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'differential') {
            const differential = data.payload as DifferentialResponse;
            
            // Apply differential immediately
            const currentEvents = queryClient.getQueryData<TrafficEvent[]>(
              ['traffic-events', apiKey, filters.eventType, filters.severity]
            ) || [];

            const result = await applyDifferentialToEvents(
              currentEvents,
              differential
            );

            if (result.success) {
              const newEvents = eventStore.getAllEvents();
              queryClient.setQueryData(
                ['traffic-events', apiKey, filters.eventType, filters.severity],
                newEvents
              );
            }
          } else if (data.type === 'event-update') {
            // Handle single event update
            const updatedEvent = data.payload as TrafficEvent;
            
            if (optimisticUpdates) {
              eventStore.updateEvent(updatedEvent);
              queryClient.invalidateQueries({
                queryKey: ['traffic-events']
              });
            }
          }
        } catch (error) {
          console.error('Failed to process realtime update:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('Realtime connection closed, reconnecting...');
        setTimeout(connectRealtime, 5000);
      };

      realtimeConnectionRef.current = ws;
    };

    connectRealtime();

    return () => {
      if (realtimeConnectionRef.current) {
        realtimeConnectionRef.current.close();
        realtimeConnectionRef.current = null;
      }
    };
  }, [enableRealtime, apiKey, queryClient, eventStore, optimisticUpdates, filters]);

  // ============================================================================
  // Prefetching Related Data
  // ============================================================================

  useEffect(() => {
    if (!prefetchRelated || !eventsQuery.data || eventsQuery.data.length === 0) {
      return;
    }

    // Prefetch details for critical events
    const criticalEvents = eventsQuery.data.filter(isCriticalEvent);
    
    criticalEvents.slice(0, 5).forEach(event => {
      queryClient.prefetchQuery({
        queryKey: ['event-details', event.id],
        queryFn: () => trafficAPI.getEventById(event.id),
        staleTime: 60000
      });
    });
  }, [eventsQuery.data, prefetchRelated, queryClient]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const events = eventsQuery.data || [];
  const filteredEvents = useMemo(() => applyFilters(events, filters), [events, filters]);
  const closureEvents = useMemo(() => filteredEvents.filter(isRoadClosure), [filteredEvents]);
  const criticalEvents = useMemo(() => filteredEvents.filter(isCriticalEvent), [filteredEvents]);
  const statistics = useMemo(() => calculateStatistics(filteredEvents), [filteredEvents]);

  // Rate limit info
  const rateLimitInfo = useMemo((): RateLimitInfo => {
    const info = rateLimiter.getInfo();
    const resetTime = info.resetTime ? new Date(info.resetTime) : null;
    
    return {
      remaining: info.remaining,
      total: 60,
      resetTime,
      willReset: resetTime ? 
        `${Math.ceil((resetTime.getTime() - Date.now()) / 60000)} minutes` : 
        null
    };
  }, [events]);

  // Next update timing
  const nextUpdateIn = useMemo(() => {
    if (!enabled || !eventsQuery.dataUpdatedAt) return null;
    
    const nextUpdate = eventsQuery.dataUpdatedAt + pollingInterval;
    const remaining = Math.max(0, nextUpdate - Date.now());
    
    return Math.ceil(remaining / 1000); // seconds
  }, [enabled, eventsQuery.dataUpdatedAt, pollingInterval]);

  // Sync state
  const syncState = useMemo(() => trafficAPI.getSyncState(), [events]);

  // ============================================================================
  // Actions
  // ============================================================================

  const refetch = useCallback(async () => {
    await eventsQuery.refetch();
  }, [eventsQuery]);

  const forceFullSync = useCallback(async () => {
    await forceFullSyncMutation.mutateAsync();
  }, [forceFullSyncMutation]);

  const retryFailedSync = useCallback(async () => {
    if (lastSyncResult?.failed && lastSyncResult.failed.length > 0) {
      // Retry only failed operations
      const retryableFailures = lastSyncResult.failed.filter(f => f.retryable);
      
      if (retryableFailures.length > 0) {
        await refetch();
      }
    }
  }, [lastSyncResult, refetch]);

  const clearCache = useCallback(async () => {
    await cacheManager.clear();
    await trafficAPI.clearCache();
    queryClient.removeQueries({ queryKey: ['traffic-events'] });
    eventStore.clearEvents();
  }, [queryClient, eventStore]);

  // ============================================================================
  // Return Result
  // ============================================================================

  return {
    // Event data
    events,
    filteredEvents,
    closureEvents,
    criticalEvents,
    
    // State flags
    isLoading: eventsQuery.isLoading || isSyncing,
    isError: eventsQuery.isError,
    isSyncing,
    isStale: eventsQuery.isStale,
    
    // Error and sync info
    error: eventsQuery.error as TrafficAPIError | null,
    syncState,
    lastSyncResult,
    
    // Actions
    refetch,
    forceFullSync,
    retryFailedSync,
    clearCache,
    
    // Rate limiting
    rateLimitInfo,
    
    // Timestamps
    lastUpdated: eventsQuery.dataUpdatedAt ? new Date(eventsQuery.dataUpdatedAt) : null,
    nextUpdateIn,
    
    // Statistics
    statistics
  };
}

// ============================================================================
// Export Additional Utilities
// ============================================================================

export {
  isRoadClosure,
  isCriticalEvent,
  getEventAge,
  sortEvents,
  applyFilters,
  calculateStatistics
};
