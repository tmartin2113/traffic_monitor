/**
 * @file hooks/useMapControls.ts
 * @description Map controls hook with comprehensive null checking and error handling
 * @version 2.0.0
 * 
 * Features:
 * - Safe map reference access with null checks
 * - Center and zoom controls
 * - User location tracking
 * - Bounds calculation
 * - View state persistence
 * - Error handling
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { MapCenter, MapBounds } from '@types/map.types';
import { MAP_CONFIG, STORAGE_KEYS } from '@utils/constants';
import { useLocalStorage } from './useLocalStorage';
import { 
  isValidMapCenter, 
  isValidBounds,
  calculateBoundsFromRadius 
} from '@utils/geoUtils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Map reference interface
 */
export interface MapRef {
  map: LeafletMap | null;
  container: HTMLElement | null;
  getBounds: () => MapBounds | null;
  getCenter: () => MapCenter | null;
  getZoom: () => number | null;
}

/**
 * Saved map view state
 */
interface SavedMapView {
  center: MapCenter;
  zoom: number;
  timestamp: Date;
}

/**
 * Location error types
 */
export enum LocationErrorType {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  POSITION_UNAVAILABLE = 'POSITION_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Location error
 */
export interface LocationError {
  type: LocationErrorType;
  message: string;
  code?: number;
}

/**
 * Hook return type
 */
export interface UseMapControlsResult {
  // Map reference
  mapRef: React.RefObject<MapRef>;
  
  // Current state
  mapCenter: MapCenter;
  mapZoom: number;
  mapBounds: MapBounds | null;
  
  // User location
  userLocation: MapCenter | null;
  isLocating: boolean;
  locationError: LocationError | null;
  locationPermission: PermissionState | null;
  
  // Map readiness
  isMapReady: boolean;
  mapError: string | null;
  
  // Control methods
  setMapCenter: (center: MapCenter) => boolean;
  setMapZoom: (zoom: number) => boolean;
  flyToLocation: (lat: number, lng: number, zoom?: number) => boolean;
  flyToMapCenter: (center: MapCenter, zoom?: number) => boolean;
  fitBounds: (bounds: MapBounds, padding?: number) => boolean;
  panTo: (center: MapCenter) => boolean;
  zoomIn: () => boolean;
  zoomOut: () => boolean;
  
  // User location methods
  centerOnUserLocation: () => Promise<boolean>;
  requestUserLocation: () => Promise<MapCenter | null>;
  watchUserLocation: (callback: (center: MapCenter) => void) => number | null;
  clearLocationWatch: (watchId: number) => void;
  
  // View management
  resetView: () => boolean;
  saveCurrentView: () => boolean;
  restoreSavedView: () => boolean;
  
