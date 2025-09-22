/**
 * EventListPanel Component
 * Main panel container for the event list
 */

import React, { useState, useMemo } from 'react';
import { X, Filter, SortAsc, SortDesc, List, Grid } from 'lucide-react';
import EventList from './EventList';
import EventDetails from './EventDetails';
import EventFilters from './EventFilters';
import { TrafficEvent } from '@types/api.types';
import clsx from 'clsx';

interface EventListPanelProps {
  events: TrafficEvent[];
  closureEvents: TrafficEvent[];
  selectedEvent: TrafficEvent | null;
  onEventSelect: (event: TrafficEvent) => void;
  onClose: () => void;
}

type ViewMode = 'list' | 'grid' | 'details';
type SortOption = 'severity' | 'time' | 'location' | 'type';

export const EventListPanel: React.FC<EventListPanelProps> = ({
  events,
  closureEvents,
  selectedEvent,
  onEventSelect,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortOption>('severity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    types: [] as string[],
    severities: [] as string[],
    areas: [] as string[],
  });

  // Apply filters to events
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // Filter by types
    if (filters.types.length > 0) {
      filtered = filtered.filter(event => 
        filters.types.includes(event.event_type)
      );
    }

    // Filter by severities
    if (filters.severities.length > 0) {
      filtered = filtered.filter(event => 
        filters.severities.includes(event.severity)
      );
    }

    // Filter by areas
    if (filters.areas.length > 0) {
      filtered = filtered.filter(event => 
        event.areas?.some(area => filters.areas.includes(area.name))
      );
    }

    return filtered;
  }, [events, filters]);

  // Sort events
  const sortedEvents = useMemo(() => {
    const sorted = [...filteredEvents];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'severity':
          const severityOrder = { SEVERE: 0, MAJOR: 1, MODERATE: 2, MINOR: 3, UNKNOWN: 4 };
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        case 'time':
          comparison = new Date(b.updated).getTime() - new Date(a.updated).getTime();
          break;
        case 'location':
          const aRoad = a.roads?.[0]?.name || '';
          const bRoad = b.roads?.[0]?.name || '';
          comparison = aRoad.localeCompare(bRoad);
          break;
        case 'type':
          comparison = a.event_type.localeCompare(b.event_type);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredEvents, sortBy, sortOrder]);

  // Filter closure events
  const filteredClosureEvents = useMemo(() => {
    return closureEvents.filter(event => 
      sortedEvents.some(e => e.id === event.id)
    );
  }, [closureEvents, sortedEvents]);

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Show details view if an event is selected
  if (viewMode === 'details' && selectedEvent) {
    return (
      <div className="absolute top-4 right-4 z-[1000] w-96 max-h-[calc(100vh-2rem)]">
        <EventDetails
          event={selectedEvent}
          onClose={() => setViewMode('list')}
          onBack={() => setViewMode('list')}
        />
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-4 z-[1000] w-96 max-h-[calc(100vh-2rem)]">
      <div className="bg-white rounded-lg shadow-xl overflow-hidden flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Traffic Events</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-blue-100">
            <span>{sortedEvents.length} events</span>
            <span>{filteredClosureEvents.length} closures</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-white rounded border">
              <button
                onClick={() => setViewMode('list')}
                className={clsx(
                  "p-1.5 transition-colors",
                  viewMode === 'list' ? "bg-blue-100 text-blue-600" : "text-gray-600 hover:bg-gray-100"
                )}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={clsx(
                  "p-1.5 transition-colors",
                  viewMode === 'grid' ? "bg-blue-100 text-blue-600" : "text-gray-600 hover:bg-gray-100"
                )}
                aria-label="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>

            {/* Sort Options */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="severity">Severity</option>
              <option value="time">Time</option>
              <option value="location">Location</option>
              <option value="type">Type</option>
            </select>

            <button
              onClick={toggleSortOrder}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              aria-label={sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
            >
              {sortOrder === 'asc' ? (
                <SortAsc className="w-4 h-4 text-gray-600" />
              ) : (
                <SortDesc className="w-4 h-4 text-gray-600" />
              )}
            </button>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              "p-1.5 rounded transition-colors",
              showFilters ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100 text-gray-600"
            )}
            aria-label="Toggle filters"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="border-b">
            <EventFilters
              events={events}
              filters={filters}
              onFiltersChange={setFilters}
            />
          </div>
        )}

        {/* Event List */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'list' ? (
            <EventList
              events={sortedEvents}
              closureEvents={filteredClosureEvents}
              selectedEvent={selectedEvent}
              onEventSelect={(event) => {
                onEventSelect(event);
                if (event === selectedEvent) {
                  setViewMode('details');
                }
              }}
              onClose={onClose}
            />
          ) : viewMode === 'grid' ? (
            <EventGrid
              events={sortedEvents}
              selectedEvent={selectedEvent}
              onEventSelect={onEventSelect}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

// Event Grid Component (Alternative View)
interface EventGridProps {
  events: TrafficEvent[];
  selectedEvent: TrafficEvent | null;
  onEventSelect: (event: TrafficEvent) => void;
}

const EventGrid: React.FC<EventGridProps> = ({
  events,
  selectedEvent,
  onEventSelect,
}) => {
  return (
    <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto">
      {events.map((event) => (
        <div
          key={event.id}
          onClick={() => onEventSelect(event)}
          className={clsx(
            "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
            selectedEvent?.id === event.id
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300"
          )}
        >
          <div className="text-2xl mb-2">{getEventIcon(event)}</div>
          <p className="text-xs font-medium text-gray-900 line-clamp-2">
            {event.headline}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className={clsx(
              "text-xs px-1.5 py-0.5 rounded",
              event.severity === 'SEVERE' ? 'bg-red-100 text-red-800' :
              event.severity === 'MAJOR' ? 'bg-orange-100 text-orange-800' :
              'bg-gray-100 text-gray-800'
            )}>
              {event.severity}
            </span>
            <span className="text-xs text-gray-500">
              {formatEventTime(event.updated)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// Helper functions
import { formatEventTime, getEventIcon } from '@utils/eventUtils';

export default EventListPanel;
