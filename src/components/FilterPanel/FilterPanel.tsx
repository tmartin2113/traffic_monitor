/**
 * @file components/FilterPanel/FilterPanel.tsx
 * @description Production-ready filter panel component for traffic events
 * @version 1.0.0
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Search,
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Check,
  AlertCircle,
  Construction,
  Calendar,
  Navigation,
  XCircle,
  Minus,
  AlertTriangle,
  Info,
  MapPin,
  Clock,
  Settings
} from 'lucide-react';
import clsx from 'clsx';

// Type imports
import type { EventType, EventSeverity } from '@types/api.types';

// Store imports
import { useFilterStore } from '@stores/filterStore';
import { useEventStore } from '@stores/eventStore';

/**
 * Props interface for FilterPanel component
 */
export interface FilterPanelProps {
  /** Optional CSS class name */
  className?: string;
  /** Whether the panel is collapsible */
  collapsible?: boolean;
  /** Whether the panel starts collapsed */
  defaultCollapsed?: boolean;
  /** Callback when filters change */
  onFilterChange?: () => void;
}

/**
 * Event type configuration with icons and colors
 */
const EVENT_TYPE_CONFIG: Record<EventType, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
}> = {
  INCIDENT: {
    icon: AlertCircle,
    label: 'Incident',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  CONSTRUCTION: {
    icon: Construction,
    label: 'Construction',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  SPECIAL_EVENT: {
    icon: Calendar,
    label: 'Special Event',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  ROAD_CONDITION: {
    icon: Navigation,
    label: 'Road Condition',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  WEATHER_CONDITION: {
    icon: AlertCircle,
    label: 'Weather',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
  },
  ROAD_CLOSURE: {
    icon: XCircle,
    label: 'Road Closure',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  LANE_CLOSURE: {
    icon: Minus,
    label: 'Lane Closure',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
  },
  ACCIDENT: {
    icon: AlertTriangle,
    label: 'Accident',
    color: 'text-red-800',
    bgColor: 'bg-red-100',
  },
  TRAFFIC_CONGESTION: {
    icon: Navigation,
    label: 'Congestion',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
  HAZARD: {
    icon: AlertTriangle,
    label: 'Hazard',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  OTHER: {
    icon: Info,
    label: 'Other',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
  },
};

/**
 * Severity configuration
 */
const SEVERITY_CONFIG: Record<EventSeverity, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}> = {
  CRITICAL: {
    label: 'Critical',
    icon: AlertTriangle,
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  MAJOR: {
    label: 'Major',
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  MODERATE: {
    label: 'Moderate',
    icon: AlertCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  MINOR: {
    label: 'Minor',
    icon: Info,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
  UNKNOWN: {
    label: 'Unknown',
    icon: Info,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
};

/**
 * Quick filter presets
 */
interface QuickFilter {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  apply: (currentFilters: any) => any;
}

const QUICK_FILTERS: QuickFilter[] = [
  {
    id: 'closures',
    label: 'Closures Only',
    icon: XCircle,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    apply: (filters) => ({
      ...filters,
      showClosuresOnly: true,
      eventTypes: ['ROAD_CLOSURE', 'LANE_CLOSURE'],
    }),
  },
  {
    id: 'critical',
    label: 'Critical Events',
    icon: AlertTriangle,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    apply: (filters) => ({
      ...filters,
      severities: ['CRITICAL', 'MAJOR'],
    }),
  },
  {
    id: 'construction',
    label: 'Construction',
    icon: Construction,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    apply: (filters) => ({
      ...filters,
      eventTypes: ['CONSTRUCTION'],
    }),
  },
  {
    id: 'incidents',
    label: 'Incidents',
    icon: AlertCircle,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    apply: (filters) => ({
      ...filters,
      eventTypes: ['INCIDENT', 'ACCIDENT'],
    }),
  },
];

/**
 * FilterPanel Component
 * 
 * Production-ready filter panel with:
 * - Event type filtering
 * - Severity filtering
 * - Search functionality
 * - Quick filter presets
 * - Clear filters option
 * - Collapsible sections
 * - Real-time filter counts
 * - Accessibility features
 */
export const FilterPanel: React.FC<FilterPanelProps> = ({
  className,
  collapsible = true,
  defaultCollapsed = false,
  onFilterChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Store state
  const filters = useFilterStore((state) => state.filters);
  const setFilters = useFilterStore((state) => state.setFilters);
  const resetFilters = useFilterStore((state) => state.resetFilters);
  const activeFilterCount = useFilterStore((state) => state.getActiveFilterCount());

  // Get event counts by type
  const events = useEventStore((state) => Array.from(state.events.values()));
  const eventCountsByType = useMemo(() => {
    const counts: Partial<Record<EventType, number>> = {};
    events.forEach((event) => {
      counts[event.event_type] = (counts[event.event_type] || 0) + 1;
    });
    return counts;
  }, [events]);

  const eventCountsBySeverity = useMemo(() => {
    const counts: Partial<Record<EventSeverity, number>> = {};
    events.forEach((event) => {
      if (event.severity) {
        counts[event.severity] = (counts[event.severity] || 0) + 1;
      }
    });
    return counts;
  }, [events]);

  // Handlers
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, searchTerm: e.target.value });
    onFilterChange?.();
  }, [filters, setFilters, onFilterChange]);

  const handleClearSearch = useCallback(() => {
    setFilters({ ...filters, searchTerm: '' });
    onFilterChange?.();
  }, [filters, setFilters, onFilterChange]);

  const handleEventTypeToggle = useCallback((eventType: EventType) => {
    const currentTypes = filters.eventTypes || [];
    const newTypes = currentTypes.includes(eventType)
      ? currentTypes.filter((t) => t !== eventType)
      : [...currentTypes, eventType];
    
    setFilters({ 
      ...filters, 
      eventTypes: newTypes.length === 0 ? undefined : newTypes 
    });
    onFilterChange?.();
  }, [filters, setFilters, onFilterChange]);

  const handleSeverityToggle = useCallback((severity: EventSeverity) => {
    const currentSeverities = filters.severities || [];
    const newSeverities = currentSeverities.includes(severity)
      ? currentSeverities.filter((s) => s !== severity)
      : [...currentSeverities, severity];
    
    setFilters({ 
      ...filters, 
      severities: newSeverities.length === 0 ? undefined : newSeverities 
    });
    onFilterChange?.();
  }, [filters, setFilters, onFilterChange]);

  const handleQuickFilter = useCallback((quickFilter: QuickFilter) => {
    const newFilters = quickFilter.apply(filters);
    setFilters(newFilters);
    onFilterChange?.();
  }, [filters, setFilters, onFilterChange]);

  const handleToggleClosuresOnly = useCallback(() => {
    setFilters({ ...filters, showClosuresOnly: !filters.showClosuresOnly });
    onFilterChange?.();
  }, [filters, setFilters, onFilterChange]);

  const handleToggleActiveOnly = useCallback(() => {
    setFilters({ ...filters, showActiveOnly: !filters.showActiveOnly });
    onFilterChange?.();
  }, [filters, setFilters, onFilterChange]);

  const handleResetFilters = useCallback(() => {
    resetFilters();
    onFilterChange?.();
  }, [resetFilters, onFilterChange]);

  const handleToggleExpanded = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  return (
    <div className={clsx('bg-white border-b border-gray-200', className)}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-blue-600 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1"
              title="Clear all filters"
            >
              <RotateCcw className="w-4 h-4" />
              Clear
            </button>
          )}
          {collapsible && (
            <button
              onClick={handleToggleExpanded}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              aria-label={isExpanded ? 'Collapse filters' : 'Expand filters'}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Search */}
          <div>
            <label htmlFor="event-search" className="sr-only">
              Search events
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="event-search"
                type="text"
                value={filters.searchTerm || ''}
                onChange={handleSearchChange}
                placeholder="Search events, roads, locations..."
                className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {filters.searchTerm && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Filters */}
          <div>
            <label className="text-xs font-medium text-gray-700 uppercase tracking-wider mb-2 block">
              Quick Filters
            </label>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_FILTERS.map((quickFilter) => {
                const Icon = quickFilter.icon;
                return (
                  <button
                    key={quickFilter.id}
                    onClick={() => handleQuickFilter(quickFilter)}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm font-medium',
                      'hover:shadow-sm',
                      quickFilter.bgColor,
                      quickFilter.color,
                      'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="truncate">{quickFilter.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Event Types */}
          <div>
            <label className="text-xs font-medium text-gray-700 uppercase tracking-wider mb-2 block">
              Event Types
            </label>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {Object.entries(EVENT_TYPE_CONFIG).map(([type, config]) => {
                const Icon = config.icon;
                const isSelected = !filters.eventTypes || filters.eventTypes.includes(type as EventType);
                const count = eventCountsByType[type as EventType] || 0;

                return (
                  <label
                    key={type}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                      'hover:bg-gray-50',
                      isSelected && 'bg-blue-50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleEventTypeToggle(type as EventType)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className={clsx('flex-shrink-0 p-1.5 rounded', config.bgColor)}>
                      <Icon className={clsx('w-3.5 h-3.5', config.color)} />
                    </div>
                    <span className="flex-1 text-sm text-gray-900">{config.label}</span>
                    <span className="text-xs text-gray-500 font-medium">
                      {count}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Severities */}
          <div>
            <label className="text-xs font-medium text-gray-700 uppercase tracking-wider mb-2 block">
              Severity
            </label>
            <div className="space-y-1">
              {Object.entries(SEVERITY_CONFIG)
                .filter(([severity]) => severity !== 'UNKNOWN')
                .map(([severity, config]) => {
                  const Icon = config.icon;
                  const isSelected = !filters.severities || filters.severities.includes(severity as EventSeverity);
                  const count = eventCountsBySeverity[severity as EventSeverity] || 0;

                  return (
                    <label
                      key={severity}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                        'hover:bg-gray-50',
                        isSelected && 'bg-blue-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSeverityToggle(severity as EventSeverity)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className={clsx('flex-shrink-0 p-1.5 rounded', config.bgColor)}>
                        <Icon className={clsx('w-3.5 h-3.5', config.color)} />
                      </div>
                      <span className="flex-1 text-sm text-gray-900">{config.label}</span>
                      <span className="text-xs text-gray-500 font-medium">
                        {count}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      )}
                    </label>
                  );
                })}
            </div>
          </div>

          {/* Advanced Filters */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <Settings className="w-4 h-4" />
              Advanced Filters
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 pl-6 border-l-2 border-gray-200">
                {/* Closures Only Toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showClosuresOnly || false}
                    onChange={handleToggleClosuresOnly}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">
                    Show road closures only
                  </span>
                </label>

                {/* Active Only Toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showActiveOnly !== false}
                    onChange={handleToggleActiveOnly}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">
                    Show active events only
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
