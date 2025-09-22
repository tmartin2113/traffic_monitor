/**
 * TrafficMap Component
 * Main map component for displaying traffic events
 */

import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { EventMarker } from './EventMarker';
import { ClosurePolyline } from './ClosurePolyline';
import { MarkerCluster } from './MarkerCluster';
import { TrafficEvent } from '@types/api.types';
import { MapRef, MapCenter } from '@types/map.types';
import { MAP_CONFIG, GEOFENCE } from '@utils/constants';
import { isWithinGeofence } from '@utils/geoUtils';

interface TrafficMapProps {
  events: TrafficEvent[];
  selectedEvent: TrafficEvent | null;
  onEventSelect: (event: TrafficEvent) => void;
  center?: MapCenter;
  zoom?: number;
  onCenterChange?: (center: MapCenter) => void;
  onZoomChange?: (zoom: number) => void;
  showGeofence?: boolean;
  clusterMarkers?: boolean;
}

export const TrafficMap = forwardRef<MapRef, TrafficMapProps>((props, ref) => {
  const {
    events,
    selectedEvent,
    onEventSelect,
    center = MAP_CONFIG.DEFAULT_CENTER,
    zoom = MAP_CONFIG.DEFAULT_ZOOM,
    onCenterChange,
    onZoomChange,
    showGeofence = true,
    clusterMarkers = true,
  } = props;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const layersRef = useRef<Map<string, L.LayerGroup>>(new Map());
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const geofenceLayerRef = useRef<L.Polygon | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Create map instance
    const map = L.map(mapContainerRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
      maxZoom: MAP_CONFIG.MAX_ZOOM,
      minZoom: MAP_CONFIG.MIN_ZOOM,
    });

    // Add tile layer
    L.tileLayer(MAP_CONFIG.TILE_LAYER.URL, {
      attribution: MAP_CONFIG.TILE_LAYER.ATTRIBUTION,
    }).addTo(map);

    // Add geofence polygon if enabled
    if (showGeofence) {
      const geofencePolygon = L.polygon(GEOFENCE.POLYGON as L.LatLngExpression[], {
        ...GEOFENCE.STYLE,
        className: 'geofence-boundary',
      }).addTo(map);
      geofenceLayerRef.current = geofencePolygon;
    }

    // Initialize marker cluster group if enabled
    if (clusterMarkers) {
      const clusterGroup = L.markerClusterGroup(MAP_CONFIG.CLUSTER_OPTIONS);
      map.addLayer(clusterGroup);
      clusterGroupRef.current = clusterGroup;
    }

    // Add event listeners
    map.on('moveend', () => {
      const center = map.getCenter();
      onCenterChange?.({ lat: center.lat, lng: center.lng });
    });

    map.on('zoomend', () => {
      onZoomChange?.(map.getZoom());
    });

    mapInstanceRef.current = map;

    // Cleanup
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // Only run once on mount

  // Update map view when center or zoom changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    const currentCenter = mapInstanceRef.current.getCenter();
    const currentZoom = mapInstanceRef.current.getZoom();
    
    if (currentCenter.lat !== center.lat || currentCenter.lng !== center.lng || currentZoom !== zoom) {
      mapInstanceRef.current.setView([center.lat, center.lng], zoom);
    }
  }, [center, zoom]);

  // Clear all markers
  const clearMarkers = useCallback(() => {
    if (clusterGroupRef.current) {
      clusterGroupRef.current.clearLayers();
    } else {
      markersRef.current.forEach((marker) => {
        mapInstanceRef.current?.removeLayer(marker);
      });
    }
    markersRef.current.clear();
  }, []);

  // Clear all polylines
  const clearPolylines = useCallback(() => {
    polylinesRef.current.forEach((polyline) => {
      mapInstanceRef.current?.removeLayer(polyline);
    });
    polylinesRef.current.clear();
  }, []);

  // Add marker to map
  const addMarker = useCallback((id: string, marker: L.Marker) => {
    if (!mapInstanceRef.current) return;

    if (clusterGroupRef.current) {
      clusterGroupRef.current.addLayer(marker);
    } else {
      marker.addTo(mapInstanceRef.current);
    }
    markersRef.current.set(id, marker);
  }, []);

  // Add polyline to map
  const addPolyline = useCallback((id: string, polyline: L.Polyline) => {
    if (!mapInstanceRef.current) return;
    
    polyline.addTo(mapInstanceRef.current);
    polylinesRef.current.set(id, polyline);
  }, []);

  // Update events on map
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers and polylines
    clearMarkers();
    clearPolylines();

    // Add new markers for each event
    events.forEach((event) => {
      // Check if event is within geofence
      if (event.geography?.coordinates) {
        const coords = Array.isArray(event.geography.coordinates[0])
          ? event.geography.coordinates[0]
          : event.geography.coordinates;
        const [lng, lat] = coords as number[];

        if (!isWithinGeofence(lat, lng)) return;

        // Create event marker
        const marker = EventMarker.create({
          event,
          isSelected: selectedEvent?.id === event.id,
          onClick: () => onEventSelect(event),
        });

        if (marker) {
          addMarker(event.id, marker);
        }
      }

      // Add closure polylines if available
      if (event['+closure_geometry']?.coordinates) {
        event['+closure_geometry'].coordinates.forEach((lineCoords, index) => {
          const polyline = ClosurePolyline.create({
            coordinates: lineCoords,
            event,
            onClick: () => onEventSelect(event),
          });

          if (polyline) {
            addPolyline(`${event.id}-closure-${index}`, polyline);
          }
        });
      }
    });
  }, [events, selectedEvent, onEventSelect, clearMarkers, clearPolylines, addMarker, addPolyline]);

  // Imperative handle for ref
  useImperativeHandle(ref, () => ({
    map: mapInstanceRef.current,
    markers: markersRef.current,
    polylines: polylinesRef.current,
    layers: layersRef.current,
    
    addMarker,
    removeMarker: (id: string) => {
      const marker = markersRef.current.get(id);
      if (marker) {
        if (clusterGroupRef.current) {
          clusterGroupRef.current.removeLayer(marker);
        } else {
          mapInstanceRef.current?.removeLayer(marker);
        }
        markersRef.current.delete(id);
      }
    },
    clearMarkers,
    
    addPolyline,
    removePolyline: (id: string) => {
      const polyline = polylinesRef.current.get(id);
      if (polyline) {
        mapInstanceRef.current?.removeLayer(polyline);
        polylinesRef.current.delete(id);
      }
    },
    clearPolylines,
    
    setView: (center: MapCenter, zoom?: number) => {
      mapInstanceRef.current?.setView([center.lat, center.lng], zoom);
    },
    
    fitBounds: (bounds) => {
      mapInstanceRef.current?.fitBounds([
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ]);
    },
    
    flyTo: (center: MapCenter, zoom?: number) => {
      mapInstanceRef.current?.flyTo([center.lat, center.lng], zoom);
    },
    
    getCenter: () => {
      const center = mapInstanceRef.current?.getCenter();
      return center ? { lat: center.lat, lng: center.lng } : null;
    },
    
    getZoom: () => mapInstanceRef.current?.getZoom() || null,
    
    getBounds: () => {
      const bounds = mapInstanceRef.current?.getBounds();
      return bounds
        ? {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          }
        : null;
    },
    
    invalidateSize: () => {
      mapInstanceRef.current?.invalidateSize();
    },
    
    locate: () => {
      mapInstanceRef.current?.locate({ setView: true, maxZoom: 16 });
    },
  }), [addMarker, addPolyline, clearMarkers, clearPolylines]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      mapInstanceRef.current?.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={mapContainerRef}
      className="traffic-map"
      id="map"
      aria-label="Traffic events map"
      role="application"
    />
  );
});

TrafficMap.displayName = 'TrafficMap';
