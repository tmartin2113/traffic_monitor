/**
 * Map Type Definitions
 * Types for map-related functionality
 */

import type { Map as LeafletMap, Marker, Polyline, LayerGroup } from 'leaflet';
import type { TrafficEvent } from './api.types';

export interface MapCenter {
  lat: number;
  lng: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapViewport {
  center: MapCenter;
  zoom: number;
  bounds?: MapBounds;
}

export interface MarkerOptions {
  event: TrafficEvent;
  isSelected?: boolean;
  isClustered?: boolean;
  onClick?: (event: TrafficEvent) => void;
  onHover?: (event: TrafficEvent) => void;
}

export interface PolylineOptions {
  coordinates: number[][];
  color?: string;
  weight?: number;
  opacity?: number;
  dashArray?: string;
  className?: string;
}

export interface MapLayer {
  id: string;
  name: string;
  type: 'markers' | 'polylines' | 'heatmap' | 'geofence';
  visible: boolean;
  data?: any;
  options?: any;
}

export interface MapControlsState {
  showTraffic: boolean;
  showClosures: boolean;
  showIncidents: boolean;
  showConstruction: boolean;
  showGeofence: boolean;
  clusterMarkers: boolean;
  autoRefresh: boolean;
  followLocation: boolean;
}

export interface MapInteractionEvent {
  type: 'click' | 'hover' | 'drag' | 'zoom';
  target?: 'marker' | 'polyline' | 'map';
  data?: any;
  latlng?: MapCenter;
  zoom?: number;
}

export interface MapStyle {
  tileLayer: string;
  attribution: string;
  maxZoom: number;
  minZoom: number;
  theme?: 'light' | 'dark' | 'satellite';
}

export interface HeatmapOptions {
  radius?: number;
  blur?: number;
  maxZoom?: number;
  max?: number;
  gradient?: Record<number, string>;
}

export interface ClusterOptions {
  maxClusterRadius: number;
  spiderfyOnMaxZoom: boolean;
  showCoverageOnHover: boolean;
  zoomToBoundsOnClick: boolean;
  singleMarkerMode?: boolean;
  disableClusteringAtZoom?: number;
  chunkedLoading?: boolean;
}

export interface MapRef {
  map: LeafletMap | null;
  markers: Map<string, Marker>;
  polylines: Map<string, Polyline>;
  layers: Map<string, LayerGroup>;
  
  // Methods
  addMarker: (id: string, marker: Marker) => void;
  removeMarker: (id: string) => void;
  clearMarkers: () => void;
  
  addPolyline: (id: string, polyline: Polyline) => void;
  removePolyline: (id: string) => void;
  clearPolylines: () => void;
  
  setView: (center: MapCenter, zoom?: number) => void;
  fitBounds: (bounds: MapBounds) => void;
  flyTo: (center: MapCenter, zoom?: number) => void;
  
  getCenter: () => MapCenter | null;
  getZoom: () => number | null;
  getBounds: () => MapBounds | null;
  
  invalidateSize: () => void;
  locate: () => void;
}

export interface LocationState {
  enabled: boolean;
  position: MapCenter | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number | null;
  error: string | null;
}

export interface DrawingState {
  enabled: boolean;
  mode: 'polygon' | 'circle' | 'rectangle' | null;
  coordinates: number[][];
  area?: number;
  radius?: number;
}

export interface MapMeasurement {
  type: 'distance' | 'area';
  value: number;
  unit: 'meters' | 'kilometers' | 'feet' | 'miles';
  points: MapCenter[];
}

export const DEFAULT_MAP_STYLES: Record<string, MapStyle> = {
  openstreetmap: {
    tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    minZoom: 3,
    theme: 'light',
  },
  cartoDark: {
    tileLayer: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© CARTO',
    maxZoom: 19,
    minZoom: 3,
    theme: 'dark',
  },
  cartoLight: {
    tileLayer: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© CARTO',
    maxZoom: 19,
    minZoom: 3,
    theme: 'light',
  },
  satellite: {
    tileLayer: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    maxZoom: 18,
    minZoom: 3,
    theme: 'satellite',
  },
};
