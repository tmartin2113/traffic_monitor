/**
 * Event Store - Zustand State Management
 * Manages traffic event data and related state
 * 
 * @module src/stores/eventStore
 * @version 1.0.0
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { shallow } from 'zustand/shallow';
import {
  TrafficEvent,
  EventType,
  EventSeverity,
  EventStatus,
  RoadState
} from '@/types/api.types';
import { EnhancedTrafficEvent, EventGroup, EventCluster, ImpactLevel } from '@/types/event.types';
import { MapCenter } from '@/types/map.types';
import { calculateDistance, isWithinBounds } from '@/utils/geoUtils';
import { isRoadClosure, getEventImpactLevel, sortEventsByPriority } from '@/utils/eventUtils';

/**
 * Event statistics interface
 */
interface EventStatistics {
  total: number;
  active: number;
  closures: number;
  incidents: number;
  construction: number;
  specialEvents: number;
  bySeverity: Record<EventSeverity, number>;
  byType: Record<EventType, number>;
  byStatus: Record<EventStatus, number>;
  recentEvents: number;
  criticalEvents: number;
  affectedAreas: string[];
  affectedRoads: string[];
  averageAge: number; // in minutes
  lastUpdateTime: Date | null;
}

/**
 * Event notification configuration
 */
interface NotificationConfig {
  enabled: boolean;
  closuresOnly: boolean;
  severityThreshold: EventSeverity;
  nearbyRadius: number; // in meters
  soundEnabled: boolean;
}

/**
 * Event store state interface
 */
interface EventStoreState {
  // Raw event data
  events: TrafficEvent[];
  enhancedEvents: EnhancedTrafficEvent[];
  
  // Event selection and highlighting
  selectedEvent: TrafficEvent | null;
  highlightedEventIds: Set<string>;
  
  // User interactions
  favoriteEventIds: Set<string>;
  hiddenEventIds: Set<string>;
  acknowledgedEventIds: Set<string>;
  
  // Event grouping and clustering
  eventGroups: EventGroup[];
  eventClusters: EventCluster[];
  
  // Loading and error states
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  lastFetchTime: Date | null;
  lastUpdateTime: Date | null;
  
  // Statistics
  statistics: EventStatistics;
  
  // Notifications
  notificationConfig: NotificationConfig;
  pendingNotifications: string[];
  
  // Cache management
  cacheValidUntil: Date | null;
  staleDataWarning: boolean;
}

/**
 * Event store actions interface
 */
interface EventStoreActions {
  // Event data management
  setEvents: (events: TrafficEvent[]) => void;
  updateEvent: (eventId: string, updates: Partial<TrafficEvent>) => void;
  removeEvent: (eventId: string) => void;
  clearEvents: () => void;
  
  // Event selection
  selectEvent: (event: TrafficEvent | null) => void;
  highlightEvents: (eventIds: string[]) => void;
  clearHighlights: () => void;
  
  // User interactions
  toggleFavorite: (eventId: string) => void;
  hideEvent: (eventId: string) => void;
  unhideEvent: (eventId: string) => void;
  acknowledgeEvent: (eventId: string) => void;
  clearAcknowledgements: () => void;
  
  // Batch operations
  hideBulk: (eventIds: string[]) => void;
  unhideAll: () => void;
  
  // Event enhancement and processing
  enhanceEvents: () => void;
  groupEvents: (groupBy: 'location' | 'type' | 'severity' | 'road') => void;
  clusterEvents: (zoomLevel: number, bounds: any) => void;
  
  // Filtering helpers
  getFilteredEvents: (filters: EventFilters) => TrafficEvent[];
  getNearbyEvents: (center: MapCenter, radiusMeters: number) => TrafficEvent[];
  getEventsByRoad: (roadName: string) => TrafficEvent[];
  getEventsByArea: (areaName: string) => TrafficEvent[];
  
  // Statistics
  updateStatistics: () => void;
  
  // Loading and error management
  setLoading: (isLoading: boolean) => void;
  setRefreshing: (isRefreshing: boolean) => void;
  setError: (error: Error | null) => void;
  
  // Notification management
  updateNotificationConfig: (config: Partial<NotificationConfig>) => void;
  checkForNotifications: (userLocation?: MapCenter) => void;
  dismissNotification: (eventId: string) => void;
  
  // Cache management
  setCacheValidity: (validUntil: Date) => void;
  invalidateCache: () => void;
  checkCacheValidity: () => boolean;
  
  // Utility actions
  reset: () => void;
  exportEvents: () => string;
  importEvents: (jsonData: string) => void;
}

