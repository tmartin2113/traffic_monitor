/**
 * UnifiedSearch Component
 * Production-ready unified search for places (Nominatim) and traffic events (511 API)
 * @author 511 Traffic Monitor
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, MapPin, AlertCircle, Construction, X, Loader2 } from 'lucide-react';
import axios, { AxiosError } from 'axios';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { Map as LeafletMap, LatLngBoundsExpression } from 'leaflet';
import { useMap } from 'react-leaflet';
import clsx from 'clsx';
import { useDebounce } from '@hooks/useDebounce';
import { logger } from '@utils/logger';

/* ========================
   Type Definitions
======================== */

interface NominatimPlace {
  place_id: string;
  licence?: string;
  osm_type?: string;
  osm_id?: string;
  boundingbox: [string, string, string, string];
  lat: string;
  lon: string;
  display_name: string;
  class?: string;
  type?: string;
  importance?: number;
  icon?: string;
  address?: {
    road?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

interface Open511Road {
  name: string;
  from?: string;
  to?: string;
  direction?: string;
  state?: string;
  impacted_systems?: Array<{
    system_id: string;
  }>;
}

interface Open511Schedule {
  start_date?: string;
  end_date?: string;
  days_of_week?: string[];
}

interface Open511Geography {
  type: 'Point' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon';
  coordinates: number[] | number[][] | number[][][];
}

interface Open511Event {
  id: string;
  url?: string;
  headline: string;
  event_type: 'CONSTRUCTION' | 'INCIDENT' | 'SPECIAL_EVENT' | 'ROAD_CONDITION' | 'WEATHER_CONDITION';
  severity?: 'MINOR' | 'MODERATE' | 'MAJOR' | 'UNKNOWN';
  status?: 'ACTIVE' | 'ARCHIVED';
  created?: string;
  updated?: string;
  geography?: Open511Geography;
  closure_geography?: Open511Geography;
  roads?: Open511Road[];
  schedules?: Open511Schedule[];
  description?: string;
  event_subtypes?: string[];
  restrictions?: Array<{
    restriction_type: string;
    lanes_status?: Array<{
      status: string;
      lane: string;
    }>;
  }>;
}

export interface UnifiedSearchProps {
  open511BaseUrl?: string;
  open511ApiKey?: string;
  bbox?: { xmin: number; ymin: number; xmax: number; ymax: number } | null;
  map?: LeafletMap | null;
  onSelectEvent?: (event: Open511Event) => void;
  onSelectPlace?: (place: NominatimPlace) => void;
  placeholder?: string;
  debounceMs?: number;
  maxSuggestions?: number;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/* ========================
   Utility Functions
======================== */

const toLatLngPairsFromGeoJSON = (geometry: Open511Geography | undefined): [number, number][] | null => {
  if (!geometry) return null;
  
  try {
    const { type, coordinates } = geometry;
    if (!type || !coordinates) return null;

    switch (type) {
      case 'Point':
        return [[coordinates[1] as number, coordinates[0] as number]];
      case 'LineString':
        return (coordinates as number[][]).map(c => [c[1], c[0]]);
      case 'MultiLineString':
        return (coordinates as number[][][]).flat().map(c => [c[1], c[0]]);
      case 'Polygon':
        return (coordinates as number[][][])[0].map(c => [c[1], c[0]]);
      case 'MultiPolygon':
        return (coordinates as number[][][][])[0][0].map(c => [c[1], c[0]]);
      default:
        return null;
    }
  } catch (error) {
    logger.error('Failed to parse GeoJSON coordinates', error);
    return null;
  }
};

const coordsToBounds = (coords: [number, number][]): LatLngBoundsExpression | null => {
  if (!coords || coords.length === 0) return null;
  
  const lats = coords.map(c => c[0]);
  const lons = coords.map(c => c[1]);
  
  return [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)]
  ];
};

const getEventTypeIcon = (type: string): JSX.Element => {
  switch (type) {
    case 'INCIDENT':
      return <AlertCircle className="w-3 h-3 text-red-500" />;
    case 'CONSTRUCTION':
      return <Construction className="w-3 h-3 text-orange-500" />;
    default:
      return <AlertCircle className="w-3 h-3 text-gray-500" />;
  }
};

/* ========================
   Main Component
======================== */

const UnifiedSearch: React.FC<UnifiedSearchProps> = ({
  open511BaseUrl = import.meta.env.VITE_511_API_URL || 'https://api.511.org',
  open511ApiKey = import.meta.env.VITE_511_API_KEY,
  bbox = null,
  map: mapProp = null,
  onSelectEvent,
  onSelectPlace,
  placeholder = 'Search places, roads, or traffic events...',
  debounceMs = 300,
  maxSuggestions = 8,
  className,
  disabled = false,
  autoFocus = false,
}) => {
  // Get map from React-Leaflet context if not provided
  const mapFromContext = (() => {
    try {
      return useMap();
    } catch {
      return null;
    }
  })();
  
  const map = mapProp ?? mapFromContext;

  // State management
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Debounced query for API calls
  const debouncedQuery = useDebounce(query, debounceMs);

  /* ========================
     Places API (Nominatim)
  ======================== */
  
  const fetchPlaces = useCallback(async (searchQuery: string): Promise<NominatimPlace[]> => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        format: 'json',
        addressdetails: '1',
        limit: String(Math.floor(maxSuggestions / 2)), // Split between places and events
        polygon_geojson: '0',
        dedupe: '1',
      });
      
