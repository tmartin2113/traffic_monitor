/**
 * Map Store - Zustand State Management
 * Manages map view state, settings, and interactions
 * 
 * @module src/stores/mapStore
 * @version 1.0.0
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Map as LeafletMap, LatLngBounds } from 'leaflet';
import { MapCenter, MapBounds, MapViewport, MapLayer } from '@/types/map.types';
import { TrafficEvent } from '@/types/api.types';
import { GEOFENCE, DEFAULT_MAP_CENTER, MAP_CONFIG } from '@/utils/constants';

/**
 * Map drawing tools state
 */
interface DrawingState {
  isDrawing: boolean;
  drawingMode: 'polygon' | 'circle' | 'rectangle' | null;
  drawnShapes: Array<{
    id: string;
    type: 'polygon' | 'circle' | 'rectangle';
    coordinates: any;
    properties?: Record<string, any>;
  }>;
  selectedShapeId: string | null;
}

/**
 * Map measurement tools state
 */
interface MeasurementState {
  isMeasuring: boolean;
  measurementMode: 'distance' | 'area' | null;
  measurements: Array<{
    id: string;
    type: 'distance' | 'area';
    value: number;
    unit: string;
    coordinates: any;
  }>;
}

/**
 * Map marker configuration
 */
interface MarkerConfig {
  clustering: boolean;
  clusterRadius: number;
  showLabels: boolean;
  animateMarkers: boolean;
  markerSize: 'small' | 'medium' | 'large';
  opacity: number;
}

/**
 * Map overlay configuration
 */
interface OverlayConfig {
  showGeofence: boolean;
  showGrid: boolean;
  showScale: boolean;
  showCoordinates: boolean;
  showMinimap: boolean;
  showCompass: boolean;
  showZoomControls: boolean;
  showLayerControl: boolean;
  showFullscreenControl: boolean;
}

/**
 * Map interaction history
 */
interface MapHistory {
  views: Array<{
    center: MapCenter;
    zoom: number;
    timestamp: Date;
  }>;
  maxSize: number;
  currentIndex: number;
}

/**
 * Map performance metrics
 */
interface MapPerformance {
  renderTime: number;
  markerCount: number;
  clusterCount: number;
  fps: number;
  memoryUsage: number;
}

/**
 * Map store state interface
 */
interface MapStoreState {
  // Map instance reference
  mapInstance: LeafletMap | null;
  
  // View state
  center: MapCenter;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  bounds: MapBounds | null;
  viewport: MapViewport | null;
  
  // Layers
  baseLayers: MapLayer[];
  overlayLayers: MapLayer[];
  activeBaseLayer: string;
  activeOverlayLayers: string[];
  
  // User location
  userLocation: MapCenter | null;
  locationAccuracy: number | null;
  isLocating: boolean;
  locationError: string | null;
  followUserLocation: boolean;
  
  // Marker configuration
  markerConfig: MarkerConfig;
  
  // Overlay configuration
  overlayConfig: OverlayConfig;
  
  // Drawing tools
  drawing: DrawingState;
  
  // Measurement tools
  measurement: MeasurementState;
  
  // Navigation history
  history: MapHistory;
  
  // Saved locations
  savedLocations: Array<{
    id: string;
    name: string;
    center: MapCenter;
    zoom: number;
    timestamp: Date;
  }>;
  
  // Map settings
  settings: {
    autoCenter: boolean;
    animateTransitions: boolean;
    transitionDuration: number;
    wheelZoomSpeed: number;
    touchZoomSpeed: number;
    keyboardNavigation: boolean;
    doubleClickZoom: boolean;
    boxZoom: boolean;
    zoomSnap: number;
    theme: 'light' | 'dark' | 'auto';
  };
  
  // Performance
  performance: MapPerformance;
  performanceMode: 'auto' | 'high' | 'balanced' | 'low';
  
  // UI State
  isFullscreen: boolean;
  isPanning: boolean;
  isZooming: boolean;
  controlsVisible: boolean;
  sidebarCollapsed: boolean;
}

/**
 * Map store actions interface
 */
interface MapStoreActions {
  // Map instance management
  setMapInstance: (map: LeafletMap | null) => void;
  
