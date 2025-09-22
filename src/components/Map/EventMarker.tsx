/**
 * EventMarker Component
 * Creates Leaflet markers for traffic events
 */

import L from 'leaflet';
import { TrafficEvent, EventSeverity } from '@types/api.types';
import { MarkerOptions } from '@types/map.types';
import { EVENT_TYPE_CONFIG, SEVERITY_CONFIG, MARKER_CONFIG } from '@utils/constants';
import { isRoadClosure, formatEventTime } from '@utils/eventUtils';

export class EventMarker {
  /**
   * Create a Leaflet marker for a traffic event
   */
  static create(options: MarkerOptions): L.Marker | null {
    const { event, isSelected, onClick, onHover } = options;
    
    if (!event.geography?.coordinates) return null;
    
    const coords = Array.isArray(event.geography.coordinates[0])
      ? event.geography.coordinates[0]
      : event.geography.coordinates;
    const [lng, lat] = coords as number[];
    
    // Get event configuration
    const eventConfig = EVENT_TYPE_CONFIG[event.event_type];
    const severityConfig = SEVERITY_CONFIG[event.severity];
    const isClosed = isRoadClosure(event);
    
    // Create custom icon
    const icon = this.createIcon(event, isSelected);
    
    // Create marker
    const marker = L.marker([lat, lng], { icon });
    
    // Create popup content
    const popupContent = this.createPopupContent(event);
    marker.bindPopup(popupContent, {
      maxWidth: 300,
      className: 'custom-popup',
      autoPan: true,
    });
    
    // Create tooltip
    const tooltipContent = this.createTooltipContent(event);
    marker.bindTooltip(tooltipContent, {
      permanent: false,
      direction: 'top',
      offset: [0, -15],
    });
    
    // Add event handlers
    if (onClick) {
      marker.on('click', () => onClick(event));
    }
    
    if (onHover) {
      marker.on('mouseover', () => onHover(event));
    }
    
    // Add data attribute for easy identification
    (marker as any).eventId = event.id;
    (marker as any).eventData = event;
    
    return marker;
  }
  
  /**
   * Create a custom icon for the marker
   */
  static createIcon(event: TrafficEvent, isSelected: boolean = false): L.DivIcon {
    const eventConfig = EVENT_TYPE_CONFIG[event.event_type];
    const severityConfig = SEVERITY_CONFIG[event.severity];
    const isClosed = isRoadClosure(event);
    
    // Determine icon and color
    const icon = isClosed ? '🚫' : eventConfig?.icon || '📍';
    const color = severityConfig?.color || eventConfig?.baseColor || '#6b7280';
    
    // Build class names
    const classNames = [
      'custom-marker',
      `marker-${event.severity.toLowerCase()}`,
      event.event_type.toLowerCase().replace('_', '-'),
    ];
    
    if (isSelected) classNames.push('selected');
    if (isClosed) classNames.push('marker-closure');
    
    // Create icon HTML
    const html = `
      <div class="${classNames.join(' ')}" style="background-color: ${color}">
        <span>${icon}</span>
      </div>
    `;
    
    return L.divIcon({
      html,
      className: '',
      iconSize: [MARKER_CONFIG.SIZE.width, MARKER_CONFIG.SIZE.height],
      iconAnchor: [MARKER_CONFIG.SIZE.width / 2, MARKER_CONFIG.SIZE.height / 2],
      popupAnchor: [0, -MARKER_CONFIG.SIZE.height / 2],
    });
  }
  
