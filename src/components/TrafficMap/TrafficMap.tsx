/**
 * TrafficMap Component
 * Production-ready map component using React-Leaflet v4
 * @author 511 Traffic Monitor
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L, { LatLng, LatLngBounds, DivIcon } from 'leaflet';
import { AlertCircle, Construction, Calendar, Navigation, Clock, ChevronRight, MapPin } from 'lucide-react';
import { TrafficEvent, EventType, EventSeverity } from '@types/api.types';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { logger } from '@utils/logger';

/* ========================
   Type Definitions
======================== */

export interface MapBounds {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

interface TrafficMapProps {
  events: TrafficEvent[];
  closureEvents: TrafficEvent[];
  selectedEvent: TrafficEvent | null;
  onEventSelect: (event: TrafficEvent) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  onMapReady?: (map: L.Map) => void;
  center?: [number, number];
  zoom?: number;
  showGeofence?: boolean;
  clusterEvents?: boolean;
}

/* ========================
   Constants
======================== */

const MAP_CONFIG = {
  DEFAULT_CENTER: [37.7749, -122.4194] as [number, number], // San Francisco
  DEFAULT_ZOOM: 11,
  MIN_ZOOM: 8,
  MAX_ZOOM: 18,
  TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  UPDATE_BOUNDS_DELAY: 500, // ms
};

const GEOFENCE_BOUNDS = {
  POLYGON: [
    [38.5, -123.5],
    [38.5, -121.0],
    [36.5, -121.0],
    [36.5, -123.5],
    [38.5, -123.5],
  ] as [number, number][],
  STYLE: {
    color: '#3b82f6',
    weight: 2,
    opacity: 0.4,
    fillOpacity: 0.05,
    dashArray: '10, 10',
  },
};

const EVENT_ICONS = {
  INCIDENT: {
    className: 'incident-marker',
    html: '<div class="marker-icon incident"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></svg></div>',
    size: [32, 32] as [number, number],
  },
  CONSTRUCTION: {
    className: 'construction-marker',
    html: '<div class="marker-icon construction"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></div>',
    size: [32, 32] as [number, number],
  },
  SPECIAL_EVENT: {
    className: 'special-event-marker',
    html: '<div class="marker-icon special-event"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>',
    size: [32, 32] as [number, number],
  },
  ROAD_CONDITION: {
    className: 'road-condition-marker',
    html: '<div class="marker-icon road-condition"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>',
    size: [32, 32] as [number, number],
  },
  WEATHER_CONDITION: {
    className: 'weather-marker',
    html: '<div class="marker-icon weather"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg></div>',
    size: [32, 32] as [number, number],
  },
};

/* ========================
   Utility Functions
======================== */

const createEventIcon = (event: TrafficEvent): DivIcon => {
  const config = EVENT_ICONS[event.event_type] || EVENT_ICONS.INCIDENT;
  
  let severityClass = '';
  switch (event.severity) {
    case EventSeverity.MAJOR:
      severityClass = 'severity-major';
      break;
    case EventSeverity.MODERATE:
      severityClass = 'severity-moderate';
      break;
    case EventSeverity.MINOR:
      severityClass = 'severity-minor';
      break;
    default:
      severityClass = 'severity-unknown';
  }
  
  return L.divIcon({
    className: clsx(config.className, severityClass),
    html: config.html,
    iconSize: config.size,
    iconAnchor: [config.size[0] / 2, config.size[1] / 2],
    popupAnchor: [0, -config.size[1] / 2],
  });
};

const getEventPosition = (event: TrafficEvent): [number, number] | null => {
  try {
    if (event.geography?.type === 'Point' && event.geography.coordinates) {
      const [lon, lat] = event.geography.coordinates as [number, number];
      return [lat, lon];
    }
    
    if (event.geography?.type === 'LineString' && event.geography.coordinates) {
      const coords = event.geography.coordinates as [number, number][];
      const midIndex = Math.floor(coords.length / 2);
      const [lon, lat] = coords[midIndex];
      return [lat, lon];
    }
    
    if (event.geography?.type === 'MultiLineString' && event.geography.coordinates) {
      const firstLine = (event.geography.coordinates as [number, number][][])[0];
      const midIndex = Math.floor(firstLine.length / 2);
      const [lon, lat] = firstLine[midIndex];
      return [lat, lon];
    }
    
    return null;
  } catch (error) {
    logger.error(`Failed to get position for event ${event.id}`, error);
    return null;
  }
};

const getClosurePolyline = (event: TrafficEvent): [number, number][] | null => {
  try {
    const geometry = event.closure_geography || event.geography;
    if (!geometry) return null;
    
    if (geometry.type === 'LineString' && geometry.coordinates) {
      return (geometry.coordinates as [number, number][]).map(([lon, lat]) => [lat, lon]);
    }
    
    if (geometry.type === 'MultiLineString' && geometry.coordinates) {
      // Flatten multi-line string
      return (geometry.coordinates as [number, number][][])
        .flat()
        .map(([lon, lat]) => [lat, lon]);
    }
    
    return null;
  } catch (error) {
    logger.error(`Failed to get polyline for event ${event.id}`, error);
    return null;
  }
};

/* ========================
   Sub-Components
======================== */

// Map event handler component
const MapEventHandler: React.FC<{
  onBoundsChange?: (bounds: MapBounds) => void;
  onMapReady?: (map: L.Map) => void;
}> = ({ onBoundsChange, onMapReady }) => {
  const map = useMap();
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  
  useMapEvents({
    moveend: () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      updateTimeoutRef.current = setTimeout(() => {
        const bounds = map.getBounds();
        onBoundsChange?.({
          xmin: bounds.getWest(),
          ymin: bounds.getSouth(),
          xmax: bounds.getEast(),
          ymax: bounds.getNorth(),
        });
      }, MAP_CONFIG.UPDATE_BOUNDS_DELAY);
    },
    zoomend: () => {
      const bounds = map.getBounds();
      onBoundsChange?.({
        xmin: bounds.getWest(),
        ymin: bounds.getSouth(),
        xmax: bounds.getEast(),
        ymax: bounds.getNorth(),
      });
    },
  });
  
