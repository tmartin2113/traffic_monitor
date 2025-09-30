/**
 * @file components/TrafficMap.tsx
 * @description Production-ready React-Leaflet component for displaying traffic events
 * @version 1.0.0
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Polygon,
  Popup,
  LayersControl,
  ZoomControl,
  useMap
} from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import { GeoJSON } from 'geojson';
import {
  TrafficEvent,
  EventType,
  EventSeverity
} from '../types/TrafficEvent';
import {
  useTrafficEvents,
  useAvailableMetros,
  Metro,
  metroConfigs
} from '../providers/registry';

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

/**
 * Fix for default markers in React-Leaflet
 */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

/**
 * Event type colors and icons
 */
const EVENT_STYLES: Record<EventType, { color: string; icon: string; zIndex: number }> = {
  [EventType.ACCIDENT]: { color: '#DC2626', icon: '⚠️', zIndex: 1000 },
  [EventType.CONSTRUCTION]: { color: '#F59E0B', icon: '🚧', zIndex: 800 },
  [EventType.ROAD_CLOSURE]: { color: '#EF4444', icon: '🚫', zIndex: 900 },
  [EventType.LANE_CLOSURE]: { color: '#FB923C', icon: '⛔', zIndex: 700 },
  [EventType.SPECIAL_EVENT]: { color: '#8B5CF6', icon: '📅', zIndex: 600 },
  [EventType.WEATHER]: { color: '#3B82F6', icon: '🌧️', zIndex: 500 },
  [EventType.TRAFFIC_CONGESTION]: { color: '#FACC15', icon: '🚗', zIndex: 400 },
  [EventType.HAZARD]: { color: '#F97316', icon: '⚡', zIndex: 600 },
  [EventType.OTHER]: { color: '#6B7280', icon: '📍', zIndex: 300 }
};

/**
 * Severity opacity mapping
 */
const SEVERITY_OPACITY: Record<EventSeverity, number> = {
  [EventSeverity.CRITICAL]: 1.0,
  [EventSeverity.MAJOR]: 0.85,
  [EventSeverity.MODERATE]: 0.7,
  [EventSeverity.MINOR]: 0.55,
  [EventSeverity.UNKNOWN]: 0.6
};

/**
 * Props for the TrafficMap component
 */
interface TrafficMapProps {
  initialMetro?: Metro;
  height?: string;
  onEventClick?: (event: TrafficEvent) => void;
  onMetroChange?: (metro: Metro) => void;
  showControls?: boolean;
  showMetrics?: boolean;
  autoRefresh?: boolean;
  filters?: {
    eventTypes?: EventType[];
    severities?: EventSeverity[];
    searchQuery?: string;
  };
}

/**
 * Map updater component to handle metro changes
 */
const MapUpdater: React.FC<{ metro: Metro }> = ({ metro }) => {
  const map = useMap();
  const config = metroConfigs[metro];
  
  useEffect(() => {
    if (config.bounds) {
      map.fitBounds(config.bounds);
    } else {
      map.setView(config.center, config.zoom);
    }
  }, [metro, config, map]);
  
  return null;
};

/**
 * Create a custom icon for map markers
 */