      // Add bounding box if available to prioritize local results
      if (bbox) {
        params.append('viewbox', `${bbox.xmin},${bbox.ymax},${bbox.xmax},${bbox.ymin}`);
        params.append('bounded', '0'); // Soft boundary
      }
      
      const response = await axios.get<NominatimPlace[]>(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            'User-Agent': '511-traffic-monitor/1.0',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );
      
      return response.data ?? [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          logger.warn('Nominatim search timeout');
        } else {
          logger.error('Nominatim search error', error);
        }
      }
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }, [maxSuggestions, bbox]);

  const placesQuery = useQuery<NominatimPlace[], Error>({
    queryKey: ['places', debouncedQuery, bbox],
    queryFn: () => fetchPlaces(debouncedQuery),
    enabled: Boolean(debouncedQuery && debouncedQuery.length >= 2),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 1,
  });

  /* ========================
     Events API (511 Open Data)
  ======================== */
  
  const fetchEvents = useCallback(async (): Promise<Open511Event[]> => {
    if (!open511ApiKey) {
      logger.warn('511 API key not configured');
      return [];
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const params: Record<string, string> = {
        format: 'json',
        status: 'ACTIVE',
        api_key: open511ApiKey,
      };
      
      if (bbox) {
        params.bbox = `${bbox.xmin},${bbox.ymin},${bbox.xmax},${bbox.ymax}`;
      }
      
      const url = new URL('/traffic/events', open511BaseUrl);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
      
      const response = await axios.get<{ events: Open511Event[] }>(url.toString(), {
        signal: controller.signal,
      });
      
      return response.data?.events ?? [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          logger.error('511 API authentication failed - check API key');
        } else if (error.code === 'ECONNABORTED') {
          logger.warn('511 API request timeout');
        } else {
          logger.error('511 API error', error);
        }
      }
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }, [open511BaseUrl, open511ApiKey, bbox]);

  const eventsQuery = useQuery<Open511Event[], Error>({
    queryKey: ['open511-events', bbox],
    queryFn: fetchEvents,
    staleTime: 1000 * 30, // 30 seconds - traffic events change frequently
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60, // Refetch every minute
    retry: 2,
  });

  /* ========================
     Filter & Sort Results
  ======================== */
  
  const eventSuggestions = useMemo(() => {
    const searchTerm = debouncedQuery?.trim().toLowerCase();
    if (!searchTerm || !eventsQuery.data) return [];
    
    // Score and filter events
    const scoredEvents = eventsQuery.data
      .map(event => {
        let score = 0;
        const headline = event.headline?.toLowerCase() ?? '';
        const roadNames = (event.roads ?? [])
          .map(r => r.name?.toLowerCase())
          .filter(Boolean)
          .join(' ');
        const eventType = event.event_type?.toLowerCase() ?? '';
        
        // Exact matches get highest score
        if (headline === searchTerm) score += 100;
        else if (headline.includes(searchTerm)) score += 50;
        
        // Road name matches
        if (roadNames.includes(searchTerm)) score += 40;
        
        // Event type matches
        if (eventType.includes(searchTerm)) score += 20;
        
        // Severity boost
        if (event.severity === 'MAJOR') score += 15;
        else if (event.severity === 'MODERATE') score += 10;
        
        return { event, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.ceil(maxSuggestions / 2))
      .map(({ event }) => event);
    
    return scoredEvents;
  }, [debouncedQuery, eventsQuery.data, maxSuggestions]);

  /* ========================
     Selection Handlers
  ======================== */
  
  const selectPlace = useCallback((place: NominatimPlace) => {
    setOpen(false);
    setActiveIndex(null);
    setQuery(place.display_name.split(',')[0]); // Show first part of address
    
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    
    if (!isNaN(lat) && !isNaN(lon) && map) {
      try {
        // Parse bounding box for better zoom level
        if (place.boundingbox) {
          const [south, north, west, east] = place.boundingbox.map(parseFloat);
          if (!isNaN(south) && !isNaN(north) && !isNaN(west) && !isNaN(east)) {
            map.fitBounds([[south, west], [north, east]], { 
              padding: [50, 50],
              maxZoom: 16,
            });
          } else {
            map.flyTo([lat, lon], 15, { animate: true, duration: 1 });
          }
        } else {
          map.flyTo([lat, lon], 15, { animate: true, duration: 1 });
        }
      } catch (error) {
        logger.error('Failed to pan map to place', error);
      }
    }
    
    onSelectPlace?.(place);
    inputRef.current?.blur();
  }, [map, onSelectPlace]);

  const selectEvent = useCallback((event: Open511Event) => {
    setOpen(false);
    setActiveIndex(null);
    setQuery(event.headline);
    
    // Calculate bounds from event geometry
    const geometry = event.closure_geography ?? event.geography;
    const coords = toLatLngPairsFromGeoJSON(geometry);
    
    if (coords && coords.length > 0 && map) {
      const bounds = coordsToBounds(coords);
      if (bounds) {
        try {
          map.fitBounds(bounds, { 
            padding: [80, 80],
            maxZoom: 15,
          });
        } catch (error) {
          logger.error('Failed to pan map to event', error);
        }
      } else if (coords[0]) {
        map.flyTo(coords[0], 14, { animate: true, duration: 1 });
      }
    }
    
    onSelectEvent?.(event);
    inputRef.current?.blur();
  }, [map, onSelectEvent]);

  /* ========================
     Keyboard Navigation
  ======================== */
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const places = placesQuery.data ?? [];
    const events = eventSuggestions;
    const totalCount = places.length + events.length;
    
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter') && totalCount > 0) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(0);
      return;
    }
    
    if (!open) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => 
          prev === null ? 0 : Math.min(totalCount - 1, prev + 1)
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => 
          prev === null ? totalCount - 1 : Math.max(0, prev - 1)
        );
        break;
        
      case 'Enter':
        e.preventDefault();
        if (activeIndex === null) break;
        
        if (activeIndex < places.length) {
          selectPlace(places[activeIndex]);
        } else {
          const eventIndex = activeIndex - places.length;
          if (events[eventIndex]) {
            selectEvent(events[eventIndex]);
          }
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setActiveIndex(null);
        inputRef.current?.blur();
        break;
        
      case 'Tab':
        setOpen(false);
        setActiveIndex(null);
        break;
    }
  }, [open, placesQuery.data, eventSuggestions, selectPlace, selectEvent]);

  /* ========================
     Effects
  ======================== */
  
  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-open dropdown when results available
  useEffect(() => {
    const hasResults = (placesQuery.data?.length ?? 0) + eventSuggestions.length > 0;
    
    if (debouncedQuery && hasResults && document.activeElement === inputRef.current) {
      setOpen(true);
    } else if (!debouncedQuery) {
      setOpen(false);
      setActiveIndex(null);
    }
  }, [debouncedQuery, placesQuery.data, eventSuggestions]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex === null || !listRef.current) return;
    
    const items = listRef.current.querySelectorAll('[role="option"]');
    const activeItem = items[activeIndex] as HTMLElement | undefined;
    
    if (activeItem) {
      activeItem.scrollIntoView({ 
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [activeIndex]);

  /* ========================
     Render Functions
  ======================== */
  
  const renderPlaceItem = (place: NominatimPlace, index: number) => {
    const isActive = activeIndex === index;
    const addressParts = place.display_name.split(',');
    const primaryName = addressParts[0];
    const secondaryName = addressParts.slice(1, 3).join(',');
    
    return (
      <div
        key={`place-${place.place_id}`}
        role="option"
        aria-selected={isActive}
        className={clsx(
          'px-4 py-3 cursor-pointer transition-colors',
          'hover:bg-gray-50',
          isActive && 'bg-blue-50'
        )}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => selectPlace(place)}
      >
        <div className="flex items-start gap-3">
          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">
              {primaryName}
            </div>
            <div className="text-sm text-gray-500 truncate">
              {secondaryName}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEventItem = (event: Open511Event, index: number) => {
    const placeCount = placesQuery.data?.length ?? 0;
    const isActive = activeIndex === (placeCount + index);
    const roadNames = (event.roads ?? [])
      .map(r => r.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(', ');
    
    return (
      <div
        key={`event-${event.id}`}
        role="option"
        aria-selected={isActive}
        className={clsx(
          'px-4 py-3 cursor-pointer transition-colors',
          'hover:bg-gray-50',
          isActive && 'bg-blue-50'
        )}
        onMouseEnter={() => setActiveIndex(placeCount + index)}
        onClick={() => selectEvent(event)}
      >
        <div className="flex items-start gap-3">
          {getEventTypeIcon(event.event_type)}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">
              {event.headline}
            </div>
            <div className="text-sm text-gray-500 truncate">
              {roadNames || event.event_type.replace(/_/g, ' ')}
              {event.severity && event.severity !== 'UNKNOWN' && (
                <span className="ml-2 text-xs">
                  • {event.severity}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const places = placesQuery.data ?? [];
  const events = eventSuggestions;
  const isLoading = placesQuery.isLoading || eventsQuery.isLoading;
  const hasResults = places.length > 0 || events.length > 0;

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          className={clsx(
            'w-full pl-10 pr-10 py-3 text-sm',
            'bg-white border border-gray-300 rounded-lg shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'placeholder-gray-400',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (hasResults) setOpen(true);
          }}
          onBlur={() => {
            // Delay to allow click events to fire
            blurTimeoutRef.current = setTimeout(() => {
              setOpen(false);
              setActiveIndex(null);
            }, 200);
          }}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          aria-label="Search for places or traffic events"
          aria-autocomplete="list"
          aria-controls="search-listbox"
          aria-expanded={open}
        />
        
        {/* Clear Button */}
        {query && (
          <button
            type="button"
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            onClick={() => {
              setQuery('');
              setOpen(false);
              setActiveIndex(null);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown Results */}
      {open && (
        <div
          ref={listRef}
          id="search-listbox"
          role="listbox"
          className={clsx(
            'absolute z-50 w-full mt-2',
            'bg-white border border-gray-200 rounded-lg shadow-lg',
            'max-h-96 overflow-y-auto'
          )}
        >
          {/* Places Section */}
          {places.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b">
                Places
              </div>
              {places.map((place, index) => renderPlaceItem(place, index))}
            </>
          )}
          
          {/* Events Section */}
          {events.length > 0 && (
            <>
              {places.length > 0 && <div className="border-t" />}
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b">
                Traffic Events
              </div>
              {events.map((event, index) => renderEventItem(event, index))}
            </>
          )}
          
          {/* No Results */}
          {!isLoading && !hasResults && debouncedQuery && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              No results found for "{debouncedQuery}"
            </div>
          )}
          
          {/* Loading State */}
          {isLoading && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
              Searching...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UnifiedSearch;
