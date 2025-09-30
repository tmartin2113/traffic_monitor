/**
 * @file components/EventDetailsPanel.tsx
 * @description Event details display component
 * @version 1.0.0
 */

import React from 'react';
import { TrafficEvent, EventSeverity } from '../types/TrafficEvent';

interface EventDetailsPanelProps {
  event: TrafficEvent | null;
  onClose?: () => void;
}

export const EventDetailsPanel: React.FC<EventDetailsPanelProps> = ({ event, onClose }) => {
  if (!event) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500">
            Select a traffic event on the map to view details
          </p>
        </div>
      </div>
    );
  }
  
  const getSeverityColor = (severity?: EventSeverity) => {
    switch (severity) {
      case EventSeverity.CRITICAL: return 'bg-red-100 text-red-800 border-red-300';
      case EventSeverity.MAJOR: return 'bg-orange-100 text-orange-800 border-orange-300';
      case EventSeverity.MODERATE: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case EventSeverity.MINOR: return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-bold flex-1 pr-2">{event.headline}</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getSeverityColor(event.severity)}`}>
            {event.severity || 'Unknown Severity'}
          </span>
          <span className="text-xs text-blue-100">
            {event.source}
          </span>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {event.description && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-1">Description</h4>
            <p className="text-sm text-gray-600">{event.description}</p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-semibold text-gray-700">Type:</span>
            <p className="text-gray-600">{event.eventType.replace(/_/g, ' ')}</p>
          </div>
          
          {event.direction && (
            <div>
              <span className="font-semibold text-gray-700">Direction:</span>
              <p className="text-gray-600">{event.direction}</p>
            </div>
          )}
          
          {event.roads && event.roads.length > 0 && (
            <div className="col-span-2">
              <span className="font-semibold text-gray-700">Affected Roads:</span>
              <ul className="mt-1 text-gray-600">
                {event.roads.map((road, idx) => (
                  <li key={idx} className="ml-4 list-disc">{road}</li>
                ))}
              </ul>
            </div>
          )}
          
          {event.startTime && (
            <div className="col-span-2">
              <span className="font-semibold text-gray-700">Started:</span>
              <p className="text-gray-600">{formatDate(event.startTime)}</p>
            </div>
          )}
          
          {event.endTime && (
            <div className="col-span-2">
              <span className="font-semibold text-gray-700">Expected End:</span>
              <p className="text-gray-600">{formatDate(event.endTime)}</p>
            </div>
          )}
          
          {event.lanesAffected !== undefined && (
            <div>
              <span className="font-semibold text-gray-700">Lanes Affected:</span>
              <p className="text-gray-600">{event.lanesAffected}</p>
            </div>
          )}
        </div>
        
        <div className="pt-3 border-t text-xs text-gray-500">
          <div>Event ID: {event.id}</div>
          {event.updated && (
            <div>Last Updated: {formatDate(event.updated)}</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// FiltersPanel Component
// ============================================

/**
 * @file components/FiltersPanel.tsx
 * @description Filters panel for traffic events
 * @version 1.0.0
 */

interface FiltersPanelProps {
  filters: {
    eventTypes: string[];
    severities: string[];
    searchQuery: string;
  };
  onFiltersChange: (filters: any) => void;
}

export const FiltersPanel: React.FC<FiltersPanelProps> = ({ filters, onFiltersChange }) => {
  const handleEventTypeToggle = (type: string) => {
    const newTypes = filters.eventTypes.includes(type)
      ? filters.eventTypes.filter(t => t !== type)
      : [...filters.eventTypes, type];
    
    onFiltersChange({
      ...filters,
      eventTypes: newTypes
    });
  };
  
  const handleSeverityToggle = (severity: string) => {
    const newSeverities = filters.severities.includes(severity)
      ? filters.severities.filter(s => s !== severity)
      : [...filters.severities, severity];
    
    onFiltersChange({
      ...filters,
      severities: newSeverities
    });
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      searchQuery: e.target.value
    });
  };
  
  const clearFilters = () => {
    onFiltersChange({
      eventTypes: [],
      severities: [],
      searchQuery: ''
    });
  };
  
  const activeFilterCount = filters.eventTypes.length + filters.severities.length + (filters.searchQuery ? 1 : 0);
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">Filters</h3>
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              {activeFilterCount} active
            </span>
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
      
      {/* Search */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Search
        </label>
        <input
          type="text"
          value={filters.searchQuery}
          onChange={handleSearchChange}
          placeholder="Search events..."
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      {/* Event Types */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Event Types
        </label>
        <div className="space-y-1">
          {Object.values(EventType).map(type => (
            <label key={type} className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded">
              <input
                type="checkbox"
                checked={filters.eventTypes.includes(type)}
                onChange={() => handleEventTypeToggle(type)}
                className="mr-2"
              />
              <span className="text-sm">{type.replace(/_/g, ' ')}</span>
            </label>
          ))}
        </div>
      </div>
      
      {/* Severity Levels */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Severity Levels
        </label>
        <div className="space-y-1">
          {Object.values(EventSeverity).map(severity => (
            <label key={severity} className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded">
              <input
                type="checkbox"
                checked={filters.severities.includes(severity)}
                onChange={() => handleSeverityToggle(severity)}
                className="mr-2"
              />
              <span className="text-sm capitalize">{severity}</span>
            </label>
          ))}
        </div>
      </div>
      
      {/* Quick Filters */}
      <div className="border-t pt-4">
        <p className="text-xs font-medium text-gray-700 mb-2">Quick Filters</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onFiltersChange({
              eventTypes: [],
              severities: [EventSeverity.CRITICAL, EventSeverity.MAJOR],
              searchQuery: ''
            })}
            className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium hover:bg-red-200"
          >
            High Impact
          </button>
          <button
            onClick={() => onFiltersChange({
              eventTypes: [EventType.ROAD_CLOSURE],
              severities: [],
              searchQuery: ''
            })}
            className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium hover:bg-orange-200"
          >
            Road Closures
          </button>
          <button
            onClick={() => onFiltersChange({
              eventTypes: [EventType.ACCIDENT],
              severities: [],
              searchQuery: ''
            })}
            className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium hover:bg-yellow-200"
          >
            Accidents Only
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// useLocalStorage Hook
// ============================================

/**
 * @file hooks/useLocalStorage.ts
 * @description Local storage hook for persistent state
 * @version 1.0.0
 */

import { useState, useEffect } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Get from local storage then parse stored json or return initialValue
  const readValue = (): T => {
    // Prevent build error "window is undefined" but keep working
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
    // Prevent build error "window is undefined" but keeps working
    if (typeof window === 'undefined') {
      console.warn(`Tried setting localStorage key "${key}" even though environment is not a browser`);
    }

    try {
      // Allow value to be a function so we have the same API as useState
      const newValue = value instanceof Function ? value(storedValue) : value;

      // Save to local storage
      window.localStorage.setItem(key, JSON.stringify(newValue));

      // Save state
      setStoredValue(newValue);

      // We dispatch a custom event so every useLocalStorage hook are notified
      window.dispatchEvent(new Event('local-storage'));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  useEffect(() => {
    setStoredValue(readValue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      setStoredValue(readValue());
    };

    // This only works for other documents, not the current one
    window.addEventListener('storage', handleStorageChange);

    // This is a custom event, triggered in setValue
    window.addEventListener('local-storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage', handleStorageChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [storedValue, setValue];
}

// Import these in the component files
import { EventType } from '../types/TrafficEvent';
