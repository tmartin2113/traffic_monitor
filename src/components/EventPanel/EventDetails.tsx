/**
 * EventDetails Component
 * Displays detailed information about a traffic event
 */

import React from 'react';
import { 
  X, 
  ArrowLeft, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  Navigation, 
  Calendar,
  ChevronRight,
  ExternalLink,
  Share2,
  Heart
} from 'lucide-react';
import { TrafficEvent } from '@types/api.types';
import { Badge } from '@components/shared';
import { 
  formatDateTime, 
  getRelativeTime, 
  formatDuration 
} from '@utils/dateUtils';
import { 
  getEventIcon, 
  getEventColor, 
  isRoadClosure,
  getPrimaryRoad,
  getImpactDescription,
  getAffectedAreas
} from '@utils/eventUtils';
import clsx from 'clsx';

interface EventDetailsProps {
  event: TrafficEvent;
  onClose: () => void;
  onBack?: () => void;
  onShare?: (event: TrafficEvent) => void;
  onFavorite?: (event: TrafficEvent) => void;
  isFavorite?: boolean;
}

const EventDetails: React.FC<EventDetailsProps> = ({
  event,
  onClose,
  onBack,
  onShare,
  onFavorite,
  isFavorite = false,
}) => {
  const isClosed = isRoadClosure(event);
  const eventColor = getEventColor(event);
  const affectedAreas = getAffectedAreas(event);
  const duration = formatDuration(event.created, event.updated);

  return (
    <div className="bg-white rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]">
      {/* Header */}
      <div 
        className="p-4 text-white"
        style={{ background: `linear-gradient(135deg, ${eventColor}, ${eventColor}dd)` }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                aria-label="Back to list"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="text-3xl">{getEventIcon(event)}</div>
          </div>
          <div className="flex items-center space-x-1">
            {onFavorite && (
              <button
                onClick={() => onFavorite(event)}
                className={clsx(
                  "p-1.5 rounded transition-colors",
                  isFavorite 
                    ? "bg-white/20 text-white" 
                    : "hover:bg-white/20"
                )}
                aria-label="Toggle favorite"
              >
                <Heart className={clsx("w-4 h-4", isFavorite && "fill-current")} />
              </button>
            )}
            {onShare && (
              <button
                onClick={() => onShare(event)}
                className="p-1.5 hover:bg-white/20 rounded transition-colors"
                aria-label="Share event"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded transition-colors"
              aria-label="Close details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-2">
          {event.headline}
        </h2>

        <div className="flex items-center space-x-3 text-sm text-white/90">
          <Badge
            variant="default"
            className="bg-white/20 text-white border-white/30"
          >
            {event.event_type.replace('_', ' ')}
          </Badge>
          <Badge
            variant="default"
            className="bg-white/20 text-white border-white/30"
          >
            {event.severity}
          </Badge>
          {isClosed && (
            <Badge
              variant="danger"
              className="bg-red-600 text-white"
            >
              ROAD CLOSED
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Quick Info */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-start space-x-2">
              <Clock className="w-4 h-4 text-gray-500 mt-0.5" />
              <div>
                <p className="text-gray-600">Updated</p>
                <p className="font-medium">{getRelativeTime(event.updated)}</p>
                <p className="text-xs text-gray-500">{formatDateTime(event.updated)}</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <Calendar className="w-4 h-4 text-gray-500 mt-0.5" />
              <div>
                <p className="text-gray-600">Duration</p>
                <p className="font-medium">{duration}</p>
                <p className="text-xs text-gray-500">Since {formatDateTime(event.created)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {event.description}
            </p>
          </div>
        )}

        {/* Affected Roads */}
        {event.roads && event.roads.length > 0 && (
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900 mb-3">Affected Roads</h3>
            <div className="space-y-3">
              {event.roads.map((road, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <p className="font-medium text-sm">{road.name}</p>
                    </div>
                    {road.state && (
                      <Badge
                        variant={road.state === 'CLOSED' ? 'danger' : 'warning'}
                        size="sm"
                      >
                        {road.state.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    {road.from && (
                      <div>
                        <span className="text-gray-500">From:</span> {road.from}
                      </div>
                    )}
                    {road.to && (
                      <div>
                        <span className="text-gray-500">To:</span> {road.to}
                      </div>
                    )}
                    {road.direction && (
                      <div>
                        <span className="text-gray-500">Direction:</span> {road.direction}
                      </div>
                    )}
                    {road.lanes_closed !== undefined && (
                      <div>
                        <span className="text-gray-500">Lanes Closed:</span> {road.lanes_closed}
                      </div>
                    )}
                  </div>
                  
                  {road.road_advisory && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      {road.road_advisory}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detour Information */}
        {event.detour && (
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
              <Navigation className="w-4 h-4 mr-2" />
              Detour Information
            </h3>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                {event.detour}
              </p>
            </div>
          </div>
        )}

        {/* Affected Areas */}
        {affectedAreas.length > 0 && (
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900 mb-2">Affected Areas</h3>
            <div className="flex flex-wrap gap-2">
              {affectedAreas.map((area, index) => (
                <Badge key={index} variant="default" size="sm">
                  {area}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Schedule Information */}
        {event.schedules && event.schedules.length > 0 && (
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900 mb-2">Schedule</h3>
            {event.schedules.map((schedule, index) => (
              <div key={index} className="text-sm text-gray-700">
                {schedule.recurring_schedules?.map((recurring, idx) => (
                  <div key={idx} className="mb-2">
                    <p className="font-medium">
                      {recurring.days?.join(', ') || 'Daily'}
                    </p>
                    {recurring.daily_start_time && recurring.daily_end_time && (
                      <p className="text-gray-600">
                        {recurring.daily_start_time} - {recurring.daily_end_time}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Additional Information */}
        <div className="p-4 bg-gray-50">
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Event ID:</span>
              <span className="font-mono">{event.id}</span>
            </div>
            {event.source_type && (
              <div className="flex justify-between">
                <span>Source:</span>
                <span>{event.source_type}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="font-medium">{event.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Footer */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex space-x-2">
          <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 text-sm font-medium">
            <Navigation className="w-4 h-4" />
            <span>Get Directions</span>
          </button>
          <button className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;