  /**
   * Create popup content for the event
   */
  static createPopupContent(event: TrafficEvent): string {
    const eventConfig = EVENT_TYPE_CONFIG[event.event_type];
    const severityConfig = SEVERITY_CONFIG[event.severity];
    const isClosed = isRoadClosure(event);
    
    // Build road information
    const roads = event.roads?.map(road => `
      <div class="popup-road-info">
        <strong>${road.name}</strong>
        ${road.from ? `<div class="text-xs text-gray-600">From: ${road.from}</div>` : ''}
        ${road.to ? `<div class="text-xs text-gray-600">To: ${road.to}</div>` : ''}
        ${road.direction ? `<div class="text-xs text-gray-600">Direction: ${road.direction}</div>` : ''}
        ${road.state ? `
          <div class="text-xs ${road.state === 'CLOSED' ? 'text-red-600 font-bold' : 'text-gray-600'}">
            Status: ${road.state.replace('_', ' ')}
          </div>
        ` : ''}
        ${road.lanes_closed ? `
          <div class="text-xs text-orange-600">
            ${road.lanes_closed} lane${road.lanes_closed > 1 ? 's' : ''} closed
          </div>
        ` : ''}
      </div>
    `).join('') || '';
    
    // Build areas information
    const areas = event.areas?.map(area => area.name).join(', ') || '';
    
    return `
      <div class="popup-container">
        <div class="popup-header" style="background: linear-gradient(135deg, ${severityConfig?.color}, ${eventConfig?.baseColor})">
          <span class="text-lg">${eventConfig?.icon || '📍'}</span>
          <span class="ml-2">${event.event_type.replace('_', ' ')}</span>
          ${isClosed ? '<span class="ml-auto bg-red-600 text-white px-2 py-1 rounded text-xs">CLOSED</span>' : ''}
        </div>
        <div class="popup-content">
          <h4 class="font-bold text-sm mb-2">${event.headline}</h4>
          
          <div class="space-y-2">
            <div class="info-row">
              <span class="info-label">Severity:</span>
              <span class="info-value" style="color: ${severityConfig?.color}">
                ${event.severity}
              </span>
            </div>
            
            <div class="info-row">
              <span class="info-label">Updated:</span>
              <span class="info-value">${formatEventTime(event.updated)}</span>
            </div>
            
            ${areas ? `
              <div class="info-row">
                <span class="info-label">Areas:</span>
                <span class="info-value">${areas}</span>
              </div>
            ` : ''}
            
            ${event.description ? `
              <div class="mt-2 pt-2 border-t border-gray-200">
                <p class="text-xs text-gray-700">${event.description.substring(0, 200)}${event.description.length > 200 ? '...' : ''}</p>
              </div>
            ` : ''}
            
            ${roads ? `
              <div class="mt-2 pt-2 border-t border-gray-200">
                <div class="text-xs font-semibold text-gray-700 mb-1">Affected Roads:</div>
                ${roads}
              </div>
            ` : ''}
            
            ${event.detour ? `
              <div class="mt-2 pt-2 border-t border-gray-200">
                <div class="text-xs font-semibold text-gray-700">Detour:</div>
                <p class="text-xs text-gray-600">${event.detour}</p>
              </div>
            ` : ''}
          </div>
          
          <div class="mt-3 pt-2 border-t border-gray-200">
            <div class="text-xs text-gray-500">
              Event ID: ${event.id}
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Create tooltip content for the event
   */
  static createTooltipContent(event: TrafficEvent): string {
    const isClosed = isRoadClosure(event);
    const mainRoad = event.roads?.[0]?.name || 'Unknown location';
    
    return `
      <div>
        <strong>${mainRoad}</strong>
        ${isClosed ? '<br/><span class="text-red-600">⚠️ ROAD CLOSED</span>' : ''}
        <br/>${event.severity} - ${formatEventTime(event.updated)}
      </div>
    `;
  }
  
  /**
   * Update marker selection state
   */
  static updateSelection(marker: L.Marker, isSelected: boolean): void {
    const markerElement = marker.getElement();
    if (!markerElement) return;
    
    const customMarker = markerElement.querySelector('.custom-marker');
    if (!customMarker) return;
    
    if (isSelected) {
      customMarker.classList.add('selected');
    } else {
      customMarker.classList.remove('selected');
    }
  }
  
  /**
   * Animate marker
   */
  static animate(marker: L.Marker, type: 'bounce' | 'pulse' = 'bounce'): void {
    const markerElement = marker.getElement();
    if (!markerElement) return;
    
    if (type === 'bounce') {
      markerElement.style.animation = 'bounce 0.5s ease-out';
      setTimeout(() => {
        markerElement.style.animation = '';
      }, 500);
    } else if (type === 'pulse') {
      markerElement.classList.add('animate-pulse');
      setTimeout(() => {
        markerElement.classList.remove('animate-pulse');
      }, 2000);
    }
  }
}