/**
 * Event filters interface
 */
interface EventFilters {
  types?: EventType[];
  severities?: EventSeverity[];
  statuses?: EventStatus[];
  closuresOnly?: boolean;
  favoritesOnly?: boolean;
  excludeHidden?: boolean;
  searchTerm?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Initial state factory
 */
const createInitialState = (): EventStoreState => ({
  events: [],
  enhancedEvents: [],
  selectedEvent: null,
  highlightedEventIds: new Set(),
  favoriteEventIds: new Set(),
  hiddenEventIds: new Set(),
  acknowledgedEventIds: new Set(),
  eventGroups: [],
  eventClusters: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastFetchTime: null,
  lastUpdateTime: null,
  statistics: {
    total: 0,
    active: 0,
    closures: 0,
    incidents: 0,
    construction: 0,
    specialEvents: 0,
    bySeverity: {} as Record<EventSeverity, number>,
    byType: {} as Record<EventType, number>,
    byStatus: {} as Record<EventStatus, number>,
    recentEvents: 0,
    criticalEvents: 0,
    affectedAreas: [],
    affectedRoads: [],
    averageAge: 0,
    lastUpdateTime: null
  },
  notificationConfig: {
    enabled: true,
    closuresOnly: false,
    severityThreshold: EventSeverity.MAJOR,
    nearbyRadius: 5000,
    soundEnabled: false
  },
  pendingNotifications: [],
  cacheValidUntil: null,
  staleDataWarning: false
});

/**
 * Calculate event statistics
 */
const calculateStatistics = (events: TrafficEvent[]): EventStatistics => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);
  
  const stats: EventStatistics = {
    total: events.length,
    active: 0,
    closures: 0,
    incidents: 0,
    construction: 0,
    specialEvents: 0,
    bySeverity: {} as Record<EventSeverity, number>,
    byType: {} as Record<EventType, number>,
    byStatus: {} as Record<EventStatus, number>,
    recentEvents: 0,
    criticalEvents: 0,
    affectedAreas: [],
    affectedRoads: [],
    averageAge: 0,
    lastUpdateTime: now
  };

  const areas = new Set<string>();
  const roads = new Set<string>();
  let totalAge = 0;

  events.forEach(event => {
    // Count by status
    if (event.status === EventStatus.ACTIVE) {
      stats.active++;
    }
    stats.byStatus[event.status] = (stats.byStatus[event.status] || 0) + 1;

    // Count closures
    if (isRoadClosure(event)) {
      stats.closures++;
    }

    // Count by type
    stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;
    switch (event.event_type) {
      case EventType.INCIDENT:
        stats.incidents++;
        break;
      case EventType.CONSTRUCTION:
        stats.construction++;
        break;
      case EventType.SPECIAL_EVENT:
        stats.specialEvents++;
        break;
    }

    // Count by severity
    stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
    if (event.severity === EventSeverity.SEVERE) {
      stats.criticalEvents++;
    }

    // Check if recent
    const eventTime = new Date(event.updated || event.created);
    if (eventTime > oneHourAgo) {
      stats.recentEvents++;
    }

    // Calculate age
    totalAge += (now.getTime() - eventTime.getTime()) / 60000; // in minutes

    // Collect areas and roads
    event.areas?.forEach(area => areas.add(area.name));
    event.roads?.forEach(road => roads.add(road.name));
  });

  stats.affectedAreas = Array.from(areas).sort();
  stats.affectedRoads = Array.from(roads).sort();
  stats.averageAge = events.length > 0 ? Math.round(totalAge / events.length) : 0;

  return stats;
};

/**
 * Enhance events with computed properties
 */
const enhanceEvent = (event: TrafficEvent): EnhancedTrafficEvent => {
  const now = new Date();
  const eventTime = new Date(event.updated || event.created);
  const ageMinutes = (now.getTime() - eventTime.getTime()) / 60000;

  return {
    ...event,
    isClosure: isRoadClosure(event),
    isRecent: ageMinutes < 60,
    isStale: ageMinutes > 1440, // 24 hours
    primaryRoad: event.roads?.[0]?.name || 'Unknown Road',
    impactLevel: getEventImpactLevel(event),
    displayPriority: calculateDisplayPriority(event),
    estimatedDuration: estimateEventDuration(event)
  };
};

/**
 * Calculate display priority for event
 */