  // Utility methods
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

const GEOLOCATION_TIMEOUT = 15000; // 15 seconds

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Map controls hook with comprehensive error handling
 */
export function useMapControls(): UseMapControlsResult {
  // Map reference
  const mapRef = useRef<MapRef>({
    map: null,
    container: null,
    getBounds: () => null,
    getCenter: () => null,
    getZoom: () => null,
  });

  // Load saved view or use defaults
  const [savedView, setSavedView] = useLocalStorage<SavedMapView | null>(
    STORAGE_KEYS.MAP_VIEW,
    null
  );

  // State
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

  // Location watch ID
  const locationWatchId = useRef<number | null>(null);

  // ============================================================================
  // INITIALIZATION & VALIDATION
  // ============================================================================

  /**
   * Check if map is initialized and ready
   */
  const isMapInitialized = useCallback((): boolean => {
    return !!(mapRef.current?.map);
  }, []);

  /**
   * Get map instance safely
   */
  const getMapInstance = useCallback((): LeafletMap | null => {
    return mapRef.current?.map || null;
  }, []);

  /**
   * Validate map is ready for operations
   */
  const validateMapReady = useCallback((operation: string): boolean => {
    if (!mapRef.current?.map) {
      console.warn(`Cannot ${operation}: Map not initialized`);
      setMapError(`Map not ready for ${operation}`);
      return false;
    }
    return true;
  }, []);

  /**
   * Check location permission
   */
  const checkLocationPermission = useCallback(async (): Promise<void> => {
    if (!('permissions' in navigator)) {
      setLocationPermission('granted'); // Assume granted if API unavailable
      return;
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      setLocationPermission(result.state);

      // Listen for permission changes
      result.addEventListener('change', () => {
        setLocationPermission(result.state);
      });
    } catch (error) {
      console.warn('Failed to check location permission:', error);
      setLocationPermission('granted'); // Fallback
    }
  }, []);

  // Check permission on mount
  useEffect(() => {
    checkLocationPermission();
  }, [checkLocationPermission]);

  // Update map readiness when map reference changes
  useEffect(() => {
    const checkMapReady = () => {
      const ready = isMapInitialized();
      setIsMapReady(ready);
      if (ready) {
        setMapError(null);
      }
    };

    // Check immediately
    checkMapReady();

    // Check periodically until ready
    const interval = setInterval(checkMapReady, 100);
    
    return () => clearInterval(interval);
  }, [isMapInitialized]);

  // Update bounds when map moves
  useEffect(() => {
    if (!isMapInitialized()) return;

    try {
      const bounds = mapRef.current.getBounds();
      if (bounds) {
        setMapBounds(bounds);
      }
    } catch (error) {
      console.warn('Failed to update bounds:', error);
    }
  }, [mapCenter, mapZoom, isMapInitialized]);

  // ============================================================================
  // MAP CONTROL METHODS
  // ============================================================================

  /**
   * Set map center safely
   */
  const setMapCenter = useCallback((center: MapCenter): boolean => {
    if (!validateMapReady('set center')) return false;

    if (!isValidMapCenter(center)) {
      console.error('Invalid map center:', center);
      return false;
    }

    try {
      mapRef.current.map!.setView([center.lat, center.lng], mapRef.current.map!.getZoom());
      setMapCenterState(center);
      return true;
    } catch (error) {
      console.error('Failed to set map center:', error);
      setMapError('Failed to set map center');
      return false;
    }
  }, [validateMapReady]);

  /**
   * Set map zoom safely
   */
  const setMapZoom = useCallback((zoom: number): boolean => {
    if (!validateMapReady('set zoom')) return false;

    if (zoom < MAP_CONFIG.MIN_ZOOM || zoom > MAP_CONFIG.MAX_ZOOM) {
      console.error('Invalid zoom level:', zoom);
      return false;
    }

    try {
      mapRef.current.map!.setZoom(zoom);
      setMapZoomState(zoom);
      return true;
    } catch (error) {
      console.error('Failed to set zoom:', error);
      setMapError('Failed to set zoom level');
      return false;
    }
  }, [validateMapReady]);

  /**
   * Fly to location with animation
   */
  const flyToLocation = useCallback((
    lat: number,
    lng: number,
    zoom?: number
  ): boolean => {
    if (!validateMapReady('fly to location')) return false;

    const center: MapCenter = { lat, lng };
    if (!isValidMapCenter(center)) {
      console.error('Invalid coordinates:', lat, lng);
      return false;
    }

    try {
      const targetZoom = zoom ?? mapRef.current.map!.getZoom();
      mapRef.current.map!.flyTo([lat, lng], targetZoom, {
        duration: 1.5,
        easeLinearity: 0.25,
      });
      setMapCenterState(center);
      setMapZoomState(targetZoom);
      return true;
    } catch (error) {
      console.error('Failed to fly to location:', error);
      setMapError('Failed to fly to location');
      return false;
    }
  }, [validateMapReady]);

  /**
   * Fly to MapCenter object
   */
  const flyToMapCenter = useCallback((
    center: MapCenter,
    zoom?: number
  ): boolean => {
    return flyToLocation(center.lat, center.lng, zoom);
  }, [flyToLocation]);

  /**
   * Pan to location without zoom change
   */
  const panTo = useCallback((center: MapCenter): boolean => {
    if (!validateMapReady('pan to location')) return false;

    if (!isValidMapCenter(center)) {
      console.error('Invalid map center:', center);
      return false;
    }

    try {
      mapRef.current.map!.panTo([center.lat, center.lng]);
      setMapCenterState(center);
      return true;
    } catch (error) {
      console.error('Failed to pan:', error);
      setMapError('Failed to pan to location');
      return false;
    }
  }, [validateMapReady]);

  /**
   * Fit map to bounds with optional padding
   */
  const fitBounds = useCallback((
    bounds: MapBounds,
    padding: number = 50
  ): boolean => {
    if (!validateMapReady('fit bounds')) return false;

    if (!isValidBounds(bounds)) {
      console.error('Invalid bounds:', bounds);
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
      
      setMapBounds(bounds);
      
      // Update center and zoom after fit
      const newCenter = mapRef.current.map!.getCenter();
      const newZoom = mapRef.current.map!.getZoom();
      setMapCenterState({ lat: newCenter.lat, lng: newCenter.lng });
      setMapZoomState(newZoom);
      
      return true;
    } catch (error) {
      console.error('Failed to fit bounds:', error);
      setMapError('Failed to fit bounds');
      return false;
    }
  }, [validateMapReady]);

  /**
   * Zoom in by one level
   */
  const zoomIn = useCallback((): boolean => {
    if (!validateMapReady('zoom in')) return false;

    try {
      mapRef.current.map!.zoomIn();
      setMapZoomState(mapRef.current.map!.getZoom());
      return true;
    } catch (error) {
      console.error('Failed to zoom in:', error);
      return false;
    }
  }, [validateMapReady]);

  /**
   * Zoom out by one level
   */
  const zoomOut = useCallback((): boolean => {
    if (!validateMapReady('zoom out')) return false;

    try {
      mapRef.current.map!.zoomOut();
      setMapZoomState(mapRef.current.map!.getZoom());
      return true;
    } catch (error) {
      console.error('Failed to zoom out:', error);
      return false;
    }
  }, [validateMapReady]);

  // ============================================================================
  // USER LOCATION METHODS
  // ============================================================================

  /**
   * Parse geolocation error
   */
  const parseGeolocationError = useCallback((error: GeolocationPositionError): LocationError => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return {
          type: LocationErrorType.PERMISSION_DENIED,
          message: 'Location permission denied. Please enable location access in your browser settings.',
          code: error.code,
        };
      case error.POSITION_UNAVAILABLE:
        return {
          type: LocationErrorType.POSITION_UNAVAILABLE,
          message: 'Location information unavailable. Please try again.',
          code: error.code,
        };
      case error.TIMEOUT:
        return {
          type: LocationErrorType.TIMEOUT,
          message: 'Location request timed out. Please try again.',
          code: error.code,
        };
      default:
        return {
          type: LocationErrorType.UNKNOWN,
          message: error.message || 'Unknown location error',
          code: error.code,
        };
    }
  }, []);

