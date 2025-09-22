/**
 * useMapControls Hook
 * Manages map state and controls
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { MapRef, MapCenter, MapBounds } from '@types/map.types';
import { MAP_CONFIG, STORAGE_KEYS } from '@utils/constants';
import { useLocalStorage } from './useLocalStorage';

interface UseMapControlsResult {
  mapRef: React.RefObject<MapRef>;
  mapCenter: MapCenter;
  mapZoom: number;
  mapBounds: MapBounds | null;
  userLocation: MapCenter | null;
  isLocating: boolean;
  locationError: string | null;
  
  setMapCenter: (center: MapCenter) => void;
  setMapZoom: (zoom: number) => void;
  flyToLocation: (lat: number, lng: number, zoom?: number) => void;
  fitBounds: (bounds: MapBounds) => void;
  centerOnUserLocation: () => void;
  resetView: () => void;
  saveCurrentView: () => void;
}

interface SavedMapView {
  center: MapCenter;
  zoom: number;
}

export function useMapControls(): UseMapControlsResult {
  const mapRef = useRef<MapRef>(null);
  
  // Load saved view or use defaults
  const [savedView, setSavedView] = useLocalStorage<SavedMapView | null>(
    STORAGE_KEYS.MAP_VIEW,
    null
  );
  
  const [mapCenter, setMapCenter] = useState<MapCenter>(
    savedView?.center || MAP_CONFIG.DEFAULT_CENTER
  );
  
  const [mapZoom, setMapZoom] = useState<number>(
    savedView?.zoom || MAP_CONFIG.DEFAULT_ZOOM
  );
  
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [userLocation, setUserLocation] = useState<MapCenter | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Update bounds when map moves
  useEffect(() => {
    if (mapRef.current?.map) {
      const bounds = mapRef.current.getBounds();
      if (bounds) {
        setMapBounds(bounds);
      }
    }
  }, [mapCenter, mapZoom]);

  // Fly to a specific location
  const flyToLocation = useCallback((lat: number, lng: number, zoom?: number) => {
    const newCenter = { lat, lng };
    const newZoom = zoom || mapZoom;
    
    if (mapRef.current) {
      mapRef.current.flyTo(newCenter, newZoom);
    }
    
    setMapCenter(newCenter);
    if (zoom) setMapZoom(zoom);
  }, [mapZoom]);

  // Fit map to bounds
  const fitBounds = useCallback((bounds: MapBounds) => {
    if (mapRef.current) {
      mapRef.current.fitBounds(bounds);
      
      // Update state after fitting bounds
      setTimeout(() => {
        const newCenter = mapRef.current?.getCenter();
        const newZoom = mapRef.current?.getZoom();
        
        if (newCenter) setMapCenter(newCenter);
        if (newZoom) setMapZoom(newZoom);
        setMapBounds(bounds);
      }, 300);
    }
  }, []);

  // Get user's current location
  const centerOnUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const location = { lat: latitude, lng: longitude };
        
        setUserLocation(location);
        flyToLocation(latitude, longitude, 14);
        setIsLocating(false);
        
        // Add a marker for user location if map is ready
        if (mapRef.current?.map) {
          // This could be extended to add an actual marker
          console.log('User location:', location);
        }
      },
      (error) => {
        setIsLocating(false);
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location access denied. Please enable location permissions.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location information unavailable.');
            break;
          case error.TIMEOUT:
            setLocationError('Location request timed out.');
            break;
          default:
            setLocationError('An unknown error occurred.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, [flyToLocation]);

  // Reset view to default
  const resetView = useCallback(() => {
    const defaultCenter = MAP_CONFIG.DEFAULT_CENTER;
    const defaultZoom = MAP_CONFIG.DEFAULT_ZOOM;
    
    flyToLocation(defaultCenter.lat, defaultCenter.lng, defaultZoom);
  }, [flyToLocation]);

  // Save current view to localStorage
  const saveCurrentView = useCallback(() => {
    const view: SavedMapView = {
      center: mapCenter,
      zoom: mapZoom,
    };
    setSavedView(view);
  }, [mapCenter, mapZoom, setSavedView]);

  // Watch for user location updates
  useEffect(() => {
    if (!userLocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
      },
      null,
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 30000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [userLocation]);

  return {
    mapRef,
    mapCenter,
    mapZoom,
    mapBounds,
    userLocation,
    isLocating,
    locationError,
    setMapCenter,
    setMapZoom,
    flyToLocation,
    fitBounds,
    centerOnUserLocation,
    resetView,
    saveCurrentView,
  };
}