const calculateDisplayPriority = (event: TrafficEvent): number => {
  let priority = 0;

  // Severity weighting
  const severityWeights = {
    [EventSeverity.SEVERE]: 100,
    [EventSeverity.MAJOR]: 75,
    [EventSeverity.MODERATE]: 50,
    [EventSeverity.MINOR]: 25,
    [EventSeverity.UNKNOWN]: 10
  };
  priority += severityWeights[event.severity] || 0;

  // Closure bonus
  if (isRoadClosure(event)) {
    priority += 50;
  }

  // Recency bonus
  const ageMinutes = (Date.now() - new Date(event.updated || event.created).getTime()) / 60000;
  if (ageMinutes < 30) priority += 30;
  else if (ageMinutes < 60) priority += 20;
  else if (ageMinutes < 180) priority += 10;

  return priority;
};

/**
 * Estimate event duration based on type and severity
 */
const estimateEventDuration = (event: TrafficEvent): number => {
  // Base duration by type (in minutes)
  const baseDuration = {
    [EventType.INCIDENT]: 45,
    [EventType.CONSTRUCTION]: 240,
    [EventType.SPECIAL_EVENT]: 180,
    [EventType.ROAD_CONDITION]: 120,
    [EventType.WEATHER_CONDITION]: 90
  };

  // Severity multiplier
  const severityMultiplier = {
    [EventSeverity.SEVERE]: 2.0,
    [EventSeverity.MAJOR]: 1.5,
    [EventSeverity.MODERATE]: 1.0,
    [EventSeverity.MINOR]: 0.5,
    [EventSeverity.UNKNOWN]: 1.0
  };

  const base = baseDuration[event.event_type] || 60;
  const multiplier = severityMultiplier[event.severity] || 1.0;

  return Math.round(base * multiplier);
};

/**
 * Create the event store with Zustand
 */
