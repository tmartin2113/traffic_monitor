/**
 * ClosurePolyline Component
 * Creates polylines for road closures on the map
 */

import L from 'leaflet';
import { TrafficEvent } from '@types/api.types';
import { CLOSURE_STYLES } from '@utils/constants';
import { simplifyPolyline } from '@utils/geoUtils';

interface ClosurePolylineOptions {
  coordinates: number[][];
  event: TrafficEvent;
  onClick?: () => void;
  isSelected?: boolean;
}

export class ClosurePolyline {
  /**
   * Create a Leaflet polyline for a road closure
   */
  static create(options: ClosurePolylineOptions): L.Polyline | null {
    const { coordinates, event, onClick, isSelected } = options;
    
    if (!coordinates || coordinates.length < 2) return null;
    
    // Convert coordinates to LatLng format and simplify if needed
    const latLngs = coordinates.map(coord => [coord[1], coord[0]] as L.LatLngTuple);
    const simplified = coordinates.length > 100 
      ? simplifyPolyline(coordinates).map(coord => [coord[1], coord[0]] as L.LatLngTuple)
      : latLngs;
    
    // Determine closure style based on road state
    const style = this.getClosureStyle(event);
    
    // Create polyline
    const polyline = L.polyline(simplified, {
      ...style,
      className: 'closure-line',
      interactive: true,
      smoothFactor: 1.0,
      noClip: false,
    });
    
    // Add popup
    const popupContent = this.createPopupContent(event);
    polyline.bindPopup(popupContent, {
      maxWidth: 300,
      className: 'closure-popup',
    });
    
    // Add tooltip
    const tooltipContent = this.createTooltipContent(event);
    polyline.bindTooltip(tooltipContent, {
      permanent: false,
      sticky: true,
      direction: 'center',
    });
    
    // Add click handler
    if (onClick) {
      polyline.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onClick();
      });
    }
    
    // Apply selected state if needed
    if (isSelected) {
      polyline.setStyle({
        weight: (style.weight || 4) + 2,
        opacity: 1,
      });
    }
    
    // Store event data for reference
    (polyline as any).eventData = event;
    
    return polyline;
  }
  
  /**
   * Get closure style based on event and road state
   */
  static getClosureStyle(event: TrafficEvent): L.PolylineOptions {
    let style = { ...CLOSURE_STYLES.FULL_CLOSURE };
    
    // Check road states to determine closure type
    const hasFullClosure = event.roads?.some(road => road.state === 'CLOSED');
    const hasPartialClosure = event.roads?.some(road => 
      road.state === 'SOME_LANES_CLOSED' || 
      (road.lanes_closed && road.lanes_closed > 0 && road.lanes_open && road.lanes_open > 0)
    );
    const hasSingleLane = event.roads?.some(road => 
      road.state === 'SINGLE_LANE_ALTERNATING' ||
      road.lanes_open === 1
    );
    
    if (hasFullClosure) {
      style = { ...CLOSURE_STYLES.FULL_CLOSURE };
    } else if (hasPartialClosure) {
      style = { ...CLOSURE_STYLES.PARTIAL_CLOSURE };
    } else if (hasSingleLane) {
      style = { ...CLOSURE_STYLES.SINGLE_LANE };
    }
    
    // Adjust opacity based on event age
    const eventAge = Date.now() - new Date(event.updated).getTime();
    const ageHours = eventAge / (1000 * 60 * 60);
    if (ageHours > 24) {
      style.opacity = (style.opacity || 0.8) * 0.7;
    }
    
    return style;
  }
  
  /**
   * Create popup content for the closure
   */
  static createPopupContent(event: TrafficEvent): string {
    const primaryRoad = event.roads?.[0];
    const closureType = this.getClosureType(event);
    
    return `
      <div class="closure-popup-content">
        <div class="bg-red-600 text-white px-3 py-2 -m-3 mb-3 font-semibold">
          🚫 ${closureType}
        </div>
        
        <h4 class="font-bold text-sm mb-2">${event.headline}</h4>
        
        ${primaryRoad ? `
          <div class="space-y-1 text-xs">
            <div class="flex justify-between">
              <span class="text-gray-600">Road:</span>
              <span class="font-medium">${primaryRoad.name}</span>
            </div>
            
            ${primaryRoad.from && primaryRoad.to ? `
              <div class="flex justify-between">
                <span class="text-gray-600">Extent:</span>
                <span class="font-medium">${primaryRoad.from} to ${primaryRoad.to}</span>
              </div>
            ` : ''}
            
            ${primaryRoad.direction ? `
              <div class="flex justify-between">
                <span class="text-gray-600">Direction:</span>
                <span class="font-medium">${primaryRoad.direction}</span>
              </div>
            ` : ''}
            
            ${primaryRoad.lanes_closed ? `
              <div class="flex justify-between">
                <span class="text-gray-600">Lanes Closed:</span>
                <span class="font-medium text-red-600">${primaryRoad.lanes_closed}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}
        
        ${event.detour ? `
          <div class="mt-3 pt-3 border-t border-gray-200">
            <p class="text-xs font-semibold text-gray-700">Detour:</p>
            <p class="text-xs text-gray-600 mt-1">${event.detour}</p>
          </div>
        ` : ''}
        
        <div class="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
          <div class="flex justify-between">
            <span>Severity:</span>
            <span class="font-medium">${event.severity}</span>
          </div>
          <div class="flex justify-between">
            <span>Updated:</span>
            <span>${new Date(event.updated).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Create tooltip content for the closure
   */
  static createTooltipContent(event: TrafficEvent): string {
    const closureType = this.getClosureType(event);
    const primaryRoad = event.roads?.[0]?.name || 'Road';
    
    return `
      <div class="font-medium">
        ${primaryRoad} - ${closureType}
        <br/>
        <span class="text-xs">${event.severity} severity</span>
      </div>
    `;
  }
  
  /**
   * Determine closure type from event
   */
  static getClosureType(event: TrafficEvent): string {
    const hasFullClosure = event.roads?.some(road => road.state === 'CLOSED');
    const hasLanesClosed = event.roads?.some(road => 
      road.state === 'SOME_LANES_CLOSED' || road.lanes_closed
    );
    const hasSingleLane = event.roads?.some(road => 
      road.state === 'SINGLE_LANE_ALTERNATING'
    );
    
    if (hasFullClosure) {
      return 'Road Closed';
    } else if (hasSingleLane) {
      return 'Single Lane';
    } else if (hasLanesClosed) {
      const totalLanesClosed = event.roads?.reduce((sum, road) => 
        sum + (road.lanes_closed || 0), 0
      ) || 0;
      return `${totalLanesClosed} Lane${totalLanesClosed > 1 ? 's' : ''} Closed`;
    }
    
    return 'Traffic Impact';
  }
  
  /**
   * Update polyline style
   */
  static updateStyle(polyline: L.Polyline, selected: boolean = false): void {
    const eventData = (polyline as any).eventData as TrafficEvent;
    if (!eventData) return;
    
    const baseStyle = this.getClosureStyle(eventData);
    
    if (selected) {
      polyline.setStyle({
        ...baseStyle,
        weight: (baseStyle.weight || 4) + 2,
        opacity: 1,
      });
      polyline.bringToFront();
    } else {
      polyline.setStyle(baseStyle);
    }
  }
  
  /**
   * Animate polyline
   */
  static animate(polyline: L.Polyline): void {
    const element = (polyline as any)._path;
    if (!element) return;
    
    // Add animation class
    element.classList.add('closure-line-animated');
    
    // Remove animation after duration
    setTimeout(() => {
      element.classList.remove('closure-line-animated');
    }, 2000);
  }
  
  /**
   * Check if coordinates form a valid polyline
   */
  static isValidPolyline(coordinates: number[][]): boolean {
    if (!coordinates || !Array.isArray(coordinates)) return false;
    if (coordinates.length < 2) return false;
    
    return coordinates.every(coord => 
      Array.isArray(coord) && 
      coord.length >= 2 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number' &&
      Math.abs(coord[0]) <= 180 &&
      Math.abs(coord[1]) <= 90
    );
  }
}
