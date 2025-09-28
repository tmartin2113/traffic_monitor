/**
 * EventSidebar Component
 * Production-ready collapsible sidebar for traffic events
 * @author 511 Traffic Monitor
 * @version 1.0.0
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  AlertCircle,
  Construction,
  Calendar,
  Navigation,
  Clock,
  Filter,
  Search,
  MapPin,
  Info,
  ExternalLink,
  Shield,
  Users,
} from 'lucide-react';
import { TrafficEvent, EventType, EventSeverity } from '@types/api.types';
import { formatDistanceToNow, format, isAfter, isBefore } from 'date-fns';
import clsx from 'clsx';
import { logger } from '@utils/logger';

/* ========================
   Type Definitions
======================== */

interface EventSidebarProps {
  events: TrafficEvent[];
  closureEvents: TrafficEvent[];
  selectedEvent: TrafficEvent | null;
  onEventSelect: (event: TrafficEvent | null) => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  position?: 'left' | 'right';
  width?: number;
}

interface FilterState {
  searchTerm: string;
  eventTypes: EventType[];
  severities: EventSeverity[];
  showClosuresOnly: boolean;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

/* ========================
   Constants
======================== */

const EVENT_TYPE_CONFIG = {
  [EventType.INCIDENT]: {
    label: 'Incident',
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  [EventType.CONSTRUCTION]: {
    label: 'Construction',
    icon: Construction,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  [EventType.SPECIAL_EVENT]: {
    label: 'Special Event',
    icon: Calendar,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  [EventType.ROAD_CONDITION]: {
    label: 'Road Condition',
    icon: Shield,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  [EventType.WEATHER_CONDITION]: {
    label: 'Weather',
    icon: Info,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
  },
};

const SEVERITY_CONFIG = {
  [EventSeverity.MAJOR]: {
    label: 'Major',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
  },
  [EventSeverity.MODERATE]: {
    label: 'Moderate',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
  },
  [EventSeverity.MINOR]: {
    label: 'Minor',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
  },
  [EventSeverity.UNKNOWN]: {
    label: 'Unknown',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
  },
};

/* ========================
   Sub-Components
======================== */

// Event List Item Component
const EventListItem: React.FC<{
  event: TrafficEvent;
  selected: boolean;
  onSelect: (event: TrafficEvent) => void;
}> = ({ event, selected, onSelect }) => {
  const typeConfig = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG[EventType.INCIDENT];
  const severityConfig = SEVERITY_CONFIG[event.severity || EventSeverity.UNKNOWN];
  const Icon = typeConfig.icon;
  
  const roadName = event.roads?.[0]?.name || 'Unknown Location';
  const timeAgo = event.updated
    ? formatDistanceToNow(new Date(event.updated), { addSuffix: true })
    : 'Unknown time';
  
  return (
    <div
      className={clsx(
        'p-3 border-l-4 cursor-pointer transition-all duration-200',
        'hover:bg-gray-50',
        selected ? 'bg-blue-50 border-blue-500' : 'border-transparent',
        !selected && severityConfig.borderColor
      )}
      onClick={() => onSelect(event)}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(event);
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className={clsx(
          'p-2 rounded-lg flex-shrink-0',
          typeConfig.bgColor
        )}>
          <Icon className={clsx('w-4 h-4', typeConfig.color)} />
        </div>
        
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
          
          {event.severity && event.severity !== EventSeverity.UNKNOWN && (
            <span className={clsx(
              'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-2',
              severityConfig.bgColor,
              severityConfig.color
            )}>
              {severityConfig.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// Event Details Panel
const EventDetailsPanel: React.FC<{
  event: TrafficEvent;
  onClose: () => void;
}> = ({ event, onClose }) => {
  const typeConfig = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG[EventType.INCIDENT];
  const severityConfig = SEVERITY_CONFIG[event.severity || EventSeverity.UNKNOWN];
  const Icon = typeConfig.icon;
  
  const createdDate = event.created ? new Date(event.created) : null;
  const updatedDate = event.updated ? new Date(event.updated) : null;
  
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={clsx('p-1.5 rounded', typeConfig.bgColor)}>
              <Icon className={clsx('w-4 h-4', typeConfig.color)} />
            </div>
            <h3 className="font-semibold text-gray-900">Event Details</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            aria-label="Close details"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Headline */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900">
              {event.headline}
            </h4>
            {event.severity && (
              <span className={clsx(
                'inline-flex items-center px-2.5 py-1 rounded text-sm font-medium mt-2',
                severityConfig.bgColor,
                severityConfig.color
              )}>
                {severityConfig.label} Impact
              </span>
            )}
          </div>
          
          {/* Description */}
          {event.description && (
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-1">Description</h5>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}
          
          {/* Location */}
          {event.roads && event.roads.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Affected Roads</h5>
              <div className="space-y-2">
                {event.roads.map((road, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <Navigation className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-gray-900">{road.name}</div>
                      {road.from && road.to && (
                        <div className="text-gray-600">
                          From {road.from} to {road.to}
                        </div>
                      )}
                      {road.direction && (
                        <div className="text-gray-500">
                          Direction: {road.direction}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Schedule */}
          {event.schedules && event.schedules.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Schedule</h5>
              <div className="space-y-1">
                {event.schedules.map((schedule, index) => (
                  <div key={index} className="text-sm text-gray-600">
                    {schedule.start_date && (
                      <div>
                        Start: {format(new Date(schedule.start_date), 'PPp')}
                      </div>
                    )}
                    {schedule.end_date && (
                      <div>
                        End: {format(new Date(schedule.end_date), 'PPp')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Timestamps */}
          <div className="pt-4 border-t space-y-1">
            {createdDate && (
              <div className="text-xs text-gray-500">
                Created: {format(createdDate, 'PPp')}
              </div>
            )}
            {updatedDate && (
              <div className="text-xs text-gray-500">
                Updated: {format(updatedDate, 'PPp')} ({formatDistanceToNow(updatedDate, { addSuffix: true })})
              </div>
            )}
          </div>
          
          {/* External Link */}
          {event.url && (
            <div className="pt-4">
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                View on 511.org
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Filter Panel Component
const FilterPanel: React.FC<{
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  eventCounts: Record<EventType, number>;
}> = ({ filters, onFilterChange, eventCounts }) => {
  const [expanded, setExpanded] = useState(false);
  
  const toggleEventType = (type: EventType) => {
    const newTypes = filters.eventTypes.includes(type)
      ? filters.eventTypes.filter(t => t !== type)
      : [...filters.eventTypes, type];
    onFilterChange({ ...filters, eventTypes: newTypes });
  };
  
  const toggleSeverity = (severity: EventSeverity) => {
    const newSeverities = filters.severities.includes(severity)
      ? filters.severities.filter(s => s !== severity)
      : [...filters.severities, severity];
    onFilterChange({ ...filters, severities: newSeverities });
  };
  
  return (
    <div className="border-b bg-gray-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {(filters.eventTypes.length > 0 || filters.severities.length > 0 || filters.showClosuresOnly) && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
              Active
            </span>
          )}
        </div>
        <ChevronDown className={clsx(
          'w-4 h-4 text-gray-400 transition-transform',
          expanded && 'rotate-180'
        )} />
      </button>
      
      {expanded && (
        <div className="px-4 py-3 space-y-3 border-t">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={filters.searchTerm}
              onChange={(e) => onFilterChange({ ...filters, searchTerm: e.target.value })}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Event Types */}
          <div>
            <label className="text-xs font-medium text-gray-700 uppercase tracking-wider">
              Event Types
            </label>
            <div className="mt-2 space-y-1">
              {Object.entries(EVENT_TYPE_CONFIG).map(([type, config]) => {
                const Icon = config.icon;
                const count = eventCounts[type as EventType] || 0;
                const isSelected = filters.eventTypes.length === 0 || filters.eventTypes.includes(type as EventType);
                
                return (
                  <label
                    key={type}
                    className="flex items-center gap-2 py-1 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleEventType(type as EventType)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Icon className={clsx('w-3 h-3', config.color)} />
                    <span className="text-sm text-gray-700">{config.label}</span>
                    <span className="text-xs text-gray-500">({count})</span>
                  </label>
                );
              })}
            </div>
          </div>
          
          {/* Severities */}
          <div>
            <label className="text-xs font-medium text-gray-700 uppercase tracking-wider">
              Severity
            </label>
            <div className="mt-2 space-y-1">
              {Object.entries(SEVERITY_CONFIG).map(([severity, config]) => {
                const isSelected = filters.severities.length === 0 || filters.severities.includes(severity as EventSeverity);
                
                return (
                  <label
                    key={severity}
                    className="flex items-center gap-2 py-1 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSeverity(severity as EventSeverity)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={clsx(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      config.bgColor,
                      config.color
                    )}>
                      {config.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          
          {/* Closures Only Toggle */}
          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showClosuresOnly}
              onChange={(e) => onFilterChange({ ...filters, showClosuresOnly: e.target.checked })}
              className="rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm font-medium text-gray-700">Show Closures Only</span>
          </label>
          
          {/* Clear Filters */}
          {(filters.eventTypes.length > 0 || filters.severities.length > 0 || filters.searchTerm || filters.showClosuresOnly) && (
            <button
              onClick={() => onFilterChange({
                searchTerm: '',
                eventTypes: [],
                severities: [],
                showClosuresOnly: false,
                dateRange: { start: null, end: null },
              })}
              className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* ========================
   Main Component
======================== */

const EventSidebar: React.FC<EventSidebarProps> = ({
  events,
  closureEvents,
  selectedEvent,
  onEventSelect,
  collapsible = true,
  defaultCollapsed = false,
  position = 'left',
  width = 384, // 24rem
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showDetails, setShowDetails] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    eventTypes: [],
    severities: [],
    showClosuresOnly: false,
    dateRange: { start: null, end: null },
  });
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Calculate event counts by type
  const eventCounts = useMemo(() => {
    const counts: Record<EventType, number> = {
      [EventType.INCIDENT]: 0,
      [EventType.CONSTRUCTION]: 0,
      [EventType.SPECIAL_EVENT]: 0,
      [EventType.ROAD_CONDITION]: 0,
      [EventType.WEATHER_CONDITION]: 0,
    };
    
    events.forEach(event => {
      if (counts[event.event_type] !== undefined) {
        counts[event.event_type]++;
      }
    });
    
    return counts;
  }, [events]);
  
  // Filter events based on current filters
  const filteredEvents = useMemo(() => {
    let filtered = filters.showClosuresOnly ? closureEvents : events;
    
    // Search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(event =>
        event.headline?.toLowerCase().includes(term) ||
        event.description?.toLowerCase().includes(term) ||
        event.roads?.some(road => road.name?.toLowerCase().includes(term))
      );
    }
    
    // Event type filter
    if (filters.eventTypes.length > 0) {
      filtered = filtered.filter(event => filters.eventTypes.includes(event.event_type));
    }
    
    // Severity filter
    if (filters.severities.length > 0) {
      filtered = filtered.filter(event => 
        event.severity && filters.severities.includes(event.severity)
      );
    }
    
    // Date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      filtered = filtered.filter(event => {
        if (!event.updated) return true;
        const eventDate = new Date(event.updated);
        
        if (filters.dateRange.start && isBefore(eventDate, filters.dateRange.start)) {
          return false;
        }
        if (filters.dateRange.end && isAfter(eventDate, filters.dateRange.end)) {
          return false;
        }
        return true;
      });
    }
    
    return filtered;
  }, [events, closureEvents, filters]);
  
  // Group events by type
  const groupedEvents = useMemo(() => {
    const groups: Record<EventType, TrafficEvent[]> = {
      [EventType.INCIDENT]: [],
      [EventType.CONSTRUCTION]: [],
      [EventType.SPECIAL_EVENT]: [],
      [EventType.ROAD_CONDITION]: [],
      [EventType.WEATHER_CONDITION]: [],
    };
    
    filteredEvents.forEach(event => {
      if (groups[event.event_type]) {
        groups[event.event_type].push(event);
      }
    });
    
    // Sort each group by updated date (most recent first)
    Object.keys(groups).forEach(type => {
      groups[type as EventType].sort((a, b) => {
        const dateA = a.updated ? new Date(a.updated).getTime() : 0;
        const dateB = b.updated ? new Date(b.updated).getTime() : 0;
        return dateB - dateA;
      });
    });
    
    return groups;
  }, [filteredEvents]);
  
  // Handle event selection
  const handleEventSelect = useCallback((event: TrafficEvent) => {
    onEventSelect(event);
    setShowDetails(true);
  }, [onEventSelect]);
  
  // Handle details close
  const handleDetailsClose = useCallback(() => {
    setShowDetails(false);
    onEventSelect(null);
  }, [onEventSelect]);
  
  // Auto-show details when event is selected externally
  useEffect(() => {
    if (selectedEvent && !showDetails) {
      setShowDetails(true);
    }
  }, [selectedEvent, showDetails]);
  
  // Calculate total counts
  const totalEvents = filteredEvents.length;
  const totalClosures = closureEvents.filter(event => 
    !filters.searchTerm || 
    event.headline?.toLowerCase().includes(filters.searchTerm.toLowerCase())
  ).length;
  
  return (
    <div
      ref={sidebarRef}
      className={clsx(
        'absolute top-0 z-[999] h-full transition-all duration-300 ease-in-out',
        'bg-white shadow-xl',
        position === 'left' ? 'left-0' : 'right-0',
        collapsed && (position === 'left' ? '-translate-x-full' : 'translate-x-full')
      )}
      style={{ width: `${width}px` }}
    >
      {/* Collapse Toggle */}
      {collapsible && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={clsx(
            'absolute top-4 -right-10 z-10',
            'w-10 h-10 bg-white rounded-r-lg shadow-md',
            'flex items-center justify-center',
            'hover:bg-gray-50 transition-colors',
            position === 'right' && 'right-auto -left-10 rounded-r-none rounded-l-lg'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {position === 'left' ? (
            collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />
          ) : (
            collapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />
          )}
        </button>
      )}
      
      {/* Content */}
      <div className="h-full flex flex-col">
        {showDetails && selectedEvent ? (
          <EventDetailsPanel
            event={selectedEvent}
            onClose={handleDetailsClose}
          />
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <h2 className="text-lg font-semibold">Traffic Events</h2>
              <div className="flex items-center gap-4 mt-1 text-sm text-blue-100">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {totalEvents} active
                </span>
                <span className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {totalClosures} closures
                </span>
              </div>
            </div>
            
            {/* Filter Panel */}
            <FilterPanel
              filters={filters}
              onFilterChange={setFilters}
              eventCounts={eventCounts}
            />
            
            {/* Event List */}
            <div className="flex-1 overflow-y-auto">
              {filteredEvents.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-gray-400 mb-4">
                    <AlertCircle className="w-12 h-12 mx-auto" />
                  </div>
                  <p className="text-gray-600 font-medium">No events found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {filters.searchTerm || filters.eventTypes.length > 0 || filters.severities.length > 0
                      ? 'Try adjusting your filters'
                      : 'All clear in this area'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {Object.entries(groupedEvents).map(([type, typeEvents]) => {
                    if (typeEvents.length === 0) return null;
                    
                    const config = EVENT_TYPE_CONFIG[type as EventType];
                    const Icon = config.icon;
                    
                    return (
                      <div key={type}>
                        <div className={clsx(
                          'px-4 py-2 flex items-center gap-2',
                          'bg-gray-50 border-b'
                        )}>
                          <Icon className={clsx('w-4 h-4', config.color)} />
                          <span className="text-sm font-medium text-gray-700">
                            {config.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({typeEvents.length})
                          </span>
                        </div>
                        
                        <div className="divide-y divide-gray-100">
                          {typeEvents.map(event => (
                            <EventListItem
                              key={event.id}
                              event={event}
                              selected={selectedEvent?.id === event.id}
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
          </>
        )}
      </div>
    </div>
  );
};

export default EventSidebar;
