/**
 * Map Type Definitions
 * Types for map-related functionality
 */

import type { Map as LeafletMap, Marker, Polyline, LayerGroup, LatLngBounds } from 'leaflet';
import type { TrafficEvent } from './api.types';

// Map center coordinates
export interface MapCenter {
  lat: number;
  lng: number;
}

// Map bounds
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Map viewport
export interface MapViewport {
  center: MapCenter;
  zoom: number;
  bounds: MapBounds;
}

// Map reference interface
export interface MapRef {
  map: LeafletMap | null;
  markers: Map<string, Marker>;
  polylines: Map<string, Polyline>;
  layers: Map<string, LayerGroup>;
  
  // Marker methods
  addMarker: (id: string, marker: Marker) => void;
  removeMarker: (id: string) => void;
  clearMarkers: () => void;
  
  // Polyline methods
  addPolyline: (id: string, polyline: Polyline) => void;
  removePolyline: (id: string) => void;
  clearPolylines: () => void;
  
  // Map control methods
  setView: (center: MapCenter, zoom?: number) => void;
  fitBounds: (bounds: MapBounds) => void;
  flyTo: (center: MapCenter, zoom?: number) => void;
  getCenter: () => MapCenter | null;
  getZoom: () => number | null;
  getBounds: () => MapBounds | null;
}

// Marker options
export interface MarkerOptions {
  event: TrafficEvent;
  isSelected?: boolean;
  onClick?: () => void;
  onHover?: () => void;
}

// Polyline options
export interface PolylineOptions {
  coordinates: number[][];
  event: TrafficEvent;
  onClick?: () => void;
}

// Cluster options
export interface ClusterOptions {
  maxClusterRadius?: number;
  showCoverageOnHover?: boolean;
  zoomToBoundsOnClick?: boolean;
  spiderfyOnMaxZoom?: boolean;
  removeOutsideVisibleBounds?: boolean;
  animate?: boolean;
  animateAddingMarkers?: boolean;
  disableClusteringAtZoom?: number;
  maxZoom?: number;
}

// Map control options
export interface MapControlOptions {
  position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  zoomControl?: boolean;
  zoomControlPosition?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  attributionControl?: boolean;
  scaleControl?: boolean;
}

// Map interaction state
export interface MapInteractionState {
  isDrawing: boolean;
  isMoving: boolean;
  isZooming: boolean;
  mousePosition: MapCenter | null;
  selectedMarker: string | null;
  hoveredMarker: string | null;
}

// Map layer configuration
export interface MapLayer {
  id: string;
  name: string;
  type: 'base' | 'overlay';
  visible: boolean;
  opacity: number;
  zIndex: number;
  url?: string;
  attribution?: string;
}

// Heat map configuration
export interface HeatmapConfig {
  radius?: number;
  blur?: number;
  maxZoom?: number;
  max?: number;
  gradient?: Record<number, string>;
  minOpacity?: number;
}

// Map style configuration
export interface MapStyle {
  tileLayer: {
    url: string;
    attribution: string;
    maxZoom?: number;
    minZoom?: number;
    opacity?: number;
  };
  marker: {
    size: number;
    selectedSize: number;
    closureSize: number;
  };
  polyline: {
    weight: number;
    opacity: number;
    dashArray?: string;
  };
  cluster: {
    size: number;
    colors: {
      small: string;
      medium: string;
      large: string;
    };
  };
}

// Geolocation position
export interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp: number;
}

// Map event handlers
export interface MapEventHandlers {
  onClick?: (e: L.LeafletMouseEvent) => void;
  onDoubleClick?: (e: L.LeafletMouseEvent) => void;
  onMouseDown?: (e: L.LeafletMouseEvent) => void;
  onMouseUp?: (e: L.LeafletMouseEvent) => void;
  onMouseOver?: (e: L.LeafletMouseEvent) => void;
  onMouseOut?: (e: L.LeafletMouseEvent) => void;
  onMouseMove?: (e: L.LeafletMouseEvent) => void;
  onContextMenu?: (e: L.LeafletMouseEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onPreClick?: () => void;
  onLoad?: () => void;
  onUnload?: () => void;
  onViewReset?: () => void;
  onMove?: () => void;
  onMoveStart?: () => void;
  onMoveEnd?: () => void;
  onDrag?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onZoomStart?: () => void;
  onZoom?: () => void;
  onZoomEnd?: () => void;
  onZoomLevelsChange?: () => void;
  onResize?: () => void;
  onAutoPanStart?: () => void;
  onLayerAdd?: () => void;
  onLayerRemove?: () => void;
  onBaseLayerChange?: () => void;
  onOverlayAdd?: () => void;
  onOverlayRemove?: () => void;
  onLocationFound?: (e: L.LocationEvent) => void;
  onLocationError?: (e: L.ErrorEvent) => void;
  onPopupOpen?: () => void;
  onPopupClose?: () => void;
  onTooltipOpen?: () => void;
  onTooltipClose?: () => void;
}

// Map drawing tools
export interface MapDrawingTools {
  polyline?: boolean;
  polygon?: boolean;
  rectangle?: boolean;
  circle?: boolean;
  marker?: boolean;
  circlemarker?: boolean;
}

// Map measurement tools
export interface MapMeasurementTools {
  distance?: boolean;
  area?: boolean;
}

// Map export options
export interface MapExportOptions {
  format: 'png' | 'jpg' | 'svg' | 'pdf';
  quality?: number;
  width?: number;
  height?: number;
  includeMarkers?: boolean;
  includePolylines?: boolean;
  includeLegend?: boolean;
}

// Map animation options
export interface MapAnimationOptions {
  duration?: number;
  easeLinearity?: number;
  animate?: boolean;
  noMoveStart?: boolean;
}

// Map plugin configuration
export interface MapPlugins {
  markerCluster?: boolean;
  heatmap?: boolean;
  fullscreen?: boolean;
  search?: boolean;
  draw?: boolean;
  measure?: boolean;
  minimap?: boolean;
  print?: boolean;
  locate?: boolean;
  geocoder?: boolean;
  routing?: boolean;
}

// Type guards
export function isMapCenter(obj: any): obj is MapCenter {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.lat === 'number' &&
    typeof obj.lng === 'number'
  );
}

export function isMapBounds(obj: any): obj is MapBounds {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.north === 'number' &&
    typeof obj.south === 'number' &&
    typeof obj.east === 'number' &&
    typeof obj.west === 'number'
  );
}

export function isWithinBounds(point: MapCenter, bounds: MapBounds): boolean {
  return (
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east
  );
}
