/**
 * useGeofencing Hook
 * Manages geofencing and location-based filtering
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrafficEvent } from '@types/api.types';
import { MapCenter, MapBounds } from '@types/map.types';
import { GEOFENCE } from '@utils/constants';
import { 
  isWithinGeofence, 
  calculateDistance,
  isPointInPolygon,
  boundsIntersectGeofence
} from '@utils/geoUtils';

interface UseGeofencingOptions {
  enabled?: boolean;
  customBounds?: MapBounds;
  customPolygon?: number[][];
  radiusMeters?: number;
  center?: MapCenter;
}

interface UseGeofencingResult {
  isWithinFence: (lat: number, lng: number) => boolean;
  filterEventsByGeofence: (events: TrafficEvent[]) => TrafficEvent[];
  filterEventsByRadius: (events: TrafficEvent[], center: MapCenter, radius: number) => TrafficEvent[];
  getEventsInBounds: (events: TrafficEvent[], bounds: MapBounds) => TrafficEvent[];
  getNearbyEvents: (events: TrafficEvent[], center: MapCenter, limit?: number) => TrafficEvent[];
  geofencePolygon: number[][];
  geofenceBounds: MapBounds;
  userInGeofence: boolean;
  checkLocationPermission: () => Promise<boolean>;
}

export function useGeofencing(options: UseGeofencingOptions = {}): UseGeofencingResult {
  const {
    enabled = true,
    customBounds,
    customPolygon,
    radiusMeters,
    center
  } = options;

  const [userLocation, setUserLocation] = useState<MapCenter | null>(null);
  const [userInGeofence, setUserInGeofence] = useState(false);

  // Get active geofence bounds
  const geofenceBounds = useMemo(() => {
    return customBounds || {
      north: GEOFENCE.BBOX.ymax,
      south: GEOFENCE.BBOX.ymin,
      east: GEOFENCE.BBOX.xmax,
      west: GEOFENCE.BBOX.xmin,
    };
  }, [customBounds]);

  // Get active geofence polygon
  const geofencePolygon = useMemo(() => {
    return customPolygon || GEOFENCE.POLYGON;
  }, [customPolygon]);

  // Check if a point is within the geofence
  const isWithinFence = useCallback((lat: number, lng: number): boolean => {
    if (!enabled) return true;

    // Check custom polygon first
    if (customPolygon) {
      return isPointInPolygon([lng, lat], customPolygon);
    }

    // Check radius if center and radius are provided
    if (center && radiusMeters) {
      const distance = calculateDistance(lat, lng, center.lat, center.lng);
      return distance <= radiusMeters;
    }

    // Check custom bounds
    if (customBounds) {
      return (
        lat >= customBounds.south &&
        lat <= customBounds.north &&
        lng >= customBounds.west &&
        lng <= customBounds.east
      );
    }

    // Default to standard geofence
    return isWithinGeofence(lat, lng);
  }, [enabled, customPolygon, customBounds, center, radiusMeters]);

  // Filter events by geofence
  const filterEventsByGeofence = useCallback((events: TrafficEvent[]): TrafficEvent[] => {
    if (!enabled) return events;

    return events.filter(event => {
      if (!event.geography?.coordinates) return false;

      const coords = Array.isArray(event.geography.coordinates[0])
        ? event.geography.coordinates[0]
        : event.geography.coordinates;
      const [lng, lat] = coords as number[];

      return isWithinFence(lat, lng);
    });
  }, [enabled, isWithinFence]);

  // Filter events by radius from a center point
  const filterEventsByRadius = useCallback(
    (events: TrafficEvent[], centerPoint: MapCenter, radius: number): TrafficEvent[] => {
      return events.filter(event => {
        if (!event.geography?.coordinates) return false;

        const coords = Array.isArray(event.geography.coordinates[0])
          ? event.geography.coordinates[0]
          : event.geography.coordinates;
        const [lng, lat] = coords as number[];

        const distance = calculateDistance(
          lat, 
          lng, 
          centerPoint.lat, 
          centerPoint.lng
        );

        return distance <= radius;
      });
    },
    []
  );

  // Get events within specific bounds
  const getEventsInBounds = useCallback(
    (events: TrafficEvent[], bounds: MapBounds): TrafficEvent[] => {
      return events.filter(event => {
        if (!event.geography?.coordinates) return false;

        const coords = Array.isArray(event.geography.coordinates[0])
          ? event.geography.coordinates[0]
          : event.geography.coordinates;
        const [lng, lat] = coords as number[];

        return (
          lat >= bounds.south &&
          lat <= bounds.north &&
          lng >= bounds.west &&
          lng <= bounds.east
        );
      });
    },
    []
  );

  // Get nearby events sorted by distance
  const getNearbyEvents = useCallback(
    (events: TrafficEvent[], centerPoint: MapCenter, limit: number = 10): TrafficEvent[] => {
      const eventsWithDistance = events
        .filter(event => event.geography?.coordinates)
        .map(event => {
          const coords = Array.isArray(event.geography.coordinates![0])
            ? event.geography.coordinates![0]
            : event.geography.coordinates!;
          const [lng, lat] = coords as number[];

          const distance = calculateDistance(
            lat,
            lng,
            centerPoint.lat,
            centerPoint.lng
          );

          return { event, distance };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit)
        .map(item => item.event);

      return eventsWithDistance;
    },
    []
  );

  // Check location permission
  const checkLocationPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.permissions) {
      return false;
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state === 'granted';
    } catch {
      return false;
    }
  }, []);

  // Track user location
  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;

    let watchId: number;

    const updateLocation = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      const location = { lat: latitude, lng: longitude };
      
      setUserLocation(location);
      setUserInGeofence(isWithinFence(latitude, longitude));
    };

    const handleError = (error: GeolocationPositionError) => {
      console.warn('Geolocation error:', error.message);
      setUserInGeofence(false);
    };

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 30000,
      }
    );

    // Watch for position changes
    watchId = navigator.geolocation.watchPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 30000,
      }
    );

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [enabled, isWithinFence]);

  return {
    isWithinFence,
    filterEventsByGeofence,
    filterEventsByRadius,
    getEventsInBounds,
    getNearbyEvents,
    geofencePolygon,
    geofenceBounds,
    userInGeofence,
    checkLocationPermission,
  };
}
