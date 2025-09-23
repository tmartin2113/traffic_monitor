/**
 * EventFilters Component
 * Advanced filtering options for traffic events
 */

import React, { useMemo, useCallback } from 'react';
import { X, Filter, RotateCcw } from 'lucide-react';
import { TrafficEvent, EventType, EventSeverity } from '@types/api.types';
import { EVENT_TYPE_CONFIG, SEVERITY_CONFIG } from '@utils/constants';
import { Badge } from '@components/shared';
import clsx from 'clsx';

interface EventFiltersProps {
  events: TrafficEvent[];
  filters: {
    types: string[];
    severities: string[];
    areas: string[];
  };
  onFiltersChange: (filters: any) => void;
  onClose?: () => void;
}

const EventFilters: React.FC<EventFiltersProps> = ({
  events,
  filters,
  onFiltersChange,
  onClose,
}) => {
  // Extract unique areas from events
  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    events.forEach(event => {
      event.areas?.forEach(area => areas.add(area.name));
    });
    return Array.from(areas).sort();
  }, [events]);

  // Count events by type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(event => {
      counts[event.event_type] = (counts[event.event_type] || 0) + 1;
    });
    return counts;
  }, [events]);

  // Count events by severity
  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(event => {
      counts[event.severity] = (counts[event.severity] || 0) + 1;
    });
    return counts;
  }, [events]);

  // Count events by area
  const areaCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(event => {
      event.areas?.forEach(area => {
        counts[area.name] = (counts[area.name] || 0) + 1;
      });
    });
    return counts;
  }, [events]);

  const toggleType = useCallback((type: string) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type];
    onFiltersChange({ ...filters, types: newTypes });
  }, [filters, onFiltersChange]);

  const toggleSeverity = useCallback((severity: string) => {
    const newSeverities = filters.severities.includes(severity)
      ? filters.severities.filter(s => s !== severity)
      : [...filters.severities, severity];
    onFiltersChange({ ...filters, severities: newSeverities });
  }, [filters, onFiltersChange]);

  const toggleArea = useCallback((area: string) => {
    const newAreas = filters.areas.includes(area)
      ? filters.areas.filter(a => a !== area)
      : [...filters.areas, area];
    onFiltersChange({ ...filters, areas: newAreas });
  }, [filters, onFiltersChange]);

  const clearFilters = useCallback(() => {
    onFiltersChange({
      types: [],
      severities: [],
      areas: [],
    });
  }, [onFiltersChange]);

  const activeFilterCount = filters.types.length + filters.severities.length + filters.areas.length;

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Filters</h3>
          {activeFilterCount > 0 && (
            <Badge variant="primary" size="sm">
              {activeFilterCount} active
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              aria-label="Clear filters"
            >
              <RotateCcw className="w-4 h-4 text-gray-600" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              aria-label="Close filters"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Event Type Filters */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Event Type</h4>
          <div className="space-y-1">
            {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => {
              const count = typeCounts[key] || 0;
              const isSelected = filters.types.includes(key);
              
              return (
                <label
                  key={key}
                  className={clsx(
                    "flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors",
                    isSelected 
                      ? "bg-blue-50 border border-blue-200" 
                      : "hover:bg-gray-50 border border-transparent"
                  )}
                >
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleType(key)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xl">{config.icon}</span>
                    <span className="text-sm font-medium">{config.label}</span>
                  </div>
                  <span className="text-sm text-gray-500">{count}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Severity Filters */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Severity</h4>
          <div className="space-y-1">
            {Object.entries(SEVERITY_CONFIG).map(([key, config]) => {
              const count = severityCounts[key] || 0;
              const isSelected = filters.severities.includes(key);
              
              return (
                <label
                  key={key}
                  className={clsx(
                    "flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors",
                    isSelected 
                      ? "bg-blue-50 border border-blue-200" 
                      : "hover:bg-gray-50 border border-transparent"
                  )}
                >
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSeverity(key)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="text-sm font-medium">{config.label}</span>
                  </div>
                  <span className="text-sm text-gray-500">{count}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Area Filters */}
        {availableAreas.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Areas</h4>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {availableAreas.map(area => {
                const count = areaCounts[area] || 0;
                const isSelected = filters.areas.includes(area);
                
                return (
                  <label
                    key={area}
                    className={clsx(
                      "flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors",
                      isSelected 
                        ? "bg-blue-50 border border-blue-200" 
                        : "hover:bg-gray-50 border border-transparent"
                    )}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleArea(area)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium">{area}</span>
                    </div>
                    <span className="text-sm text-gray-500">{count}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Filters */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Filters</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                onFiltersChange({
                  types: [],
                  severities: ['SEVERE', 'MAJOR'],
                  areas: filters.areas,
                });
              }}
              className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium hover:bg-red-200 transition-colors"
            >
              High Impact
            </button>
            <button
              onClick={() => {
                onFiltersChange({
                  types: ['INCIDENT'],
                  severities: filters.severities,
                  areas: filters.areas,
                });
              }}
              className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium hover:bg-orange-200 transition-colors"
            >
              Incidents Only
            </button>
            <button
              onClick={() => {
                onFiltersChange({
                  types: ['CONSTRUCTION'],
                  severities: filters.severities,
                  areas: filters.areas,
                });
              }}
              className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium hover:bg-yellow-200 transition-colors"
            >
              Construction Only
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventFilters;
