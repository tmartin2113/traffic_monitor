/**
 * @file components/EventPanel/EventDetails.tsx
 * @description Production-ready event details component with comprehensive information display
 * @version 1.0.0
 */

import React, { useMemo, useCallback } from 'react';
import { 
  X,
  AlertCircle,
  Construction,
  Calendar,
  Navigation,
  Clock,
  MapPin,
  Info,
  ExternalLink,
  ChevronLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Minus
} from 'lucide-react';
import clsx from 'clsx';
import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

// Type imports
import type { TrafficEvent, EventType, EventSeverity, RoadState } from '@types/api.types';

/**
 * Props interface for EventDetails component
 */
export interface EventDetailsProps {
  /** The traffic event to display */
  event: TrafficEvent;
  /** Callback when the close button is clicked */
  onClose?: () => void;
  /** Optional CSS class name */
  className?: string;
  /** Whether to show the back button instead of close */
  showBackButton?: boolean;
  /** Whether to show external link to 511.org */
  showExternalLink?: boolean;
}

/**
 * Event type configuration
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
    label: 'Weather Condition',
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
    label: 'Traffic Congestion',
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
  borderColor: string;
}> = {
  CRITICAL: {
    label: 'Critical',
    icon: AlertTriangle,
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
  },
  MAJOR: {
    label: 'Major',
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
  },
  MODERATE: {
    label: 'Moderate',
    icon: AlertCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
  },
  MINOR: {
    label: 'Minor',
    icon: Info,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
  },
  UNKNOWN: {
    label: 'Unknown',
    icon: Info,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
  },
};

/**
 * Road state configuration
 */
const ROAD_STATE_CONFIG: Record<RoadState, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}> = {
  CLOSED: {
    label: 'Closed',
    icon: XCircle,
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  OPEN: {
    label: 'Open',
    icon: CheckCircle,
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  REDUCED: {
    label: 'Reduced Capacity',
    icon: Minus,
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
  },
};

/**
 * Format date helper
 */
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'Unknown';
  
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return 'Invalid date';
    return format(date, 'PPp'); // e.g., "Apr 29, 2023, 9:30 AM"
  } catch (error) {
    return 'Invalid date';
  }
};

/**
 * Detail Row Component
 */
