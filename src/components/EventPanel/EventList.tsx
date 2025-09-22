/**
 * EventList Component
 * Displays a list of traffic events with filtering and sorting
 */

import React, { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, X, AlertCircle, Construction, MapPin, Cloud, Road } from 'lucide-react';
import { TrafficEvent, EventType } from '@types/api.types';
import { Badge } from '@components/shared';
import { formatEventTime, isRoadClosure, getEventIcon, getPrimaryRoad, getImpactDescription } from '@utils/eventUtils';
import clsx from 'clsx';

interface EventListProps {
  events: TrafficEvent[];
  closureEvents: TrafficEvent[];
  selectedEvent: TrafficEvent | null;
  onEventSelect: (event: TrafficEvent) => void;
  onClose: () => void;
  maxHeight?: string;
}

export const EventList: React.FC<EventListProps> = ({
  events,
  closureEvents,
  selectedEvent,
  onEventSelect,
  onClose,
  maxHeight = '60vh',
}) => {
  const [expandedSections, setExpandedSections] = useState({
    closures: true,
    incidents: true,
    construction: false,
    other: false,
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Group events by type
  const groupedEvents = useMemo(() => {
    const groups = {
      closures: closureEvents,
      incidents: events.filter(e => e.event_type === EventType.INCIDENT && !isRoadClosure(e)),
      construction: events.filter(e => e.event_type === EventType.CONSTRUCTION && !isRoadClosure(e)),
      other: events.filter(e => 
        e.event_type !== EventType.INCIDENT && 
        e.event_type !== EventType.CONSTRUCTION && 
        !isRoadClosure(e)
      ),
    };

    // Filter by search term if provided
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      Object.keys(groups).forEach(key => {
        groups[key as keyof typeof groups] = groups[key as keyof typeof groups].filter(event =>
          event.headline?.toLowerCase().includes(term) ||
          event.roads?.some(road => road.name?.toLowerCase().includes(term)) ||
          event.areas?.some(area => area.name?.toLowerCase().includes(term))
        );
      });
    }

    return groups;
  }, [events, closureEvents, searchTerm]);

  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const getSectionIcon = (type: string): React.ReactNode => {
    switch (type) {
      case 'closures':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'incidents':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'construction':
        return <Construction className="w-4 h-4 text-yellow-600" />;
      case 'other':
        return <MapPin className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getSectionLabel = (type: string, count: number): string => {
    switch (type) {
      case 'closures':
        return `Road Closures (${count})`;
      case 'incidents':
        return `Incidents (${count})`;
      case 'construction':
        return `Construction (${count})`;
      case 'other':
        return `Other Events (${count})`;
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl overflow-hidden flex flex-col" style={{ maxHeight }}>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gradient-to-r from-gray-50 to-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Active Events</h3>
          <p className="text-xs text-gray-600 mt-0.5">
            {events.length} total • {closureEvents.length} closures
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          aria-label="Close event list"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b">
        <input
          type="text"
          placeholder="Search events..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Event sections */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(groupedEvents).map(([type, sectionEvents]) => (
          <EventSection
            key={type}
            type={type}
            events={sectionEvents}
            expanded={expandedSections[type as keyof typeof expandedSections]}
            onToggle={() => toggleSection(type as keyof typeof expandedSections)}
            icon={getSectionIcon(type)}
            label={getSectionLabel(type, sectionEvents.length)}
            selectedEvent={selectedEvent}
            onEventSelect={onEventSelect}
          />
        ))}

        {/* Empty state */}
        {events.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No active events</p>
            <p className="text-sm mt-1">Traffic conditions are normal</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Event Section Component
interface EventSectionProps {
  type: string;
  events: TrafficEvent[];
  expanded: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  selectedEvent: TrafficEvent | null;
  onEventSelect: (event: TrafficEvent) => void;
}

const EventSection: React.FC<EventSectionProps> = ({
  type,
  events,
  expanded,
  onToggle,
  icon,
  label,
  selectedEvent,
  onEventSelect,
}) => {
  if (events.length === 0) return null;

  const isHighPriority = type === 'closures' || type === 'incidents';

  return (
    <div className="border-b">
      <button
        onClick={onToggle}
        className={clsx(
          "w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors",
          isHighPriority && "bg-red-50 hover:bg-red-100"
        )}
      >
        <div className="flex items-center space-x-2">
          {icon}
          <span className="font-medium text-sm">{label}</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="divide-y divide-gray-100">
          {events.map((event) => (
            <EventListItem
              key={event.id}
              event={event}
              isSelected={selectedEvent?.id === event.id}
              onClick={() => onEventSelect(event)}
              isHighPriority={isHighPriority}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Event List Item Component
interface EventListItemProps {
  event: TrafficEvent;
  isSelected: boolean;
  onClick: () => void;
  isHighPriority: boolean;
}

const EventListItem: React.FC<EventListItemProps> = ({
  event,
  isSelected,
  onClick,
  isHighPriority,
}) => {
  const isClosed = isRoadClosure(event);
  const primaryRoad = getPrimaryRoad(event);
  const impact = getImpactDescription(event);

  return (
    <div
      onClick={onClick}
      className={clsx(
        "px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors",
        isSelected && "bg-blue-50 border-l-4 border-l-blue-500",
        isHighPriority && !isSelected && "hover:bg-red-50"
      )}
    >
      <div className="flex items-start space-x-3">
        {/* Event Icon */}
        <div className="text-2xl flex-shrink-0 mt-0.5">
          {getEventIcon(event)}
        </div>

        {/* Event Details */}
        <div className="flex-1 min-w-0">
          {/* Headline */}
          <p className="text-sm font-medium text-gray-900 line-clamp-2">
            {event.headline}
          </p>

          {/* Road and Impact */}
          <div className="mt-1 text-xs text-gray-600">
            <p className="font-medium">{primaryRoad}</p>
            {impact && <p className="text-gray-500">{impact}</p>}
          </div>

          {/* Badges and Time */}
          <div className="mt-2 flex items-center flex-wrap gap-1.5">
            <Badge
              variant={
                event.severity === 'SEVERE' ? 'danger' :
                event.severity === 'MAJOR' ? 'warning' :
                'default'
              }
              size="sm"
            >
              {event.severity}
            </Badge>

            {isClosed && (
              <Badge variant="danger" size="sm">
                CLOSED
              </Badge>
            )}

            <span className="text-xs text-gray-500 ml-auto">
              {formatEventTime(event.updated)}
            </span>
          </div>

          {/* Areas if available */}
          {event.areas && event.areas.length > 0 && (
            <div className="mt-1">
              <p className="text-xs text-gray-500">
                {event.areas.map(a => a.name).join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventList;