  // View control
  setCenter: (center: MapCenter, animate?: boolean) => void;
  setZoom: (zoom: number, animate?: boolean) => void;
  setBounds: (bounds: MapBounds) => void;
  setViewport: (viewport: MapViewport) => void;
  fitBounds: (bounds: MapBounds, padding?: number) => void;
  panTo: (center: MapCenter, animate?: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  
  // Layer management
  addBaseLayer: (layer: MapLayer) => void;
  removeBaseLayer: (layerId: string) => void;
  setActiveBaseLayer: (layerId: string) => void;
  toggleOverlayLayer: (layerId: string) => void;
  updateLayerOpacity: (layerId: string, opacity: number) => void;
  reorderLayers: (layerIds: string[]) => void;
  
  // Location services
  requestUserLocation: () => Promise<void>;
  setUserLocation: (location: MapCenter | null, accuracy?: number) => void;
  clearUserLocation: () => void;
  toggleLocationFollow: () => void;
  centerOnUser: (animate?: boolean) => void;
  
  // Marker configuration
  updateMarkerConfig: (config: Partial<MarkerConfig>) => void;
  toggleClustering: () => void;
  setClusterRadius: (radius: number) => void;
  
  // Overlay configuration
  updateOverlayConfig: (config: Partial<OverlayConfig>) => void;
  toggleOverlay: (overlay: keyof OverlayConfig) => void;
  
  // Drawing tools
  startDrawing: (mode: 'polygon' | 'circle' | 'rectangle') => void;
  stopDrawing: () => void;
  saveDrawnShape: (shape: any) => void;
  deleteShape: (shapeId: string) => void;
  clearAllShapes: () => void;
  selectShape: (shapeId: string | null) => void;
  
  // Measurement tools
  startMeasuring: (mode: 'distance' | 'area') => void;
  stopMeasuring: () => void;
  saveMeasurement: (measurement: any) => void;
  clearMeasurements: () => void;
  
  // Navigation history
  pushToHistory: () => void;
  navigateBack: () => void;
  navigateForward: () => void;
  clearHistory: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  
  // Saved locations
  saveCurrentLocation: (name: string) => void;
  loadSavedLocation: (locationId: string) => void;
  updateSavedLocation: (locationId: string, updates: any) => void;
  deleteSavedLocation: (locationId: string) => void;
  
  // Settings
  updateSettings: (settings: Partial<MapStoreState['settings']>) => void;
  resetSettings: () => void;
  
  // Performance
  setPerformanceMode: (mode: 'auto' | 'high' | 'balanced' | 'low') => void;
  updatePerformanceMetrics: (metrics: Partial<MapPerformance>) => void;
  optimizePerformance: () => void;
  
  // Event focus
  focusOnEvent: (event: TrafficEvent, zoom?: number) => void;
  focusOnEvents: (events: TrafficEvent[], padding?: number) => void;
  
  // Utility
  takeScreenshot: () => Promise<string>;
  exportMapData: () => string;
  importMapData: (data: string) => boolean;
  calculateDistance: (from: MapCenter, to: MapCenter) => number;
  isInBounds: (point: MapCenter, bounds: MapBounds) => boolean;
  
  // UI State
  toggleFullscreen: () => void;
  toggleSidebar: () => void;
  setControlsVisibility: (visible: boolean) => void;
  
  // Reset
  reset: () => void;
}

/**
 * Default settings
 */
const defaultSettings: MapStoreState['settings'] = {
  autoCenter: false,
  animateTransitions: true,
  transitionDuration: 250,
  wheelZoomSpeed: 1,
  touchZoomSpeed: 1,
  keyboardNavigation: true,
  doubleClickZoom: true,
  boxZoom: true,
  zoomSnap: 0.5,
  theme: 'auto'
};

/**
 * Default marker configuration
 */
const defaultMarkerConfig: MarkerConfig = {
  clustering: true,
  clusterRadius: 80,
  showLabels: true,
  animateMarkers: true,
  markerSize: 'medium',
  opacity: 1
};

/**
 * Default overlay configuration
 */
const defaultOverlayConfig: OverlayConfig = {
  showGeofence: true,
  showGrid: false,
  showScale: true,
  showCoordinates: false,
  showMinimap: false,
  showCompass: false,
  showZoomControls: true,
  showLayerControl: true,
  showFullscreenControl: true
};

/**
 * Initial state factory
 */
const createInitialState = (): MapStoreState => ({
  mapInstance: null,
  center: DEFAULT_MAP_CENTER,
  zoom: MAP_CONFIG.DEFAULT_ZOOM,
  minZoom: MAP_CONFIG.MIN_ZOOM,
  maxZoom: MAP_CONFIG.MAX_ZOOM,
  bounds: null,
  viewport: null,
  baseLayers: [
    {
      id: 'osm',
      name: 'OpenStreetMap',
      type: 'tile',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      visible: true,
      opacity: 1
    },
    {
      id: 'satellite',
      name: 'Satellite',
      type: 'tile',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri',
      visible: false,
      opacity: 1
    }
  ],
  overlayLayers: [
    {
      id: 'traffic',
      name: 'Traffic Events',
      type: 'geojson',
      visible: true,
      opacity: 1
    },
    {
      id: 'geofence',
      name: 'Service Area',
      type: 'geojson',
      visible: true,
      opacity: 0.3
    }
  ],
  activeBaseLayer: 'osm',
  activeOverlayLayers: ['traffic', 'geofence'],
  userLocation: null,
  locationAccuracy: null,
  isLocating: false,
  locationError: null,
  followUserLocation: false,
  markerConfig: defaultMarkerConfig,
  overlayConfig: defaultOverlayConfig,
  drawing: {
    isDrawing: false,
    drawingMode: null,
    drawnShapes: [],
    selectedShapeId: null
  },
  measurement: {
    isMeasuring: false,
    measurementMode: null,
    measurements: []
  },
  history: {
    views: [],
    maxSize: 20,
    currentIndex: -1
  },
  savedLocations: [],
  settings: defaultSettings,
  performance: {
    renderTime: 0,
    markerCount: 0,
    clusterCount: 0,
    fps: 60,
    memoryUsage: 0
  },
  performanceMode: 'auto',
  isFullscreen: false,
  isPanning: false,
  isZooming: false,
  controlsVisible: true,
  sidebarCollapsed: false
});

/**
 * Calculate bounds from events
 */
const calculateBoundsFromEvents = (events: TrafficEvent[]): MapBounds | null => {
  if (!events.length) return null;
  
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  
  events.forEach(event => {
    if (event.geography?.coordinates) {
      const [lng, lat] = event.geography.coordinates;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }
  });
  
  if (!isFinite(minLat)) return null;
  
  return {
    north: maxLat,
    south: minLat,
    east: maxLng,
    west: minLng
  };
};

/**
 * Calculate distance between two points (Haversine formula)
 */
const calculateDistanceInternal = (from: MapCenter, to: MapCenter): number => {
  const R = 6371000; // Earth's radius in meters
  const φ1 = from.lat * Math.PI / 180;
  const φ2 = to.lat * Math.PI / 180;
  const Δφ = (to.lat - from.lat) * Math.PI / 180;
  const Δλ = (to.lng - from.lng) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

/**
 * Create the map store with Zustand
 */
export const useMapStore = create<MapStoreState & MapStoreActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          ...createInitialState(),

          // Map instance management
          setMapInstance: (map) => set({ mapInstance: map }),

          // View control
          setCenter: (center, animate = true) => set(state => {
            state.center = center;
            if (state.mapInstance && animate && state.settings.animateTransitions) {
              state.mapInstance.panTo([center.lat, center.lng], {
                duration: state.settings.transitionDuration / 1000
              });
            } else if (state.mapInstance) {
              state.mapInstance.setView([center.lat, center.lng], state.zoom, {
                animate: false
              });
            }
          }),

          setZoom: (zoom, animate = true) => set(state => {
            state.zoom = Math.max(state.minZoom, Math.min(state.maxZoom, zoom));
            if (state.mapInstance && animate && state.settings.animateTransitions) {
              state.mapInstance.setZoom(state.zoom, {
                animate: true,
                duration: state.settings.transitionDuration / 1000
              });
            } else if (state.mapInstance) {
              state.mapInstance.setZoom(state.zoom, { animate: false });
            }
          }),

          setBounds: (bounds) => set({ bounds }),

          setViewport: (viewport) => set({ viewport }),

          fitBounds: (bounds, padding = 50) => set(state => {
            if (state.mapInstance) {
              const leafletBounds = new LatLngBounds(
                [bounds.south, bounds.west],
                [bounds.north, bounds.east]
              );
              state.mapInstance.fitBounds(leafletBounds, {
                padding: [padding, padding],
                animate: state.settings.animateTransitions,
                duration: state.settings.transitionDuration / 1000
              });
            }
          }),

          panTo: (center, animate = true) => {
            get().setCenter(center, animate);
          },

          zoomIn: () => {
            const state = get();
            state.setZoom(state.zoom + 1, true);
          },

          zoomOut: () => {
            const state = get();
            state.setZoom(state.zoom - 1, true);
          },

          resetView: () => set(state => {
            state.center = DEFAULT_MAP_CENTER;
            state.zoom = MAP_CONFIG.DEFAULT_ZOOM;
            if (state.mapInstance) {
              state.mapInstance.setView(
                [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
                MAP_CONFIG.DEFAULT_ZOOM,
                { animate: state.settings.animateTransitions }
              );
            }
          }),

          // Layer management
          addBaseLayer: (layer) => set(state => {
            state.baseLayers.push(layer);
          }),

          removeBaseLayer: (layerId) => set(state => {
            state.baseLayers = state.baseLayers.filter(l => l.id !== layerId);
          }),

          setActiveBaseLayer: (layerId) => set(state => {
            state.activeBaseLayer = layerId;
            state.baseLayers.forEach(layer => {
              layer.visible = layer.id === layerId;
            });
          }),

          toggleOverlayLayer: (layerId) => set(state => {
            const index = state.activeOverlayLayers.indexOf(layerId);
            if (index === -1) {
              state.activeOverlayLayers.push(layerId);
            } else {
              state.activeOverlayLayers.splice(index, 1);
            }
            const layer = state.overlayLayers.find(l => l.id === layerId);
            if (layer) {
              layer.visible = !layer.visible;
            }
          }),

          updateLayerOpacity: (layerId, opacity) => set(state => {
            const baseLayer = state.baseLayers.find(l => l.id === layerId);
            if (baseLayer) baseLayer.opacity = opacity;
            const overlayLayer = state.overlayLayers.find(l => l.id === layerId);
            if (overlayLayer) overlayLayer.opacity = opacity;
          }),

          reorderLayers: (layerIds) => set(state => {
            const ordered = layerIds.map(id =>
              state.overlayLayers.find(l => l.id === id)
            ).filter(Boolean) as MapLayer[];
            state.overlayLayers = ordered;
          }),

          // Location services
          requestUserLocation: async () => {
            set({ isLocating: true, locationError: null });
            
            try {
              const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 0
                });
              });
              
