/**
 * EventPanel Component Exports
 * 
 * @module components/EventPanel
 * @description Centralized export point for all EventPanel components.
 * Provides traffic event display and interaction components.
 * 
 * @author Senior Development Team
 * @since 1.0.0
 * @license MIT
 */

// Component Exports
export { default as EventList } from './EventList';
export { default as EventDetails } from './EventDetails';
export { default as EventFilters } from './EventFilters';

// Type Exports (if any component-specific types exist)
export type { EventListProps } from './EventList';
export type { EventDetailsProps } from './EventDetails';
export type { EventFiltersProps } from './EventFilters';

// Named Exports for Convenience
import EventList from './EventList';
import EventDetails from './EventDetails';
import EventFilters from './EventFilters';

/**
 * EventPanel namespace containing all event-related components
 * @namespace EventPanel
 */
export const EventPanel = {
  List: EventList,
  Details: EventDetails,
  Filters: EventFilters,
} as const;

/**
 * Default export for simplified imports
 * Usage: import { EventListPanel } from '@components/EventPanel';
 */
export const EventListPanel = EventList;
export const EventDetailsPanel = EventDetails;
export const EventFiltersPanel = EventFilters;

// Re-export utility types for event handling
export interface EventPanelComponents {
  EventList: typeof EventList;
  EventDetails: typeof EventDetails;
  EventFilters: typeof EventFilters;
}

// Version information
export const EVENT_PANEL_VERSION = '1.0.0' as const;
