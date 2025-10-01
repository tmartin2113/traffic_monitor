/**
 * @file components/EventPanel/EventList.tsx
 * @description Production-ready event list component with virtual scrolling
 * @version 1.0.0
 */

import React, { useMemo, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  AlertCircle, 
  Construction, 
  Calendar, 
  Navigation,
  Clock,
  ChevronRight,
  Filter
} from 'lucide-react';
import clsx from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';

// Type imports
import type { TrafficEvent, EventType, EventSeverity } from '@types/api.types';

// Store imports
import { useEventStore } from '@stores/eventStore';
import { useFilterStore } from '@stores/filterStore';

/**
 * Props interface for EventList component
 */
export interface EventListProps {
  /** Callback when an event is selected */
  onEventSelect?: (event: TrafficEvent) => void;
  /** Optional CSS class name */
  className?: string;
  /** Whether to show the filter summary */
  showFilterSummary?: boolean;
  /** Maximum height of the list */
  maxHeight?: string;
  /** Whether to enable virtual scrolling */
  enableVirtualScrolling?: boolean;
}

/**
 * Event type configuration for icons and colors
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
    icon: AlertCircle,
    label: 'Road Closure',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  LANE_CLOSURE: {
    icon: Construction,
    label: 'Lane Closure',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
  },
  ACCIDENT: {
    icon: AlertCircle,
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
    icon: AlertCircle,
    label: 'Hazard',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  OTHER: {
    icon: AlertCircle,
    label: 'Other',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
  },
};

/**
 * Severity configuration for colors and labels
 */
const SEVERITY_CONFIG: Record<EventSeverity, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  CRITICAL: {
    label: 'Critical',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
  },
  MAJOR: {
    label: 'Major',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
  },
  MODERATE: {
    label: 'Moderate',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
  },
  MINOR: {
    label: 'Minor',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
  },
  UNKNOWN: {
    label: 'Unknown',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
  },
};

/**
 * Event List Item Component
 */
const EventListItem: React.FC<{
  event: TrafficEvent;
  isSelected: boolean;
  onSelect: (event: TrafficEvent) => void;
}> = React.memo(({ event, isSelected, onSelect }) => {
  const typeConfig = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.OTHER;
  const severityConfig = event.severity 
    ? SEVERITY_CONFIG[event.severity] 
    : SEVERITY_CONFIG.UNKNOWN;
  
  const Icon = typeConfig.icon;
  
  const roadName = event.roads?.[0]?.name || 'Unknown Location';
  const timeAgo = event.updated
    ? formatDistanceToNow(new Date(event.updated), { addSuffix: true })
    : 'Unknown time';
  
  const handleClick = useCallback(() => {
    onSelect(event);
  }, [event, onSelect]);
  
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(event);
    }
  }, [event, onSelect]);

  return (
    <div
      className={clsx(
        'p-3 border-l-4 cursor-pointer transition-all duration-200',
        'hover:bg-gray-50',
        isSelected ? 'bg-blue-50 border-blue-500' : 'border-transparent',
        !isSelected && severityConfig.borderColor
      )}
      onClick={handleClick}
      onKeyPress={handleKeyPress}
      role="button"
      tabIndex={0}
      aria-label={`Event: ${event.headline}`}
      aria-selected={isSelected}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={clsx(
          'p-2 rounded-lg flex-shrink-0',
          typeConfig.bgColor
        )}>
          <Icon className={clsx('w-4 h-4', typeConfig.color)} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {event.headline}
          </h4>
          
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              {roadName}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </span>
          </div>
          
          {event.severity && event.severity !== 'UNKNOWN' && (
            <span className={clsx(
              'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-2',
              severityConfig.bgColor,
              severityConfig.color
            )}>
              {severityConfig.label}
            </span>
          )}
        </div>

        {/* Arrow */}
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </div>
    </div>
  );
});

EventListItem.displayName = 'EventListItem';

/**
 * EventList Component
 * 
 * Production-ready list component with:
 * - Virtual scrolling for performance
 * - Event grouping by type
 * - Filter integration
 * - Keyboard navigation
 * - Accessibility features
 */