  useEffect(() => {
    onMapReady?.(map);
  }, [map, onMapReady]);
  
  return null;
};

// Map controller component for external control
const MapController: React.FC<{
  selectedEvent: TrafficEvent | null;
}> = ({ selectedEvent }) => {
  const map = useMap();
  const lastSelectedRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!selectedEvent || selectedEvent.id === lastSelectedRef.current) return;
    
    lastSelectedRef.current = selectedEvent.id;
    
    // Get event position or polyline
    const position = getEventPosition(selectedEvent);
    const polyline = getClosurePolyline(selectedEvent);
    
    if (polyline && polyline.length > 0) {
      // Fit to polyline bounds
      const bounds = L.latLngBounds(polyline);
      map.fitBounds(bounds, { 
        padding: [50, 50],
        maxZoom: 15,
        animate: true,
      });
    } else if (position) {
      // Pan to marker
      map.flyTo(position, 14, { 
        animate: true,
        duration: 0.8,
      });
    }
  }, [selectedEvent, map]);
  
  return null;
};

// Event marker component
const EventMarkerComponent: React.FC<{
  event: TrafficEvent;
  selected: boolean;
  onSelect: (event: TrafficEvent) => void;
}> = ({ event, selected, onSelect }) => {
  const position = getEventPosition(event);
  
  if (!position) return null;
  
  const icon = createEventIcon(event);
  const roadName = event.roads?.[0]?.name || 'Unknown Road';
  const timeAgo = event.updated 
    ? formatDistanceToNow(new Date(event.updated), { addSuffix: true })
    : 'Unknown time';
  
  return (
    <Marker
      position={position}
      icon={icon}
      eventHandlers={{
        click: () => onSelect(event),
      }}
    >
      <Popup className="traffic-popup" maxWidth={300}>
        <div className="p-0">
          {/* Header */}
          <div className={clsx(
            'px-3 py-2 -m-3 mb-3 text-white font-medium',
            event.severity === EventSeverity.MAJOR && 'bg-red-600',
            event.severity === EventSeverity.MODERATE && 'bg-orange-600',
            event.severity === EventSeverity.MINOR && 'bg-yellow-600',
            (!event.severity || event.severity === EventSeverity.UNKNOWN) && 'bg-gray-600'
          )}>
            {event.event_type.replace(/_/g, ' ')}
          </div>
          
          {/* Content */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">{event.headline}</h3>
            
            <div className="space-y-1 text-sm text-gray-600">
              {roadName && (
                <div className="flex items-center gap-2">
                  <Navigation className="w-3 h-3" />
                  <span>{roadName}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                <span>Updated {timeAgo}</span>
              </div>
              
              {event.severity && event.severity !== EventSeverity.UNKNOWN && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" />
                  <span className="capitalize">{event.severity.toLowerCase()} Impact</span>
                </div>
              )}
            </div>
            
            {event.description && (
              <p className="text-sm text-gray-700 pt-2 border-t">
                {event.description.length > 150 
                  ? `${event.description.substring(0, 150)}...` 
                  : event.description}
              </p>
            )}
            
            <button
              onClick={() => onSelect(event)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium pt-2"
            >
              View Details
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

// Closure polyline component
const ClosurePolylineComponent: React.FC<{
  event: TrafficEvent;
  selected: boolean;
  onSelect: (event: TrafficEvent) => void;
}> = ({ event, selected, onSelect }) => {
  const polyline = getClosurePolyline(event);
  
  if (!polyline || polyline.length === 0) return null;
  
  return (
    <Polyline
      positions={polyline}
      pathOptions={{
        color: selected ? '#dc2626' : '#ef4444',
        weight: selected ? 6 : 4,
        opacity: selected ? 0.9 : 0.7,
        dashArray: selected ? '15, 10' : '10, 10',
      }}
      eventHandlers={{
        click: () => onSelect(event),
      }}
    >
      <Popup className="traffic-popup" maxWidth={300}>
        <div className="p-0">
          <div className="px-3 py-2 -m-3 mb-3 bg-red-600 text-white font-medium">
            ROAD CLOSURE
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">{event.headline}</h3>
            <button
              onClick={() => onSelect(event)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View Details
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </Popup>
    </Polyline>
  );
};

/* ========================
   Main Component
======================== */

const TrafficMap: React.FC<TrafficMapProps> = ({
  events,
  closureEvents,
  selectedEvent,
  onEventSelect,
  onBoundsChange,
  onMapReady,
  center = MAP_CONFIG.DEFAULT_CENTER,
  zoom = MAP_CONFIG.DEFAULT_ZOOM,
  showGeofence = true,
  clusterEvents = true,
}) => {
  const [mapReady, setMapReady] = useState(false);
  const mapInstanceRef = useRef<L.Map | null>(null);
  
  // Filter events with valid positions
  const markeredEvents = useMemo(() => {
    return events.filter(event => getEventPosition(event) !== null);
  }, [events]);
  
  // Handle map ready
  const handleMapReady = useCallback((map: L.Map) => {
    mapInstanceRef.current = map;
    setMapReady(true);
    onMapReady?.(map);
    
    // Set initial bounds
    const bounds = map.getBounds();
    onBoundsChange?.({
      xmin: bounds.getWest(),
      ymin: bounds.getSouth(),
      xmax: bounds.getEast(),
      ymax: bounds.getNorth(),
    });
  }, [onMapReady, onBoundsChange]);
  
  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={MAP_CONFIG.MIN_ZOOM}
        maxZoom={MAP_CONFIG.MAX_ZOOM}
        className="w-full h-full"
        zoomControl={true}
        scrollWheelZoom={true}
      >
        {/* Tile Layer */}
        <TileLayer
          url={MAP_CONFIG.TILE_URL}
          attribution={MAP_CONFIG.TILE_ATTRIBUTION}
          crossOrigin="anonymous"
        />
        
        {/* Map Event Handlers */}
        <MapEventHandler 
          onBoundsChange={onBoundsChange}
          onMapReady={handleMapReady}
        />
        
        {/* Map Controller for External Updates */}
        <MapController selectedEvent={selectedEvent} />
        
        {/* Geofence Boundary */}
        {showGeofence && (
          <Polygon
            positions={GEOFENCE_BOUNDS.POLYGON}
            pathOptions={GEOFENCE_BOUNDS.STYLE}
          />
        )}
        
        {/* Closure Polylines */}
        {closureEvents.map(event => (
          <ClosurePolylineComponent
            key={`closure-${event.id}`}
            event={event}
            selected={selectedEvent?.id === event.id}
            onSelect={onEventSelect}
          />
        ))}
        
        {/* Event Markers */}
        {clusterEvents ? (
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            zoomToBoundsOnClick={true}
            removeOutsideVisibleBounds={true}
            animate={true}
            animateAddingMarkers={true}
            disableClusteringAtZoom={15}
            spiderLegPolylineOptions={{
              weight: 1.5,
              color: '#222',
              opacity: 0.5,
            }}
          >
            {markeredEvents.map(event => (
              <EventMarkerComponent
                key={event.id}
                event={event}
                selected={selectedEvent?.id === event.id}
                onSelect={onEventSelect}
              />
            ))}
          </MarkerClusterGroup>
        ) : (
          <>
            {markeredEvents.map(event => (
              <EventMarkerComponent
                key={event.id}
                event={event}
                selected={selectedEvent?.id === event.id}
                onSelect={onEventSelect}
              />
            ))}
          </>
        )}
      </MapContainer>
      
      {/* Map Loading Indicator */}
      {!mapReady && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-[1000]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrafficMap;

/* ========================
   CSS Styles (add to map.css)
======================== */

const mapStyles = `
/* Event Marker Icons */
.marker-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
}

.marker-icon:hover {
  transform: scale(1.1);
}

.marker-icon svg {
  width: 18px;
  height: 18px;
}

/* Event Type Colors */
.marker-icon.incident {
  background: #ef4444;
  color: white;
}

.marker-icon.construction {
  background: #f97316;
  color: white;
}

.marker-icon.special-event {
  background: #8b5cf6;
  color: white;
}

.marker-icon.road-condition {
  background: #6366f1;
  color: white;
}

.marker-icon.weather {
  background: #0ea5e9;
  color: white;
}

/* Severity Modifiers */
.severity-major .marker-icon {
  border-color: #dc2626;
  border-width: 3px;
  animation: pulse 2s infinite;
}

.severity-moderate .marker-icon {
  border-color: #f97316;
  border-width: 2px;
}

.severity-minor .marker-icon {
  border-color: #fbbf24;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(220, 38, 38, 0);
  }
}

/* Cluster Styles */
.marker-cluster {
  background: rgba(59, 130, 246, 0.6);
  border: 2px solid #3b82f6;
}

.marker-cluster div {
  background: #3b82f6;
  color: white;
  font-weight: bold;
}

.marker-cluster-small {
  background: rgba(34, 197, 94, 0.6);
  border-color: #22c55e;
}

.marker-cluster-small div {
  background: #22c55e;
}

.marker-cluster-medium {
  background: rgba(251, 146, 60, 0.6);
  border-color: #fb923c;
}

.marker-cluster-medium div {
  background: #fb923c;
}

.marker-cluster-large {
  background: rgba(239, 68, 68, 0.6);
  border-color: #ef4444;
}

.marker-cluster-large div {
  background: #ef4444;
}
`;
