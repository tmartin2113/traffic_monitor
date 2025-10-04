/**
 * @file hooks/useMapControls.ts
 * @description Map controls hook with comprehensive event listener cleanup
 * @version 3.0.0
 * 
 * FIXES BUG #20: Ensures all Leaflet event listeners and geolocation watches are properly cleaned up
 * 
 * Production Standards:
 * - All map event listeners have matching cleanup
 * - Geolocation watches are cleared on unmount
 * - No memory leaks from long-running sessions
 * - Proper cleanup even on error conditions
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Map as LeafletMap, LeafletEventHandlerFnMap } from 'leaflet';
import { MapCenter, MapBounds } from '@types/map.types';
import { MAP_CONFIG, STORAGE_KEYS } from '@utils/constants';
import { useLocalStorage } from './useLocalStorage';
import { 
  isValidMapCenter, 
  isValidBounds,
  calculateBoundsFromRadius 
} from '@utils/geoUtils';
import { logger } from '@utils/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface MapRef {
  map: LeafletMap | null;
  container: HTMLElement | null;
  getBounds: () => MapBounds | null;
  getCenter: () => MapCenter | null;
  getZoom: () => number | null;
}

interface SavedMapView {
  center: MapCenter;
  zoom: number;
  timestamp: Date;
}

export enum LocationErrorType {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  POSITION_UNAVAILABLE = 'POSITION_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  UNKNOWN = 'UNKNOWN',
}

export interface LocationError {
  type: LocationErrorType;
  message: string;
  code?: number;
}

export interface UseMapControlsResult {
  mapRef: React.RefObject<MapRef>;
  mapCenter: MapCenter;
  mapZoom: number;
  mapBounds: MapBounds | null;
  userLocation: MapCenter | null;
  isLocating: boolean;
  locationError: LocationError | null;
  locationPermission: PermissionState | null;
  isMapReady: boolean;
  mapError: string | null;
  setMapCenter: (center: MapCenter) => boolean;
  setMapZoom: (zoom: number) => boolean;
  flyToLocation: (lat: number, lng: number, zoom?: number) => boolean;
  flyToMapCenter: (center: MapCenter, zoom?: number) => boolean;
  fitBounds: (bounds: MapBounds, padding?: number) => boolean;
  panTo: (center: MapCenter) => boolean;
  zoomIn: () => boolean;
  zoomOut: () => boolean;
  centerOnUserLocation: () => Promise<boolean>;
  requestUserLocation: () => Promise<MapCenter | null>;
  watchUserLocation: (callback: (center: MapCenter) => void) => number | null;
  clearLocationWatch: (watchId: number) => void;
  resetView: () => boolean;
  saveCurrentView: () => boolean;
  restoreSavedView: () => boolean;
  getMapInstance: () => LeafletMap | null;
  isMapInitialized: () => boolean;
  invalidateSize: () => boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 30000,
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useMapControls(): UseMapControlsResult {
  const mapRef = useRef<MapRef>({
    map: null,
    container: null,
    getBounds: () => null,
    getCenter: () => null,
    getZoom: () => null,
  });

  const [savedView, setSavedView] = useLocalStorage<SavedMapView | null>(
    STORAGE_KEYS.MAP_VIEW,
    null
  );

  const [mapCenter, setMapCenterState] = useState<MapCenter>(
    savedView?.center || MAP_CONFIG.DEFAULT_CENTER
  );
  const [mapZoom, setMapZoomState] = useState<number>(
    savedView?.zoom || MAP_CONFIG.DEFAULT_ZOOM
  );
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [userLocation, setUserLocation] = useState<MapCenter | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<LocationError | null>(null);
  const [locationPermission, setLocationPermission] = useState<PermissionState | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Track active geolocation watches for cleanup
  const locationWatchId = useRef<number | null>(null);
  const activeWatchCallbacks = useRef<Map<number, (center: MapCenter) => void>>(new Map());

  // Track map event listeners for cleanup
  const mapEventHandlers = useRef<Map<string, Function>>(new Map());

  // ==========================================================================
  // CLEANUP UTILITIES
  // ==========================================================================

  /**
   * Clear all active geolocation watches
   */
  const clearAllLocationWatches = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      // Clear main watch
      if (locationWatchId.current !== null) {
        navigator.geolocation.clearWatch(locationWatchId.current);
        locationWatchId.current = null;
        logger.debug('Cleared main location watch');
      }

      // Clear all tracked watches
      activeWatchCallbacks.current.forEach((_, watchId) => {
        navigator.geolocation.clearWatch(watchId);
        logger.debug(`Cleared location watch ${watchId}`);
      });
      activeWatchCallbacks.current.clear();
    }
  }, []);

  /**
   * Remove all map event listeners
   */
  const removeAllMapListeners = useCallback(() => {
    if (mapRef.current?.map) {
      const map = mapRef.current.map;

      // Remove tracked event listeners
      mapEventHandlers.current.forEach((handler, eventType) => {
        map.off(eventType as any, handler as any);
        logger.debug(`Removed map listener: ${eventType}`);
      });
      mapEventHandlers.current.clear();

      // Remove common Leaflet events that might not be tracked
      const commonEvents = ['moveend', 'zoomend', 'resize', 'load', 'unload'];
      commonEvents.forEach(eventType => {
        map.off(eventType as any);
      });

      logger.debug('Removed all map event listeners');
    }
  }, []);

  // ==========================================================================
  // EFFECT: CLEANUP ON UNMOUNT
  // ==========================================================================

  useEffect(() => {
    return () => {
      logger.debug('useMapControls: Cleaning up on unmount');
      
      // Clear all geolocation watches
      clearAllLocationWatches();
      
      // Remove all map event listeners
      removeAllMapListeners();
      
      // Clear map reference
      if (mapRef.current) {
        mapRef.current.map = null;
        mapRef.current.container = null;
      }
    };
  }, [clearAllLocationWatches, removeAllMapListeners]);

  // ==========================================================================
  // EFFECT: MAP EVENT LISTENERS SETUP WITH CLEANUP
  // ==========================================================================

  useEffect(() => {
    if (!mapRef.current?.map) return;

    const map = mapRef.current.map;

    // Handler for move end event
    const handleMoveEnd = () => {
      const center = map.getCenter();
      setMapCenterState({ lat: center.lat, lng: center.lng });
      
      const bounds = map.getBounds();
      setMapBounds({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    };

    // Handler for zoom end event
    const handleZoomEnd = () => {
      setMapZoomState(map.getZoom());
    };

    // Handler for resize event
    const handleResize = () => {
      map.invalidateSize();
    };

    // Attach event listeners
    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleZoomEnd);
    map.on('resize', handleResize);

    // Track handlers for cleanup
    mapEventHandlers.current.set('moveend', handleMoveEnd);
    mapEventHandlers.current.set('zoomend', handleZoomEnd);
    mapEventHandlers.current.set('resize', handleResize);

    logger.debug('Map event listeners attached');

    // Cleanup function
    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleZoomEnd);
      map.off('resize', handleResize);
      
      mapEventHandlers.current.delete('moveend');
      mapEventHandlers.current.delete('zoomend');
      mapEventHandlers.current.delete('resize');
      
      logger.debug('Map event listeners removed in effect cleanup');
    };
  }, [mapRef.current?.map]);

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  const isMapInitialized = useCallback((): boolean => {
    return !!(mapRef.current?.map);
  }, []);

  const validateMapReady = useCallback((operation: string): boolean => {
    if (!mapRef.current?.map) {
      logger.warn(`Cannot ${operation}: Map not initialized`);
      setMapError(`Map not ready for ${operation}`);
      return false;
    }
    return true;
  }, []);

  // ==========================================================================
  // MAP CONTROLS
  // ==========================================================================

  const setMapCenter = useCallback((center: MapCenter): boolean => {
    if (!validateMapReady('set center')) return false;
    if (!isValidMapCenter(center)) {
      logger.warn('Invalid center coordinates');
      return false;
    }

    try {
      mapRef.current.map!.setView([center.lat, center.lng]);
      setMapCenterState(center);
      return true;
    } catch (error) {
      logger.error('Failed to set map center', { error });
      return false;
    }
  }, [validateMapReady]);

  const setMapZoom = useCallback((zoom: number): boolean => {
    if (!validateMapReady('set zoom')) return false;

    try {
      mapRef.current.map!.setZoom(zoom);
      setMapZoomState(zoom);
      return true;
    } catch (error) {
      logger.error('Failed to set map zoom', { error });
      return false;
    }
  }, [validateMapReady]);

  const flyToLocation = useCallback((lat: number, lng: number, zoom?: number): boolean => {
    if (!validateMapReady('fly to location')) return false;

    try {
      const targetZoom = zoom || mapRef.current.map!.getZoom();
      mapRef.current.map!.flyTo([lat, lng], targetZoom, {
        duration: 1.5,
        easeLinearity: 0.25,
      });
      return true;
    } catch (error) {
      logger.error('Failed to fly to location', { error });
      return false;
    }
  }, [validateMapReady]);

  const flyToMapCenter = useCallback((center: MapCenter, zoom?: number): boolean => {
    return flyToLocation(center.lat, center.lng, zoom);
  }, [flyToLocation]);

  const fitBounds = useCallback((bounds: MapBounds, padding: number = 50): boolean => {
    if (!validateMapReady('fit bounds')) return false;
    if (!isValidBounds(bounds)) {
      logger.warn('Invalid bounds');
      return false;
    }

    try {
      mapRef.current.map!.fitBounds(
        [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ],
        { padding: [padding, padding] }
      );
      return true;
    } catch (error) {
      logger.error('Failed to fit bounds', { error });
      return false;
    }
  }, [validateMapReady]);

  const panTo = useCallback((center: MapCenter): boolean => {
    if (!validateMapReady('pan to')) return false;

    try {
      mapRef.current.map!.panTo([center.lat, center.lng]);
      return true;
    } catch (error) {
      logger.error('Failed to pan', { error });
      return false;
    }
  }, [validateMapReady]);

  const zoomIn = useCallback((): boolean => {
    if (!validateMapReady('zoom in')) return false;

    try {
      mapRef.current.map!.zoomIn();
      return true;
    } catch (error) {
      logger.error('Failed to zoom in', { error });
      return false;
    }
  }, [validateMapReady]);

  const zoomOut = useCallback((): boolean => {
    if (!validateMapReady('zoom out')) return false;

    try {
      mapRef.current.map!.zoomOut();
      return true;
    } catch (error) {
      logger.error('Failed to zoom out', { error });
      return false;
    }
  }, [validateMapReady]);

  // ==========================================================================
  // GEOLOCATION WITH PROPER CLEANUP
  // ==========================================================================

  const requestUserLocation = useCallback((): Promise<MapCenter | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationError({
          type: LocationErrorType.NOT_SUPPORTED,
          message: 'Geolocation not supported',
        });
        resolve(null);
        return;
      }

      setIsLocating(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: MapCenter = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(location);
          setIsLocating(false);
          resolve(location);
        },
        (error) => {
          const locationError: LocationError = {
            type: LocationErrorType.UNKNOWN,
            message: error.message,
            code: error.code,
          };
          setLocationError(locationError);
          setIsLocating(false);
          resolve(null);
        },
        GEOLOCATION_OPTIONS
      );
    });
  }, []);

  const watchUserLocation = useCallback((callback: (center: MapCenter) => void): number | null => {
    if (!navigator.geolocation) {
      logger.warn('Geolocation not supported');
      return null;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: MapCenter = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(location);
        callback(location);
      },
      (error) => {
        logger.error('Geolocation error', { error });
        setLocationError({
          type: LocationErrorType.UNKNOWN,
          message: error.message,
          code: error.code,
        });
      },
      GEOLOCATION_OPTIONS
    );

    // Track this watch for cleanup
    activeWatchCallbacks.current.set(watchId, callback);
    logger.debug(`Started location watch: ${watchId}`);

    return watchId;
  }, []);

  const clearLocationWatch = useCallback((watchId: number): void => {
    if (navigator.geolocation && watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      activeWatchCallbacks.current.delete(watchId);
      logger.debug(`Cleared location watch: ${watchId}`);
    }
  }, []);

  const centerOnUserLocation = useCallback(async (): Promise<boolean> => {
    const location = await requestUserLocation();
    if (!location) return false;

    return flyToMapCenter(location, MAP_CONFIG.DEFAULT_ZOOM);
  }, [requestUserLocation, flyToMapCenter]);

  // ==========================================================================
  // VIEW MANAGEMENT
  // ==========================================================================

  const resetView = useCallback((): boolean => {
    if (!validateMapReady('reset view')) return false;

    try {
      mapRef.current.map!.setView(
        [MAP_CONFIG.DEFAULT_CENTER.lat, MAP_CONFIG.DEFAULT_CENTER.lng],
        MAP_CONFIG.DEFAULT_ZOOM
      );
      setMapCenterState(MAP_CONFIG.DEFAULT_CENTER);
      setMapZoomState(MAP_CONFIG.DEFAULT_ZOOM);
      return true;
    } catch (error) {
      logger.error('Failed to reset view', { error });
      return false;
    }
  }, [validateMapReady]);

  const saveCurrentView = useCallback((): boolean => {
    if (!validateMapReady('save view')) return false;

    try {
      const center = mapRef.current.map!.getCenter();
      const zoom = mapRef.current.map!.getZoom();

      setSavedView({
        center: { lat: center.lat, lng: center.lng },
        zoom,
        timestamp: new Date(),
      });
      return true;
    } catch (error) {
      logger.error('Failed to save view', { error });
      return false;
    }
  }, [validateMapReady, setSavedView]);

  const restoreSavedView = useCallback((): boolean => {
    if (!savedView) {
      logger.warn('No saved view to restore');
      return false;
    }

    return flyToMapCenter(savedView.center, savedView.zoom);
  }, [savedView, flyToMapCenter]);

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  const getMapInstance = useCallback((): LeafletMap | null => {
    return mapRef.current?.map || null;
  }, []);

  const invalidateSize = useCallback((): boolean => {
    if (!validateMapReady('invalidate size')) return false;

    try {
      mapRef.current.map!.invalidateSize();
      return true;
    } catch (error) {
      logger.error('Failed to invalidate size', { error });
      return false;
    }
  }, [validateMapReady]);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    mapRef,
    mapCenter,
    mapZoom,
    mapBounds,
    userLocation,
    isLocating,
    locationError,
    locationPermission,
    isMapReady,
    mapError,
    setMapCenter,
    setMapZoom,
    flyToLocation,
    flyToMapCenter,
    fitBounds,
    panTo,
    zoomIn,
    zoomOut,
    centerOnUserLocation,
    requestUserLocation,
    watchUserLocation,
    clearLocationWatch,
    resetView,
    saveCurrentView,
    restoreSavedView,
    getMapInstance,
    isMapInitialized,
    invalidateSize,
  };
}

export default useMapControls;