export const useEventStore = create<EventStoreState & EventStoreActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          ...createInitialState(),

          // Event data management
          setEvents: (events) => set(state => {
            state.events = events;
            state.lastUpdateTime = new Date();
            state.staleDataWarning = false;
            // Trigger enhancement
            get().enhanceEvents();
            get().updateStatistics();
          }),

          updateEvent: (eventId, updates) => set(state => {
            const index = state.events.findIndex(e => e.id === eventId);
            if (index !== -1) {
              state.events[index] = { ...state.events[index], ...updates };
              get().enhanceEvents();
              get().updateStatistics();
            }
          }),

          removeEvent: (eventId) => set(state => {
            state.events = state.events.filter(e => e.id !== eventId);
            if (state.selectedEvent?.id === eventId) {
              state.selectedEvent = null;
            }
            state.highlightedEventIds.delete(eventId);
            get().enhanceEvents();
            get().updateStatistics();
          }),

          clearEvents: () => set(state => {
            state.events = [];
            state.enhancedEvents = [];
            state.selectedEvent = null;
            state.highlightedEventIds.clear();
            state.eventGroups = [];
            state.eventClusters = [];
            get().updateStatistics();
          }),

          // Event selection
          selectEvent: (event) => set(state => {
            state.selectedEvent = event;
            if (event) {
              state.highlightedEventIds.clear();
              state.highlightedEventIds.add(event.id);
            }
          }),

          highlightEvents: (eventIds) => set(state => {
            state.highlightedEventIds = new Set(eventIds);
          }),

          clearHighlights: () => set(state => {
            state.highlightedEventIds.clear();
          }),

          // User interactions
          toggleFavorite: (eventId) => set(state => {
            if (state.favoriteEventIds.has(eventId)) {
              state.favoriteEventIds.delete(eventId);
            } else {
              state.favoriteEventIds.add(eventId);
            }
          }),

          hideEvent: (eventId) => set(state => {
            state.hiddenEventIds.add(eventId);
            if (state.selectedEvent?.id === eventId) {
              state.selectedEvent = null;
            }
          }),

          unhideEvent: (eventId) => set(state => {
            state.hiddenEventIds.delete(eventId);
          }),

          acknowledgeEvent: (eventId) => set(state => {
            state.acknowledgedEventIds.add(eventId);
            // Remove from pending notifications
            state.pendingNotifications = state.pendingNotifications.filter(id => id !== eventId);
          }),

          clearAcknowledgements: () => set(state => {
            state.acknowledgedEventIds.clear();
          }),

          // Batch operations
          hideBulk: (eventIds) => set(state => {
            eventIds.forEach(id => state.hiddenEventIds.add(id));
          }),

          unhideAll: () => set(state => {
            state.hiddenEventIds.clear();
          }),

          // Event enhancement
          enhanceEvents: () => set(state => {
            state.enhancedEvents = state.events.map(enhanceEvent);
          }),

          // Event grouping
          groupEvents: (groupBy) => set(state => {
            const groups: Map<string, TrafficEvent[]> = new Map();
            
            state.events.forEach(event => {
              let key: string;
              
              switch (groupBy) {
                case 'type':
                  key = event.event_type;
                  break;
                case 'severity':
                  key = event.severity;
                  break;
                case 'road':
                  key = event.roads?.[0]?.name || 'Unknown';
                  break;
                case 'location':
                  key = event.areas?.[0]?.name || 'Unknown';
                  break;
                default:
                  key = 'Other';
              }
              
              if (!groups.has(key)) {
                groups.set(key, []);
              }
              groups.get(key)!.push(event);
            });

            state.eventGroups = Array.from(groups.entries()).map(([name, events]) => ({
              id: name,
              name,
              type: groupBy,
              events,
              count: events.length
            }));
          }),

          // Event clustering (simplified - full implementation would use clustering algorithm)
          clusterEvents: (zoomLevel, bounds) => set(state => {
            // This is a simplified clustering - production would use supercluster or similar
            const clusters: EventCluster[] = [];
            const processedEvents = new Set<string>();

            state.events.forEach(event => {
              if (processedEvents.has(event.id)) return;
              if (!event.geography?.coordinates) return;

              const cluster: EventCluster = {
                id: `cluster-${event.id}`,
                center: {
                  lat: event.geography.coordinates[1],
                  lng: event.geography.coordinates[0]
                },
                bounds: {
                  north: event.geography.coordinates[1],
                  south: event.geography.coordinates[1],
                  east: event.geography.coordinates[0],
                  west: event.geography.coordinates[0]
                },
                events: [event],
                count: 1,
                severityCounts: { [event.severity]: 1 } as any,
                typeCounts: { [event.event_type]: 1 } as any
              };

              processedEvents.add(event.id);
              clusters.push(cluster);
            });

            state.eventClusters = clusters;
          }),

          // Filtering helpers
          getFilteredEvents: (filters) => {
            const state = get();
            let filtered = [...state.events];

            if (filters.types?.length) {
              filtered = filtered.filter(e => filters.types!.includes(e.event_type));
            }
            if (filters.severities?.length) {
              filtered = filtered.filter(e => filters.severities!.includes(e.severity));
            }
            if (filters.statuses?.length) {
              filtered = filtered.filter(e => filters.statuses!.includes(e.status));
            }
            if (filters.closuresOnly) {
              filtered = filtered.filter(isRoadClosure);
            }
            if (filters.favoritesOnly) {
              filtered = filtered.filter(e => state.favoriteEventIds.has(e.id));
            }
            if (filters.excludeHidden) {
              filtered = filtered.filter(e => !state.hiddenEventIds.has(e.id));
            }
            if (filters.searchTerm) {
              const term = filters.searchTerm.toLowerCase();
              filtered = filtered.filter(e =>
                e.headline?.toLowerCase().includes(term) ||
                e.description?.toLowerCase().includes(term) ||
                e.roads?.some(r => r.name?.toLowerCase().includes(term))
              );
            }
            if (filters.startDate) {
              filtered = filtered.filter(e =>
                new Date(e.created) >= filters.startDate!
              );
            }
            if (filters.endDate) {
              filtered = filtered.filter(e =>
                new Date(e.created) <= filters.endDate!
              );
            }

            return filtered;
          },

          getNearbyEvents: (center, radiusMeters) => {
            return get().events.filter(event => {
              if (!event.geography?.coordinates) return false;
              const distance = calculateDistance(
                center,
                { lat: event.geography.coordinates[1], lng: event.geography.coordinates[0] }
              );
              return distance <= radiusMeters;
            });
          },

          getEventsByRoad: (roadName) => {
            const term = roadName.toLowerCase();
            return get().events.filter(event =>
              event.roads?.some(road => road.name?.toLowerCase().includes(term))
            );
          },

          getEventsByArea: (areaName) => {
            const term = areaName.toLowerCase();
            return get().events.filter(event =>
              event.areas?.some(area => area.name?.toLowerCase().includes(term))
            );
          },

          // Statistics
          updateStatistics: () => set(state => {
            state.statistics = calculateStatistics(state.events);
          }),

          // Loading and error management
          setLoading: (isLoading) => set({ isLoading }),
          setRefreshing: (isRefreshing) => set({ isRefreshing }),
          setError: (error) => set({ error }),

          // Notification management
          updateNotificationConfig: (config) => set(state => {
            state.notificationConfig = { ...state.notificationConfig, ...config };
          }),

          checkForNotifications: (userLocation) => set(state => {
            if (!state.notificationConfig.enabled) return;

            const newNotifications: string[] = [];
            const recentThreshold = Date.now() - 300000; // 5 minutes

            state.events.forEach(event => {
              // Skip if already acknowledged
              if (state.acknowledgedEventIds.has(event.id)) return;
              // Skip if already in pending
              if (state.pendingNotifications.includes(event.id)) return;
              // Skip if not recent
              if (new Date(event.created).getTime() < recentThreshold) return;

              // Check severity threshold
              const severityLevels = [
                EventSeverity.MINOR,
                EventSeverity.MODERATE,
                EventSeverity.MAJOR,
                EventSeverity.SEVERE
              ];
              const eventLevel = severityLevels.indexOf(event.severity);
              const thresholdLevel = severityLevels.indexOf(state.notificationConfig.severityThreshold);
              if (eventLevel < thresholdLevel) return;

              // Check if closure-only filter
              if (state.notificationConfig.closuresOnly && !isRoadClosure(event)) return;

              // Check proximity if location provided
              if (userLocation && event.geography?.coordinates) {
                const distance = calculateDistance(
                  userLocation,
                  { lat: event.geography.coordinates[1], lng: event.geography.coordinates[0] }
                );
                if (distance > state.notificationConfig.nearbyRadius) return;
              }

              newNotifications.push(event.id);
            });

            if (newNotifications.length > 0) {
              state.pendingNotifications = [...state.pendingNotifications, ...newNotifications];
            }
          }),

          dismissNotification: (eventId) => set(state => {
            state.pendingNotifications = state.pendingNotifications.filter(id => id !== eventId);
            state.acknowledgedEventIds.add(eventId);
          }),

          // Cache management
          setCacheValidity: (validUntil) => set({ cacheValidUntil: validUntil }),
          
          invalidateCache: () => set({
            cacheValidUntil: null,
            staleDataWarning: true
          }),

          checkCacheValidity: () => {
            const { cacheValidUntil } = get();
            if (!cacheValidUntil) return false;
            return new Date() < cacheValidUntil;
          },

          // Utility actions
          reset: () => set(createInitialState()),

          exportEvents: () => {
            const state = get();
            const exportData = {
              events: state.events,
              favorites: Array.from(state.favoriteEventIds),
              hidden: Array.from(state.hiddenEventIds),
              timestamp: new Date().toISOString(),
              version: '1.0.0'
            };
            return JSON.stringify(exportData, null, 2);
          },

          importEvents: (jsonData) => {
            try {
              const data = JSON.parse(jsonData);
              set(state => {
                if (data.events) state.events = data.events;
                if (data.favorites) state.favoriteEventIds = new Set(data.favorites);
                if (data.hidden) state.hiddenEventIds = new Set(data.hidden);
              });
              get().enhanceEvents();
              get().updateStatistics();
            } catch (error) {
              console.error('Failed to import events:', error);
              set({ error: error as Error });
            }
          }
        }))
      ),
      {
        name: 'event-store',
        partialize: (state) => ({
          favoriteEventIds: Array.from(state.favoriteEventIds),
          hiddenEventIds: Array.from(state.hiddenEventIds),
          acknowledgedEventIds: Array.from(state.acknowledgedEventIds),
          notificationConfig: state.notificationConfig
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Convert arrays back to Sets after rehydration
            state.favoriteEventIds = new Set(state.favoriteEventIds as any);
            state.hiddenEventIds = new Set(state.hiddenEventIds as any);
            state.acknowledgedEventIds = new Set(state.acknowledgedEventIds as any);
            state.highlightedEventIds = new Set();
          }
        }
      }
    ),
    {
      name: 'EventStore'
    }
  )
);

// Selector hooks for optimized re-renders
export const useEvents = () => useEventStore(state => state.events);
export const useSelectedEvent = () => useEventStore(state => state.selectedEvent);
export const useFavoriteEvents = () => useEventStore(state => 
  state.events.filter(e => state.favoriteEventIds.has(e.id))
);
export const useEventStatistics = () => useEventStore(state => state.statistics);
export const useIsLoadingEvents = () => useEventStore(state => state.isLoading);
export const useEventError = () => useEventStore(state => state.error);
export const usePendingNotifications = () => useEventStore(state =>
  state.events.filter(e => state.pendingNotifications.includes(e.id))
);