              const location: MapCenter = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              };
              
              set({
                userLocation: location,
                locationAccuracy: position.coords.accuracy,
                isLocating: false,
                locationError: null
              });
              
              // Auto-center if enabled
              const state = get();
              if (state.followUserLocation || state.settings.autoCenter) {
                state.centerOnUser(true);
              }
            } catch (error) {
              const errorMessage = error instanceof GeolocationPositionError
                ? error.message
                : 'Unable to determine location';
              set({
                isLocating: false,
                locationError: errorMessage
              });
            }
          },

          setUserLocation: (location, accuracy) => set({
            userLocation: location,
            locationAccuracy: accuracy || null
          }),

          clearUserLocation: () => set({
            userLocation: null,
            locationAccuracy: null,
            locationError: null
          }),

          toggleLocationFollow: () => set(state => {
            state.followUserLocation = !state.followUserLocation;
          }),

          centerOnUser: (animate = true) => {
            const state = get();
            if (state.userLocation) {
              state.setCenter(state.userLocation, animate);
            }
          },

          // Marker configuration
          updateMarkerConfig: (config) => set(state => {
            Object.assign(state.markerConfig, config);
          }),

          toggleClustering: () => set(state => {
            state.markerConfig.clustering = !state.markerConfig.clustering;
          }),

          setClusterRadius: (radius) => set(state => {
            state.markerConfig.clusterRadius = radius;
          }),

          // Overlay configuration
          updateOverlayConfig: (config) => set(state => {
            Object.assign(state.overlayConfig, config);
          }),

          toggleOverlay: (overlay) => set(state => {
            state.overlayConfig[overlay] = !state.overlayConfig[overlay];
          }),

          // Drawing tools
          startDrawing: (mode) => set(state => {
            state.drawing.isDrawing = true;
            state.drawing.drawingMode = mode;
          }),

          stopDrawing: () => set(state => {
            state.drawing.isDrawing = false;
            state.drawing.drawingMode = null;
          }),

          saveDrawnShape: (shape) => set(state => {
            state.drawing.drawnShapes.push({
              id: `shape-${Date.now()}`,
              type: state.drawing.drawingMode!,
              coordinates: shape,
              properties: {}
            });
          }),

          deleteShape: (shapeId) => set(state => {
            state.drawing.drawnShapes = state.drawing.drawnShapes
              .filter(s => s.id !== shapeId);
            if (state.drawing.selectedShapeId === shapeId) {
              state.drawing.selectedShapeId = null;
            }
          }),

          clearAllShapes: () => set(state => {
            state.drawing.drawnShapes = [];
            state.drawing.selectedShapeId = null;
          }),

          selectShape: (shapeId) => set(state => {
            state.drawing.selectedShapeId = shapeId;
          }),

          // Measurement tools
          startMeasuring: (mode) => set(state => {
            state.measurement.isMeasuring = true;
            state.measurement.measurementMode = mode;
          }),

          stopMeasuring: () => set(state => {
            state.measurement.isMeasuring = false;
            state.measurement.measurementMode = null;
          }),

          saveMeasurement: (measurement) => set(state => {
            state.measurement.measurements.push({
              id: `measurement-${Date.now()}`,
              type: state.measurement.measurementMode!,
              value: measurement.value,
              unit: measurement.unit,
              coordinates: measurement.coordinates
            });
          }),

          clearMeasurements: () => set(state => {
            state.measurement.measurements = [];
          }),

          // Navigation history
          pushToHistory: () => set(state => {
            const view = {
              center: state.center,
              zoom: state.zoom,
              timestamp: new Date()
            };
            
            // Remove any forward history if we're not at the end
            if (state.history.currentIndex < state.history.views.length - 1) {
              state.history.views = state.history.views.slice(0, state.history.currentIndex + 1);
            }
            
            state.history.views.push(view);
            if (state.history.views.length > state.history.maxSize) {
              state.history.views.shift();
            } else {
              state.history.currentIndex++;
            }
          }),

          navigateBack: () => set(state => {
            if (state.history.currentIndex > 0) {
              state.history.currentIndex--;
              const view = state.history.views[state.history.currentIndex];
              get().setCenter(view.center, true);
              get().setZoom(view.zoom, true);
            }
          }),

          navigateForward: () => set(state => {
            if (state.history.currentIndex < state.history.views.length - 1) {
              state.history.currentIndex++;
              const view = state.history.views[state.history.currentIndex];
              get().setCenter(view.center, true);
              get().setZoom(view.zoom, true);
            }
          }),

          clearHistory: () => set(state => {
            state.history.views = [];
            state.history.currentIndex = -1;
          }),

          canGoBack: () => get().history.currentIndex > 0,
          canGoForward: () => {
            const state = get();
            return state.history.currentIndex < state.history.views.length - 1;
          },

          // Saved locations
          saveCurrentLocation: (name) => set(state => {
            state.savedLocations.push({
              id: `location-${Date.now()}`,
              name,
              center: state.center,
              zoom: state.zoom,
              timestamp: new Date()
            });
          }),

          loadSavedLocation: (locationId) => set(state => {
            const location = state.savedLocations.find(l => l.id === locationId);
            if (location) {
              get().setCenter(location.center, true);
              get().setZoom(location.zoom, true);
            }
          }),

          updateSavedLocation: (locationId, updates) => set(state => {
            const index = state.savedLocations.findIndex(l => l.id === locationId);
            if (index !== -1) {
              Object.assign(state.savedLocations[index], updates);
            }
          }),

          deleteSavedLocation: (locationId) => set(state => {
            state.savedLocations = state.savedLocations
              .filter(l => l.id !== locationId);
          }),

          // Settings
          updateSettings: (settings) => set(state => {
            Object.assign(state.settings, settings);
          }),

          resetSettings: () => set(state => {
            state.settings = { ...defaultSettings };
          }),

          // Performance
          setPerformanceMode: (mode) => set(state => {
            state.performanceMode = mode;
            
            // Adjust settings based on mode
            switch (mode) {
              case 'high':
                state.markerConfig.animateMarkers = true;
                state.markerConfig.clustering = false;
                state.settings.animateTransitions = true;
                break;
              case 'low':
                state.markerConfig.animateMarkers = false;
                state.markerConfig.clustering = true;
                state.settings.animateTransitions = false;
                break;
              case 'balanced':
                state.markerConfig.animateMarkers = true;
                state.markerConfig.clustering = true;
                state.settings.animateTransitions = true;
                break;
            }
          }),

          updatePerformanceMetrics: (metrics) => set(state => {
            Object.assign(state.performance, metrics);
          }),

          optimizePerformance: () => {
            const state = get();
            if (state.performance.fps < 30 || state.performance.markerCount > 500) {
              state.setPerformanceMode('low');
            } else if (state.performance.fps > 50 && state.performance.markerCount < 100) {
              state.setPerformanceMode('high');
            } else {
              state.setPerformanceMode('balanced');
            }
          },

          // Event focus
          focusOnEvent: (event, zoom = 15) => {
            if (event.geography?.coordinates) {
              const center: MapCenter = {
                lat: event.geography.coordinates[1],
                lng: event.geography.coordinates[0]
              };
              get().setCenter(center, true);
              get().setZoom(zoom, true);
            }
          },

          focusOnEvents: (events, padding = 50) => {
            const bounds = calculateBoundsFromEvents(events);
            if (bounds) {
              get().fitBounds(bounds, padding);
            }
          },

          // Utility
          takeScreenshot: async () => {
            // Implementation would use leaflet-image or similar
            return Promise.resolve('data:image/png;base64,...');
          },

          exportMapData: () => {
            const state = get();
            const exportData = {
              version: '1.0.0',
              timestamp: new Date().toISOString(),
              center: state.center,
              zoom: state.zoom,
              savedLocations: state.savedLocations,
              drawnShapes: state.drawing.drawnShapes,
              measurements: state.measurement.measurements,
              settings: state.settings
            };
            return JSON.stringify(exportData, null, 2);
          },

          importMapData: (data) => {
            try {
              const parsed = JSON.parse(data);
              set(state => {
                if (parsed.center) state.center = parsed.center;
                if (parsed.zoom) state.zoom = parsed.zoom;
                if (parsed.savedLocations) state.savedLocations = parsed.savedLocations;
                if (parsed.drawnShapes) state.drawing.drawnShapes = parsed.drawnShapes;
                if (parsed.measurements) state.measurement.measurements = parsed.measurements;
                if (parsed.settings) state.settings = parsed.settings;
              });
              return true;
            } catch (error) {
              console.error('Failed to import map data:', error);
              return false;
            }
          },

          calculateDistance: (from, to) => calculateDistanceInternal(from, to),

          isInBounds: (point, bounds) => {
            return point.lat >= bounds.south &&
                   point.lat <= bounds.north &&
                   point.lng >= bounds.west &&
                   point.lng <= bounds.east;
          },

          // UI State
          toggleFullscreen: () => set(state => {
            state.isFullscreen = !state.isFullscreen;
          }),

          toggleSidebar: () => set(state => {
            state.sidebarCollapsed = !state.sidebarCollapsed;
          }),

          setControlsVisibility: (visible) => set({ controlsVisible: visible }),

          // Reset
          reset: () => set(createInitialState())
        }))
      ),
      {
        name: 'map-store',
        partialize: (state) => ({
          center: state.center,
          zoom: state.zoom,
          savedLocations: state.savedLocations,
          settings: state.settings,
          markerConfig: state.markerConfig,
          overlayConfig: state.overlayConfig
        })
      }
    ),
    {
      name: 'MapStore'
    }
  )
);

// Selector hooks for optimized re-renders
export const useMapCenter = () => useMapStore(state => state.center);
export const useMapZoom = () => useMapStore(state => state.zoom);
export const useMapBounds = () => useMapStore(state => state.bounds);
export const useUserLocation = () => useMapStore(state => state.userLocation);
export const useMapSettings = () => useMapStore(state => state.settings);
export const useMarkerConfig = () => useMapStore(state => state.markerConfig);
export const useOverlayConfig = () => useMapStore(state => state.overlayConfig);
export const useSavedLocations = () => useMapStore(state => state.savedLocations);
export const useIsLocating = () => useMapStore(state => state.isLocating);
export const useMapInstance = () => useMapStore(state => state.mapInstance);
