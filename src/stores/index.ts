/**
 * Stores Barrel Export
 * Central export point for all Zustand state management stores
 * 
 * @module src/stores/index
 * @version 1.0.0
 */

// ============================================
// Store Exports
// ============================================

/**
 * Event Store - Manages traffic events and notifications
 */
export {
  useEventStore,
  // Selector hooks
  useEvents,
  useSelectedEvent,
  useFavoriteEvents,
  useEventStatistics,
  useIsLoadingEvents,
  useEventError,
  usePendingNotifications
} from './eventStore';

/**
 * Filter Store - Manages filter state and presets
 */
export {
  useFilterStore,
  // Selector hooks
  useFilters,
  useAdvancedFilters,
  useQuickFilters,
  useSavedFilters,
  useFilterPresets,
  useActiveFilterCount,
  useFilterSummary,
  useHasActiveFilters
} from './filterStore';

/**
 * Map Store - Manages map view state and interactions
 */
export {
  useMapStore,
  // Selector hooks
  useMapCenter,
  useMapZoom,
  useMapBounds,
  useUserLocation,
  useMapSettings,
  useMarkerConfig,
  useOverlayConfig,
  useSavedLocations,
  useIsLocating,
  useMapInstance
} from './mapStore';

// ============================================
// Combined Store Hooks
// ============================================

import { useEventStore } from './eventStore';
import { useFilterStore } from './filterStore';
import { useMapStore } from './mapStore';
import { shallow } from 'zustand/shallow';
import { useMemo, useCallback } from 'react';

/**
 * Combined hook for filtered events based on current filter state
 */
export const useFilteredEvents = () => {
  const events = useEventStore(state => state.events);
  const filters = useFilterStore(state => state.filters);
  const getFilteredEvents = useEventStore(state => state.getFilteredEvents);
  
  return useMemo(() => {
    return getFilteredEvents({
      types: filters.eventType ? [filters.eventType] : undefined,
      severities: filters.severity ? [filters.severity] : undefined,
      closuresOnly: filters.closuresOnly,
      searchTerm: filters.searchTerm,
      startDate: filters.dateRange?.start || undefined,
      endDate: filters.dateRange?.end || undefined,
      excludeHidden: true
    });
  }, [events, filters, getFilteredEvents]);
};

/**
 * Combined hook for events within map bounds
 */
export const useVisibleEvents = () => {
  const events = useFilteredEvents();
  const bounds = useMapStore(state => state.bounds);
  const isInBounds = useMapStore(state => state.isInBounds);
  
  return useMemo(() => {
    if (!bounds) return events;
    
    return events.filter(event => {
      if (!event.geography?.coordinates) return false;
      const point = {
        lat: event.geography.coordinates[1],
        lng: event.geography.coordinates[0]
      };
      return isInBounds(point, bounds);
    });
  }, [events, bounds, isInBounds]);
};

/**
 * Combined hook for nearby events based on user location
 */
export const useNearbyEvents = (radiusMeters: number = 5000) => {
  const events = useFilteredEvents();
  const userLocation = useMapStore(state => state.userLocation);
  const getNearbyEvents = useEventStore(state => state.getNearbyEvents);
  
  return useMemo(() => {
    if (!userLocation) return [];
    return getNearbyEvents(userLocation, radiusMeters);
  }, [events, userLocation, radiusMeters, getNearbyEvents]);
};

/**
 * Combined hook for app loading state
 */
export const useAppLoadingState = () => {
  const isLoadingEvents = useEventStore(state => state.isLoading);
  const isLocating = useMapStore(state => state.isLocating);
  
  return {
    isLoading: isLoadingEvents || isLocating,
    isLoadingEvents,
    isLocating
  };
};

/**
 * Combined hook for all error states
 */
export const useAppErrors = () => {
  const eventError = useEventStore(state => state.error);
  const locationError = useMapStore(state => state.locationError);
  
  return {
    hasErrors: Boolean(eventError || locationError),
    eventError,
    locationError,
    allErrors: [eventError, locationError].filter(Boolean)
  };
};

/**
 * Combined hook for app statistics
 */
export const useAppStatistics = () => {
  const eventStats = useEventStore(state => state.statistics);
  const filterCount = useFilterStore(state => state.getActiveFilterCount());
  const savedLocationsCount = useMapStore(state => state.savedLocations.length);
  
  return {
    events: eventStats,
    activeFilters: filterCount,
    savedLocations: savedLocationsCount,
    summary: {
      totalEvents: eventStats.total,
      activeEvents: eventStats.active,
      closures: eventStats.closures,
      criticalEvents: eventStats.criticalEvents,
      recentEvents: eventStats.recentEvents,
      activeFilters: filterCount,
      savedLocations: savedLocationsCount
    }
  };
};

// ============================================
// Store Actions Combinations
// ============================================

/**
 * Combined actions for resetting all stores
 */