  /**
   * Request user's current location
   */
  const requestUserLocation = useCallback(async (): Promise<MapCenter | null> => {
    if (!('geolocation' in navigator)) {
      const error: LocationError = {
        type: LocationErrorType.NOT_SUPPORTED,
        message: 'Geolocation is not supported by your browser',
      };
      setLocationError(error);
      return null;
    }

    setIsLocating(true);
    setLocationError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Geolocation timeout'));
        }, GEOLOCATION_TIMEOUT);

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timeout);
            resolve(pos);
          },
          (err) => {
            clearTimeout(timeout);
            reject(err);
          },
          GEOLOCATION_OPTIONS
        );
      });

      const location: MapCenter = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setUserLocation(location);
      setLocationError(null);
      return location;

    } catch (error: any) {
      const locationErr = error instanceof GeolocationPositionError
        ? parseGeolocationError(error)
        : {
            type: LocationErrorType.UNKNOWN,
            message: error.message || 'Failed to get location',
          };
      
      setLocationError(locationErr);
      console.error('Geolocation error:', locationErr);
      return null;

    } finally {
      setIsLocating(false);
    }
  }, [parseGeolocationError]);

  /**
   * Center map on user's location
   */
  const centerOnUserLocation = useCallback(async (): Promise<boolean> => {
    if (!validateMapReady('center on user location')) return false;

    const location = await requestUserLocation();
    
    if (!location) {
      return false;
    }

    return flyToMapCenter(location, MAP_CONFIG.USER_LOCATION_ZOOM);
  }, [validateMapReady, requestUserLocation, flyToMapCenter]);

  /**
   * Watch user location continuously
   */
  const watchUserLocation = useCallback((
    callback: (center: MapCenter) => void
  ): number | null => {
    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not supported');
      return null;
    }

    try {
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
          const locationErr = parseGeolocationError(error);
          setLocationError(locationErr);
          console.error('Watch location error:', locationErr);
        },
        GEOLOCATION_OPTIONS
      );

      locationWatchId.current = watchId;
      return watchId;

    } catch (error) {
      console.error('Failed to watch location:', error);
      return null;
    }
  }, [parseGeolocationError]);

  /**
   * Clear location watch
   */
  const clearLocationWatch = useCallback((watchId: number): void => {
    if ('geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId);
      if (locationWatchId.current === watchId) {
        locationWatchId.current = null;
      }
    }
  }, []);

  // Cleanup location watch on unmount
  useEffect(() => {
    return () => {
      if (locationWatchId.current !== null) {
        clearLocationWatch(locationWatchId.current);
      }
    };
  }, [clearLocationWatch]);

  // ============================================================================
  // VIEW MANAGEMENT
  // ============================================================================

  /**
   * Reset to default view
   */
  const resetView = useCallback((): boolean => {
    if (!validateMapReady('reset view')) return false;

    try {
      const defaultCenter = MAP_CONFIG.DEFAULT_CENTER;
      const defaultZoom = MAP_CONFIG.DEFAULT_ZOOM;

      mapRef.current.map!.setView(
        [defaultCenter.lat, defaultCenter.lng],
        defaultZoom
      );

      setMapCenterState(defaultCenter);
      setMapZoomState(defaultZoom);
      return true;

    } catch (error) {
      console.error('Failed to reset view:', error);
      setMapError('Failed to reset view');
      return false;
    }
  }, [validateMapReady]);

  /**
   * Save current view to storage
   */
  const saveCurrentView = useCallback((): boolean => {
    if (!validateMapReady('save view')) return false;

    try {
      const center = mapRef.current.map!.getCenter();
      const zoom = mapRef.current.map!.getZoom();

      const viewState: SavedMapView = {
        center: { lat: center.lat, lng: center.lng },
        zoom,
        timestamp: new Date(),
      };

      setSavedView(viewState);
      return true;

    } catch (error) {
      console.error('Failed to save view:', error);
      return false;
    }
  }, [validateMapReady, setSavedView]);

  /**
   * Restore saved view from storage
   */
  const restoreSavedView = useCallback((): boolean => {
    if (!validateMapReady('restore view')) return false;

    if (!savedView) {
      console.warn('No saved view to restore');
      return false;
    }

    return flyToMapCenter(savedView.center, savedView.zoom);
  }, [validateMapReady, savedView, flyToMapCenter]);

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Invalidate map size (call after container resize)
   */
  const invalidateSize = useCallback((): boolean => {
    if (!validateMapReady('invalidate size')) return false;

    try {
      mapRef.current.map!.invalidateSize();
      return true;
    } catch (error) {
      console.error('Failed to invalidate size:', error);
      return false;
    }
  }, [validateMapReady]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // Map reference
    mapRef,

    // Current state
    mapCenter,
    mapZoom,
    mapBounds,

    // User location
    userLocation,
    isLocating,
    locationError,
    locationPermission,

    // Map readiness
    isMapReady,
    mapError,

    // Control methods
    setMapCenter,
    setMapZoom,
    flyToLocation,
    flyToMapCenter,
    fitBounds,
    panTo,
    zoomIn,
    zoomOut,

    // User location methods
    centerOnUserLocation,
    requestUserLocation,
    watchUserLocation,
    clearLocationWatch,

    // View management
    resetView,
    saveCurrentView,
    restoreSavedView,

    // Utility methods
    getMapInstance,
    isMapInitialized,
    invalidateSize,
  };
}

export default useMapControls;
