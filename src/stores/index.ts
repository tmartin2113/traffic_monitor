/**
 * Zustand State Management Stores
 * Centralized state management for the application
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { TrafficEvent, EventType, EventSeverity } from '@types/api.types';
import { FilterState } from '@types/filter.types';
import { MapCenter, MapBounds } from '@types/map.types';

// ============ Map Store ============
interface MapState {
  // State
  center: MapCenter;
  zoom: number;
  bounds: MapBounds | null;
  userLocation: MapCenter | null;
  isLocating: boolean;
  locationError: string | null;
  
  // Settings
  showGeofence: boolean;
  clusterMarkers: boolean;
  autoCenter: boolean;
  followLocation: boolean;
  
  // Actions
  setCenter: (center: MapCenter) => void;
  setZoom: (zoom: number) => void;
  setBounds: (bounds: MapBounds) => void;
  setUserLocation: (location: MapCenter | null) => void;
  setLocating: (isLocating: boolean) => void;
  setLocationError: (error: string | null) => void;
  updateSettings: (settings: Partial<MapSettings>) => void;
  resetView: () => void;
}

interface MapSettings {
  showGeofence: boolean;
  clusterMarkers: boolean;
  autoCenter: boolean;
  followLocation: boolean;
}

export const useMapStore = create<MapState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        center: { lat: 37.5, lng: -122.1 },
        zoom: 10,
        bounds: null,
        userLocation: null,
        isLocating: false,
        locationError: null,
        
        // Settings
        showGeofence: true,
        clusterMarkers: true,
        autoCenter: false,
        followLocation: false,
        
        // Actions
        setCenter: (center) => set({ center }),
        setZoom: (zoom) => set({ zoom }),
        setBounds: (bounds) => set({ bounds }),
        setUserLocation: (location) => set({ userLocation: location }),
        setLocating: (isLocating) => set({ isLocating }),
        setLocationError: (error) => set({ locationError: error }),
        
        updateSettings: (settings) => set((state) => ({
          ...state,
          ...settings,
        })),
        
        resetView: () => set({
          center: { lat: 37.5, lng: -122.1 },
          zoom: 10,
        }),
      }),
      {
        name: 'map-store',
        partialize: (state) => ({
          center: state.center,
          zoom: state.zoom,
          showGeofence: state.showGeofence,
          clusterMarkers: state.clusterMarkers,
        }),
      }
    )
  )
);

// ============ Filter Store ============
interface FilterStoreState {
  filters: FilterState;
  savedFilters: SavedFilter[];
  activePreset: string | null;
  
  // Actions
  setFilters: (filters: Partial<FilterState>) => void;
  clearFilters: () => void;
  saveFilter: (name: string, filters: FilterState) => void;
  loadFilter: (id: string) => void;
  deleteFilter: (id: string) => void;
  applyPreset: (presetId: string, filters: Partial<FilterState>) => void;
}

interface SavedFilter {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: Date;
}

export const useFilterStore = create<FilterStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        filters: {
          eventType: '',
          severity: '',
          closuresOnly: false,
          activeOnly: true,
          searchTerm: '',
          includeWzdx: false,
        },
        savedFilters: [],
        activePreset: null,
        
        // Actions
        setFilters: (newFilters) => set((state) => ({
          filters: { ...state.filters, ...newFilters },
          activePreset: null, // Clear preset when custom filters are applied
        })),
        
        clearFilters: () => set({
          filters: {
            eventType: '',
            severity: '',
            closuresOnly: false,
            activeOnly: true,
            searchTerm: '',
            includeWzdx: false,
          },
          activePreset: null,
        }),
        
        saveFilter: (name, filters) => {
          const newFilter: SavedFilter = {
            id: Date.now().toString(),
            name,
            filters,
            createdAt: new Date(),
          };
          
          set((state) => ({
            savedFilters: [...state.savedFilters, newFilter],
          }));
        },
        
        loadFilter: (id) => {
          const filter = get().savedFilters.find(f => f.id === id);
          if (filter) {
            set({
              filters: filter.filters,
              activePreset: id,
            });
          }
        },
        
        deleteFilter: (id) => set((state) => ({
          savedFilters: state.savedFilters.filter(f => f.id !== id),
          activePreset: state.activePreset === id ? null : state.activePreset,
        })),
        
        applyPreset: (presetId, filters) => set((state) => ({
          filters: { ...state.filters, ...filters },
          activePreset: presetId,
        })),
      }),
      {
        name: 'filter-store',
      }
    )
  )
);

// ============ Event Store ============
interface EventStoreState {
  // Events data
  events: TrafficEvent[];
  selectedEvent: TrafficEvent | null;
  favoriteEvents: string[];
  hiddenEvents: string[];
  
  // UI state
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // Statistics
  statistics: EventStatistics;
  
  // Actions
  setEvents: (events: TrafficEvent[]) => void;
  selectEvent: (event: TrafficEvent | null) => void;
  toggleFavorite: (eventId: string) => void;
  hideEvent: (eventId: string) => void;
  unhideEvent: (eventId: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  updateStatistics: (events: TrafficEvent[]) => void;
  clearEvents: () => void;
}

interface EventStatistics {
  total: number;
  closures: number;
  incidents: number;
  construction: number;
  bySeverity: Record<EventSeverity, number>;
  byType: Record<EventType, number>;
  recentEvents: number;
}

export const useEventStore = create<EventStoreState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        events: [],
        selectedEvent: null,
        favoriteEvents: [],
        hiddenEvents: [],
        
        isLoading: false,
        error: null,
        lastUpdated: null,
        
        statistics: {
          total: 0,
          closures: 0,
          incidents: 0,
          construction: 0,
          bySeverity: {} as Record<EventSeverity, number>,
          byType: {} as Record<EventType, number>,
          recentEvents: 0,
        },
        
        // Actions
        setEvents: (events) => set({
          events,
          lastUpdated: new Date(),
          error: null,
        }),
        
        selectEvent: (event) => set({ selectedEvent: event }),
        
        toggleFavorite: (eventId) => set((state) => {
          const isFavorite = state.favoriteEvents.includes(eventId);
          return {
            favoriteEvents: isFavorite
              ? state.favoriteEvents.filter(id => id !== eventId)
              : [...state.favoriteEvents, eventId],
          };
        }),
        
        hideEvent: (eventId) => set((state) => ({
          hiddenEvents: [...state.hiddenEvents, eventId],
        })),
        
        unhideEvent: (eventId) => set((state) => ({
          hiddenEvents: state.hiddenEvents.filter(id => id !== eventId),
        })),
        
        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),
        
        updateStatistics: (events) => {
          const stats: EventStatistics = {
            total: events.length,
            closures: 0,
            incidents: 0,
            construction: 0,
            bySeverity: {} as Record<EventSeverity, number>,
            byType: {} as Record<EventType, number>,
            recentEvents: 0,
          };
          
          const now = Date.now();
          const recentThreshold = 30 * 60 * 1000; // 30 minutes
          
          events.forEach(event => {
            // Count by type
            stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;
            
            // Count by severity
            stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
            
            // Count specific types
            if (event.event_type === EventType.INCIDENT) stats.incidents++;
            if (event.event_type === EventType.CONSTRUCTION) stats.construction++;
            
            // Count closures
            if (event.roads?.some(road => road.state === 'CLOSED')) {
              stats.closures++;
            }
            
            // Count recent events
            const eventTime = new Date(event.updated).getTime();
            if (now - eventTime < recentThreshold) {
              stats.recentEvents++;
            }
          });
          
          set({ statistics: stats });
        },
        
        clearEvents: () => set({
          events: [],
          selectedEvent: null,
          lastUpdated: null,
          error: null,
        }),
      }),
      {
        name: 'event-store',
        partialize: (state) => ({
          favoriteEvents: state.favoriteEvents,
          hiddenEvents: state.hiddenEvents,
        }),
      }
    )
  )
);

// ============ App Store (Global Settings) ============
interface AppState {
  // API configuration
  apiKey: string | null;
  apiEndpoint: string;
  
  // App settings
  theme: 'light' | 'dark' | 'auto';
  language: string;
  units: 'imperial' | 'metric';
  
  // Update settings
  autoRefresh: boolean;
  refreshInterval: number;
  backgroundRefresh: boolean;
  
  // Notifications
  enableNotifications: boolean;
  notificationTypes: string[];
  
  // Actions
  setApiKey: (key: string | null) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  units: 'imperial' | 'metric';
  autoRefresh: boolean;
  refreshInterval: number;
  backgroundRefresh: boolean;
  enableNotifications: boolean;
  notificationTypes: string[];
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        apiKey: null,
        apiEndpoint: 'https://api.511.org',
        
        theme: 'light',
        language: 'en',
        units: 'imperial',
        
        autoRefresh: true,
        refreshInterval: 60000,
        backgroundRefresh: false,
        
        enableNotifications: false,
        notificationTypes: ['closures', 'severe'],
        
        // Actions
        setApiKey: (key) => set({ apiKey: key }),
        
        updateSettings: (settings) => set((state) => ({
          ...state,
          ...settings,
        })),
        
        resetSettings: () => set({
          theme: 'light',
          language: 'en',
          units: 'imperial',
          autoRefresh: true,
          refreshInterval: 60000,
          backgroundRefresh: false,
          enableNotifications: false,
          notificationTypes: ['closures', 'severe'],
        }),
      }),
      {
        name: 'app-store',
      }
    )
  )
);

// Export all stores
export default {
  useMapStore,
  useFilterStore,
  useEventStore,
  useAppStore,
};