export const useResetAllStores = () => {
  const resetEvents = useEventStore(state => state.reset);
  const resetFilters = useFilterStore(state => state.resetFilters);
  const resetMap = useMapStore(state => state.reset);
  
  return useCallback(() => {
    resetEvents();
    resetFilters();
    resetMap();
  }, [resetEvents, resetFilters, resetMap]);
};

/**
 * Combined actions for focusing on filtered events
 */
export const useFocusFilteredEvents = () => {
  const filteredEvents = useFilteredEvents();
  const focusOnEvents = useMapStore(state => state.focusOnEvents);
  
  return useCallback(() => {
    if (filteredEvents.length > 0) {
      focusOnEvents(filteredEvents);
    }
  }, [filteredEvents, focusOnEvents]);
};

/**
 * Combined actions for selecting and focusing on an event
 */
export const useSelectAndFocusEvent = () => {
  const selectEvent = useEventStore(state => state.selectEvent);
  const focusOnEvent = useMapStore(state => state.focusOnEvent);
  
  return useCallback((event: any) => {
    selectEvent(event);
    focusOnEvent(event);
  }, [selectEvent, focusOnEvent]);
};

// ============================================
// Store Persistence Utilities
// ============================================

/**
 * Export all store data for backup
 */
export const useExportAllData = () => {
  const exportEvents = useEventStore(state => state.exportEvents);
  const exportFilters = useFilterStore(state => state.exportFilters);
  const exportMap = useMapStore(state => state.exportMapData);
  
  return useCallback(() => {
    const data = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      events: JSON.parse(exportEvents()),
      filters: JSON.parse(exportFilters()),
      map: JSON.parse(exportMap())
    };
    return JSON.stringify(data, null, 2);
  }, [exportEvents, exportFilters, exportMap]);
};

/**
 * Import all store data from backup
 */
export const useImportAllData = () => {
  const importEvents = useEventStore(state => state.importEvents);
  const importFilters = useFilterStore(state => state.importFilters);
  const importMap = useMapStore(state => state.importMapData);
  
  return useCallback((jsonData: string) => {
    try {
      const data = JSON.parse(jsonData);
      
      let success = true;
      if (data.events) {
        success = success && importEvents(JSON.stringify(data.events));
      }
      if (data.filters) {
        success = success && importFilters(JSON.stringify(data.filters));
      }
      if (data.map) {
        success = success && importMap(JSON.stringify(data.map));
      }
      
      return success;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }, [importEvents, importFilters, importMap]);
};

// ============================================
// Store Subscription Utilities
// ============================================

/**
 * Subscribe to critical changes across all stores
 */
export const useCriticalChangesSubscription = (
  callback: (changes: any) => void
) => {
  // Subscribe to critical event changes
  useEventStore.subscribe(
    state => ({
      closures: state.statistics.closures,
      criticalEvents: state.statistics.criticalEvents,
      newNotifications: state.pendingNotifications.length
    }),
    callback,
    { equalityFn: shallow }
  );
  
  // Subscribe to filter changes
  useFilterStore.subscribe(
    state => state.filters,
    callback,
    { equalityFn: shallow }
  );
  
  // Subscribe to location changes
  useMapStore.subscribe(
    state => state.userLocation,
    callback
  );
};

// ============================================
// Development Utilities (Remove in Production)
// ============================================

if (import.meta.env.DEV) {
  // Store debugging utilities
  (window as any).__STORES__ = {
    event: useEventStore,
    filter: useFilterStore,
    map: useMapStore,
    
    // Debug helpers
    getState: () => ({
      event: useEventStore.getState(),
      filter: useFilterStore.getState(),
      map: useMapStore.getState()
    }),
    
    // Test helpers
    reset: () => {
      useEventStore.getState().reset();
      useFilterStore.getState().resetFilters();
      useMapStore.getState().reset();
    },
    
    // Performance monitoring
    subscribe: () => {
      const unsubscribes = [
        useEventStore.subscribe(
          state => console.log('[EventStore]', state)
        ),
        useFilterStore.subscribe(
          state => console.log('[FilterStore]', state)
        ),
        useMapStore.subscribe(
          state => console.log('[MapStore]', state)
        )
      ];
      
      return () => unsubscribes.forEach(fn => fn());
    }
  };
}

// ============================================
// Type Exports
// ============================================

export type {
  // Event Store Types
  EventStatistics,
  NotificationConfig,
  EventFilters,
  EnhancedTrafficEvent,
  EventGroup,
  EventCluster,
  ImpactLevel,
  EventNotification,
  NotificationType,
  NotificationPriority,
  EventTimelineItem
} from '@/types/event.types';

export type {
  // Filter Store Types
  FilterState,
  FilterPreset,
  SavedFilter,
  SortOption,
  FilterStatistics
} from '@/types/filter.types';

export type {
  // Map Store Types
  MapCenter,
  MapBounds,
  MapViewport,
  MapLayer
} from '@/types/map.types';