const DetailRow: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}> = ({ label, value, icon: Icon }) => (
  <div className="py-3 border-b border-gray-100 last:border-0">
    <div className="flex items-start gap-3">
      {Icon && (
        <div className="flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-gray-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
          {label}
        </dt>
        <dd className="text-sm text-gray-900">
          {value || <span className="text-gray-400 italic">Not specified</span>}
        </dd>
      </div>
    </div>
  </div>
);

/**
 * EventDetails Component
 * 
 * Production-ready details component with:
 * - Comprehensive event information display
 * - Road and schedule information
 * - Severity and status indicators
 * - External links to 511.org
 * - Responsive design
 * - Accessibility features
 */
export const EventDetails: React.FC<EventDetailsProps> = ({
  event,
  onClose,
  className,
  showBackButton = false,
  showExternalLink = true,
}) => {
  const typeConfig = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.OTHER;
  const severityConfig = event.severity 
    ? SEVERITY_CONFIG[event.severity] 
    : SEVERITY_CONFIG.UNKNOWN;
  
  const TypeIcon = typeConfig.icon;
  const SeverityIcon = severityConfig.icon;

  // Format dates
  const createdDate = useMemo(() => 
    event.created ? formatDate(event.created) : null,
    [event.created]
  );

  const updatedDate = useMemo(() => 
    event.updated ? parseISO(event.updated) : null,
    [event.updated]
  );

  const updatedDateFormatted = useMemo(() => 
    updatedDate && isValid(updatedDate) ? format(updatedDate, 'PPp') : null,
    [updatedDate]
  );

  const updatedTimeAgo = useMemo(() => 
    updatedDate && isValid(updatedDate) ? formatDistanceToNow(updatedDate, { addSuffix: true }) : null,
    [updatedDate]
  );

  // Handle external link
  const handleExternalLink = useCallback(() => {
    if (event.url) {
      window.open(event.url, '_blank', 'noopener,noreferrer');
    }
  }, [event.url]);

  return (
    <div className={clsx('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Event Details</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label={showBackButton ? 'Go back' : 'Close details'}
          >
            {showBackButton ? (
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            ) : (
              <X className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* Event Type Banner */}
        <div className={clsx('px-4 py-3', typeConfig.bgColor)}>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <TypeIcon className={clsx('w-6 h-6', typeConfig.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                {typeConfig.label}
              </div>
              <h3 className="text-base font-semibold text-gray-900 mt-0.5">
                {event.headline}
              </h3>
            </div>
          </div>
        </div>

        {/* Severity Badge */}
        {event.severity && event.severity !== 'UNKNOWN' && (
          <div className="px-4 py-2 bg-gray-50">
            <div className={clsx(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
              severityConfig.bgColor,
              severityConfig.borderColor,
              'border'
            )}>
              <SeverityIcon className={clsx('w-4 h-4', severityConfig.color)} />
              <span className={clsx('text-sm font-medium', severityConfig.color)}>
                {severityConfig.label} Severity
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-4">
          {/* Description */}
          {event.description && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Description
              </h4>
              <p className="text-sm text-blue-800 leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {/* Details List */}
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
            <div className="px-4 bg-gray-50">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider py-2">
                Event Information
              </h4>
            </div>

            <div className="px-4">
              {/* Event ID */}
              <DetailRow
                label="Event ID"
                value={<code className="text-xs bg-gray-100 px-2 py-1 rounded">{event.id}</code>}
                icon={Info}
              />

              {/* Status */}
              {event.status && (
                <DetailRow
                  label="Status"
                  value={
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {event.status}
                    </span>
                  }
                  icon={CheckCircle}
                />
              )}

              {/* Created Date */}
              {createdDate && (
                <DetailRow
                  label="Created"
                  value={createdDate}
                  icon={Clock}
                />
              )}

              {/* Updated Date */}
              {updatedDateFormatted && (
                <DetailRow
                  label="Last Updated"
                  value={
                    <div>
                      <div>{updatedDateFormatted}</div>
                      {updatedTimeAgo && (
                        <div className="text-xs text-gray-500 mt-1">
                          ({updatedTimeAgo})
                        </div>
                      )}
                    </div>
                  }
                  icon={Clock}
                />
              )}
            </div>
          </div>

          {/* Roads Information */}
          {event.roads && event.roads.length > 0 && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              <div className="px-4 bg-gray-50">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider py-2">
                  Affected Roads
                </h4>
              </div>

              <div className="px-4 py-3 space-y-3">
                {event.roads.map((road, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Navigation className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{road.name}</div>
                      {road.from && road.to && (
                        <div className="text-sm text-gray-600 mt-1">
                          From <span className="font-medium">{road.from}</span> to{' '}
                          <span className="font-medium">{road.to}</span>
                        </div>
                      )}
                      {road.direction && (
                        <div className="text-sm text-gray-500 mt-1">
                          Direction: {road.direction}
                        </div>
                      )}
                      {road.state && (
                        <div className="mt-2">
                          {(() => {
                            const stateConfig = ROAD_STATE_CONFIG[road.state];
                            const StateIcon = stateConfig.icon;
                            return (
                              <span className={clsx(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                                stateConfig.bgColor,
                                stateConfig.color
                              )}>
                                <StateIcon className="w-3 h-3" />
                                {stateConfig.label}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schedule Information */}
          {event.schedule && event.schedule.length > 0 && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              <div className="px-4 bg-gray-50">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider py-2">
                  Schedule
                </h4>
              </div>

              <div className="px-4 py-3 space-y-3">
                {event.schedule.map((schedule, index) => (
                  <div key={index} className="text-sm">
                    {schedule.start_date && (
                      <div className="flex items-center gap-2 text-gray-900">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">Start:</span>
                        <span>{formatDate(schedule.start_date)}</span>
                      </div>
                    )}
                    {schedule.end_date && (
                      <div className="flex items-center gap-2 text-gray-900 mt-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">End:</span>
                        <span>{formatDate(schedule.end_date)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Areas */}
          {event.areas && event.areas.length > 0 && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              <div className="px-4 bg-gray-50">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider py-2">
                  Areas
                </h4>
              </div>

              <div className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {event.areas.map((area, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      <MapPin className="w-3 h-3" />
                      {area.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {showExternalLink && event.url && (
        <div className="flex-shrink-0 border-t border-gray-200 px-4 py-3 bg-gray-50">
          <button
            onClick={handleExternalLink}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            View on 511.org
          </button>
        </div>
      )}
    </div>
  );
};

export default EventDetails;