const createCustomIcon = (event: TrafficEvent): L.DivIcon => {
  const style = EVENT_STYLES[event.eventType];
  const opacity = SEVERITY_OPACITY[event.severity || EventSeverity.UNKNOWN];
  
  return L.divIcon({
    html: `
      <div class="custom-marker" style="
        background-color: ${style.color};
        opacity: ${opacity};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        font-size: 18px;
      ">
        ${style.icon}
      </div>
    `,
    className: 'traffic-event-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

/**
 * Render geometry on the map
 */
const GeometryRenderer: React.FC<{ 
  event: TrafficEvent; 
  onClick?: (event: TrafficEvent) => void;
}> = ({ event, onClick }) => {
  const style = EVENT_STYLES[event.eventType];
  const opacity = SEVERITY_OPACITY[event.severity || EventSeverity.UNKNOWN];
  
  const handleClick = useCallback(() => {
    onClick?.(event);
  }, [event, onClick]);
  
  const popupContent = useMemo(() => (
    <div className="traffic-popup">
      <h3 className="font-semibold text-lg">{event.headline}</h3>
      {event.description && (
        <p className="text-sm mt-2">{event.description}</p>
      )}
      <div className="mt-2 text-xs text-gray-600">
        {event.roads && event.roads.length > 0 && (
          <div>Roads: {event.roads.join(', ')}</div>
        )}
        {event.startTime && (
          <div>Started: {new Date(event.startTime).toLocaleString()}</div>
        )}
        {event.endTime && (
          <div>Ends: {new Date(event.endTime).toLocaleString()}</div>
        )}
        <div>Source: {event.source}</div>
        <div>Last Updated: {event.updated ? new Date(event.updated).toLocaleTimeString() : 'Unknown'}</div>
      </div>
    </div>
  ), [event]);
  
  try {
    switch (event.geometry.type) {
      case 'Point': {
        const coords = event.geometry.coordinates as [number, number];
        const position: LatLngExpression = [coords[1], coords[0]];
        
        return (
          <Marker
            position={position}
            icon={createCustomIcon(event)}
            eventHandlers={{ click: handleClick }}
            zIndexOffset={style.zIndex}
          >
            <Popup>{popupContent}</Popup>
          </Marker>
        );
      }
      
      case 'LineString': {
        const coords = event.geometry.coordinates as [number, number][];
        const positions: LatLngExpression[] = coords.map(c => [c[1], c[0]]);
        
        return (
          <Polyline
            positions={positions}
            color={style.color}
            weight={4}
            opacity={opacity}
            eventHandlers={{ click: handleClick }}
          >
            <Popup>{popupContent}</Popup>
          </Polyline>
        );
      }
      
      case 'Polygon': {
        const coords = event.geometry.coordinates[0] as [number, number][];
        const positions: LatLngExpression[] = coords.map(c => [c[1], c[0]]);
        
        return (
          <Polygon
            positions={positions}
            color={style.color}
            fillColor={style.color}
            fillOpacity={opacity * 0.3}
            weight={2}
            opacity={opacity}
            eventHandlers={{ click: handleClick }}
          >
            <Popup>{popupContent}</Popup>
          </Polygon>
        );
      }
      
      case 'MultiPoint':
      case 'MultiLineString':
      case 'MultiPolygon':
        // Handle multi-geometries by rendering each part
        return (
          <>
            {event.geometry.type === 'MultiPoint' &&
              (event.geometry.coordinates as [number, number][]).map((coords, idx) => (
                <Marker
                  key={`${event.id}-${idx}`}
                  position={[coords[1], coords[0]]}
                  icon={createCustomIcon(event)}
                  eventHandlers={{ click: handleClick }}
                >
                  <Popup>{popupContent}</Popup>
                </Marker>
              ))}
          </>
        );
      
      default:
        console.warn(`Unsupported geometry type: ${event.geometry.type}`);
        return null;
    }
  } catch (error) {
    console.error(`Error rendering geometry for event ${event.id}:`, error);
    return null;
  }
};

/**
 * Main Traffic Map Component
 */
export const TrafficMap: React.FC<TrafficMapProps> = ({
  initialMetro = Metro.BAY_AREA,
  height = '600px',
  onEventClick,
  onMetroChange,
  showControls = true,
  showMetrics = false,
  autoRefresh = true,
  filters
}) => {
  const [selectedMetro, setSelectedMetro] = useState<Metro>(initialMetro);
  const [mapReady, setMapReady] = useState(false);
  
  // Fetch available metros
  const { metros, isLoading: metrosLoading } = useAvailableMetros();
  
  // Fetch traffic events for selected metro
  const {
    data: events = [],
    isLoading,
    isError,
    error,
    refetch,
    metrics
  } = useTrafficEvents(selectedMetro, {
    enabled: mapReady && !metrosLoading,
    refetchInterval: autoRefresh ? 30000 : undefined,
    onError: (err) => {
      console.error('Failed to fetch traffic events:', err);
    }
  });
  
  // Filter events based on provided filters
  const filteredEvents = useMemo(() => {
    let filtered = [...events];
    
    if (filters?.eventTypes && filters.eventTypes.length > 0) {
      filtered = filtered.filter(e => filters.eventTypes!.includes(e.eventType));
    }
    
    if (filters?.severities && filters.severities.length > 0) {
      filtered = filtered.filter(e => 
        e.severity && filters.severities!.includes(e.severity)
      );
    }
    
    if (filters?.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.headline.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        e.roads?.some(r => r.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [events, filters]);
  
  // Handle metro change
  const handleMetroChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const metro = e.target.value as Metro;
    setSelectedMetro(metro);
    onMetroChange?.(metro);
  }, [onMetroChange]);
  
  const currentConfig = metroConfigs[selectedMetro];
  
  return (
    <div className="traffic-map-container" style={{ height }}>
      {/* Controls */}
      {showControls && (
        <div className="map-controls bg-white p-4 shadow-md mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="font-semibold">
                Metro Area:
                <select
                  value={selectedMetro}
                  onChange={handleMetroChange}
                  className="ml-2 p-2 border rounded"
                  disabled={metrosLoading}
                >
                  {metros.map(({ key, config }) => (
                    <option key={key} value={key}>
                      {config.displayName}
                    </option>
                  ))}
                </select>
              </label>
              
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            
            <div className="flex items-center gap-4">
              {filteredEvents.length !== events.length && (
                <span className="text-sm text-gray-600">
                  Showing {filteredEvents.length} of {events.length} events
                </span>
              )}
              
              {autoRefresh && (
                <span className="text-sm text-green-600">
                  ↻ Auto-refresh enabled
                </span>
              )}
            </div>
          </div>
          
          {/* Metrics */}
          {showMetrics && metrics && (
            <div className="mt-2 text-xs text-gray-500">
              Provider: {metrics.provider} | 
              Requests: {metrics.requestCount} | 
              Errors: {metrics.errorCount} | 
              Avg Response: {metrics.averageResponseTime.toFixed(0)}ms
              {metrics.lastError && (
                <span className="text-red-500"> | Last Error: {metrics.lastError}</span>
              )}
            </div>
          )}
          
          {/* Error display */}
          {isError && (
            <div className="mt-2 p-2 bg-red-100 text-red-700 rounded">
              Error loading traffic data: {error?.message}
            </div>
          )}
        </div>
      )}
      
      {/* Map */}
      <MapContainer
        center={currentConfig.center}
        zoom={currentConfig.zoom}
        style={{ height: '100%', width: '100%' }}
        whenReady={() => setMapReady(true)}
        zoomControl={false}
      >
        <ZoomControl position="topright" />
        <MapUpdater metro={selectedMetro} />
        
        <LayersControl position="topright">
          {/* Base layers */}
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          </LayersControl.BaseLayer>
          
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
            />
          </LayersControl.BaseLayer>
          
          <LayersControl.BaseLayer name="Dark">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        
        {/* Render events */}
        {mapReady && filteredEvents.map(event => (
          <GeometryRenderer
            key={event.id}
            event={event}
            onClick={onEventClick}
          />
        ))}
      </MapContainer>
    </div>
  );
};