export const EventList: React.FC<EventListProps> = ({
  onEventSelect,
  className,
  showFilterSummary = true,
  maxHeight = '60vh',
  enableVirtualScrolling = true,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Get events from store
  const events = useEventStore((state) => Array.from(state.events.values()));
  const filters = useFilterStore((state) => state.filters);
  const activeFilterCount = useFilterStore((state) => state.getActiveFilterCount());

  // Filter and sort events
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // Apply event type filter
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      filtered = filtered.filter((event) =>
        filters.eventTypes!.includes(event.event_type)
      );
    }

    // Apply severity filter
    if (filters.severities && filters.severities.length > 0) {
      filtered = filtered.filter((event) =>
        event.severity && filters.severities!.includes(event.severity)
      );
    }

    // Apply search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter((event) =>
        event.headline.toLowerCase().includes(searchLower) ||
        event.description?.toLowerCase().includes(searchLower) ||
        event.roads?.some((road) => road.name.toLowerCase().includes(searchLower))
      );
    }

    // Apply closures only filter
    if (filters.showClosuresOnly) {
      filtered = filtered.filter((event) =>
        event.event_type === 'ROAD_CLOSURE' || event.event_type === 'LANE_CLOSURE'
      );
    }

    // Sort by severity and updated time
    filtered.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, MAJOR: 1, MODERATE: 2, MINOR: 3, UNKNOWN: 4 };
      const aSeverity = a.severity ? severityOrder[a.severity] : 4;
      const bSeverity = b.severity ? severityOrder[b.severity] : 4;

      if (aSeverity !== bSeverity) {
        return aSeverity - bSeverity;
      }

      const aTime = a.updated ? new Date(a.updated).getTime() : 0;
      const bTime = b.updated ? new Date(b.updated).getTime() : 0;
      return bTime - aTime;
    });

    return filtered;
  }, [events, filters]);

  // Group events by type
  const groupedEvents = useMemo(() => {
    const groups: Record<EventType, TrafficEvent[]> = {} as any;

    filteredEvents.forEach((event) => {
      if (!groups[event.event_type]) {
        groups[event.event_type] = [];
      }
      groups[event.event_type].push(event);
    });

    return groups;
  }, [filteredEvents]);

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: filteredEvents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    enabled: enableVirtualScrolling && filteredEvents.length > 20,
  });

  // Handle event selection
  const handleEventSelect = useCallback((event: TrafficEvent) => {
    setSelectedEventId(event.id);
    onEventSelect?.(event);
  }, [onEventSelect]);

  return (
    <div className={clsx('flex flex-col h-full', className)}>
      {/* Filter Summary */}
      {showFilterSummary && activeFilterCount > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <Filter className="w-4 h-4" />
            <span className="font-medium">{activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active</span>
            <span className="text-blue-600">·</span>
            <span>{filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} shown</span>
          </div>
        </div>
      )}

      {/* Event List */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto"
        style={{ maxHeight }}
      >
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <AlertCircle className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-600 font-medium">No events found</p>
            <p className="text-sm text-gray-500 mt-1">
              {activeFilterCount > 0
                ? 'Try adjusting your filters'
                : 'All clear in this area'}
            </p>
          </div>
        ) : enableVirtualScrolling && filteredEvents.length > 20 ? (
          // Virtual scrolling for large lists
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const event = filteredEvents[virtualItem.index];
              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <EventListItem
                    event={event}
                    isSelected={selectedEventId === event.id}
                    onSelect={handleEventSelect}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          // Regular rendering for smaller lists
          <div className="divide-y divide-gray-100">
            {Object.entries(groupedEvents).map(([type, typeEvents]) => {
              if (typeEvents.length === 0) return null;

              const config = EVENT_TYPE_CONFIG[type as EventType];
              const Icon = config.icon;

              return (
                <div key={type}>
                  <div className="px-4 py-2 flex items-center gap-2 bg-gray-50 border-b">
                    <Icon className={clsx('w-4 h-4', config.color)} />
                    <span className="text-sm font-medium text-gray-700">
                      {config.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({typeEvents.length})
                    </span>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {typeEvents.map((event) => (
                      <EventListItem
                        key={event.id}
                        event={event}
                        isSelected={selectedEventId === event.id}
                        onSelect={handleEventSelect}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventList;
