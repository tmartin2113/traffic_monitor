/**
 * MarkerCluster Component
 * Handles clustering of map markers for better performance and visibility
 */

import L from 'leaflet';
import 'leaflet.markercluster';
import { TrafficEvent, EventSeverity } from '@types/api.types';
import { MAP_CONFIG, SEVERITY_CONFIG } from '@utils/constants';

export interface ClusterOptions {
  maxClusterRadius?: number;
  spiderfyOnMaxZoom?: boolean;
  showCoverageOnHover?: boolean;
  zoomToBoundsOnClick?: boolean;
  singleMarkerMode?: boolean;
  disableClusteringAtZoom?: number;
  animate?: boolean;
  animateAddingMarkers?: boolean;
  spiderfyDistanceMultiplier?: number;
  chunkedLoading?: boolean;
  chunkInterval?: number;
  chunkDelay?: number;
  chunkProgress?: (processed: number, total: number, elapsed: number) => void;
}

export class MarkerCluster {
  private clusterGroup: L.MarkerClusterGroup;
  private markers: Map<string, L.Marker>;
  private eventData: Map<string, TrafficEvent>;

  constructor(options: ClusterOptions = {}) {
    this.markers = new Map();
    this.eventData = new Map();

    // Create cluster group with custom options
    this.clusterGroup = L.markerClusterGroup({
      ...MAP_CONFIG.CLUSTER_OPTIONS,
      ...options,
      
      // Custom icon creation function
      iconCreateFunction: this.createClusterIcon.bind(this),
      
      // Polygon options
      polygonOptions: {
        fillColor: '#3b82f6',
        color: '#2563eb',
        weight: 2,
        opacity: 0.5,
        fillOpacity: 0.2,
      },
      
      // Spiderfy options
      spiderfyShapePositions: (count: number, centerPt: L.Point) => {
        return this.generateSpiderPositions(count, centerPt);
      },
    });
  }

  /**
   * Add a marker to the cluster
   */
  addMarker(eventId: string, marker: L.Marker, event: TrafficEvent): void {
    this.markers.set(eventId, marker);
    this.eventData.set(eventId, event);
    this.clusterGroup.addLayer(marker);
  }

  /**
   * Remove a marker from the cluster
   */
  removeMarker(eventId: string): void {
    const marker = this.markers.get(eventId);
    if (marker) {
      this.clusterGroup.removeLayer(marker);
      this.markers.delete(eventId);
      this.eventData.delete(eventId);
    }
  }

  /**
   * Update a marker in the cluster
   */
  updateMarker(eventId: string, marker: L.Marker, event: TrafficEvent): void {
    this.removeMarker(eventId);
    this.addMarker(eventId, marker, event);
  }

  /**
   * Clear all markers
   */
  clearMarkers(): void {
    this.clusterGroup.clearLayers();
    this.markers.clear();
    this.eventData.clear();
  }

  /**
   * Get the cluster group for adding to map
   */
  getClusterGroup(): L.MarkerClusterGroup {
    return this.clusterGroup;
  }

  /**
   * Create custom cluster icon based on contained events
   */
  private createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
    const childCount = cluster.getChildCount();
    const children = cluster.getAllChildMarkers();
    
    // Calculate severity statistics
    const severityCounts = this.calculateSeverityStats(children);
    const dominantSeverity = this.getDominantSeverity(severityCounts);
    
    // Determine cluster size class
    let sizeClass = 'marker-cluster-small';
    let size = 40;
    
    if (childCount > 50) {
      sizeClass = 'marker-cluster-large';
      size = 60;
    } else if (childCount > 10) {
      sizeClass = 'marker-cluster-medium';
      size = 50;
    }
    
    // Get color based on dominant severity
    const severityColor = SEVERITY_CONFIG[dominantSeverity]?.color || '#6b7280';
    
    // Create icon HTML with severity indicator
    const html = `
      <div style="background-color: ${severityColor}20; width: ${size}px; height: ${size}px;">
        <div style="background-color: ${severityColor}; width: ${size - 4}px; height: ${size - 4}px;">
          <span>${childCount}</span>
        </div>
        ${this.createSeverityIndicator(severityCounts, size)}
      </div>
    `;
    
    return L.divIcon({
      html,
      className: `marker-cluster ${sizeClass}`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  /**
   * Calculate severity statistics for a cluster
   */
  private calculateSeverityStats(markers: L.Marker[]): Record<EventSeverity, number> {
    const counts: Partial<Record<EventSeverity, number>> = {};
    
    markers.forEach(marker => {
      const eventData = (marker as any).eventData as TrafficEvent;
      if (eventData) {
        const severity = eventData.severity;
        counts[severity] = (counts[severity] || 0) + 1;
      }
    });
    
    return counts as Record<EventSeverity, number>;
  }

  /**
   * Get the dominant severity in a cluster
   */
  private getDominantSeverity(severityCounts: Record<EventSeverity, number>): EventSeverity {
    // Priority order for severity
    const priorityOrder: EventSeverity[] = [
      EventSeverity.SEVERE,
      EventSeverity.MAJOR,
      EventSeverity.MODERATE,
      EventSeverity.MINOR,
      EventSeverity.UNKNOWN,
    ];
    
    // Return the highest priority severity that exists
    for (const severity of priorityOrder) {
      if (severityCounts[severity] > 0) {
        return severity;
      }
    }
    
    return EventSeverity.UNKNOWN;
  }

  /**
   * Create severity indicator ring for cluster
   */
  private createSeverityIndicator(
    severityCounts: Record<EventSeverity, number>, 
    size: number
  ): string {
    const total = Object.values(severityCounts).reduce((sum, count) => sum + count, 0);
    if (total === 0) return '';
    
    const segments: string[] = [];
    let currentAngle = -90; // Start at top
    
    // Create segments for each severity
    const severities: EventSeverity[] = [
      EventSeverity.SEVERE,
      EventSeverity.MAJOR,
      EventSeverity.MODERATE,
      EventSeverity.MINOR,
    ];
    
    severities.forEach(severity => {
      const count = severityCounts[severity] || 0;
      if (count === 0) return;
      
      const percentage = count / total;
      const angle = percentage * 360;
      const endAngle = currentAngle + angle;
      
      const color = SEVERITY_CONFIG[severity]?.color || '#6b7280';
      
      // Create SVG arc path
      const path = this.createArcPath(
        size / 2,
        size / 2,
        size / 2 - 2,
        currentAngle,
        endAngle
      );
      
      segments.push(`
        <path d="${path}" fill="${color}" opacity="0.8" />
      `);
      
      currentAngle = endAngle;
    });
    
    if (segments.length === 0) return '';
    
    return `
      <svg style="position: absolute; top: 0; left: 0; width: ${size}px; height: ${size}px; pointer-events: none;">
        ${segments.join('')}
      </svg>
    `;
  }

  /**
   * Create SVG arc path
   */
  private createArcPath(
    cx: number, 
    cy: number, 
    radius: number, 
    startAngle: number, 
    endAngle: number
  ): string {
    const start = this.polarToCartesian(cx, cy, radius, endAngle);
    const end = this.polarToCartesian(cx, cy, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    
    return [
      'M', cx, cy,
      'L', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      'Z'
    ].join(' ');
  }

  /**
   * Convert polar coordinates to Cartesian
   */
  private polarToCartesian(
    centerX: number, 
    centerY: number, 
    radius: number, 
    angleInDegrees: number
  ): { x: number; y: number } {
    const angleInRadians = (angleInDegrees * Math.PI) / 180;
    
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  }

  /**
   * Generate custom spider positions for better visibility
   */
  private generateSpiderPositions(count: number, centerPt: L.Point): L.Point[] {
    const positions: L.Point[] = [];
    const angleStep = (Math.PI * 2) / count;
    const legLength = 25 + (count * 2); // Dynamic leg length
    
    for (let i = 0; i < count; i++) {
      const angle = angleStep * i - Math.PI / 2; // Start from top
      const x = centerPt.x + Math.cos(angle) * legLength;
      const y = centerPt.y + Math.sin(angle) * legLength;
      positions.push(new L.Point(x, y));
    }
    
    return positions;
  }

  /**
   * Refresh clusters after data change
   */
  refreshClusters(): void {
    this.clusterGroup.refreshClusters();
  }

  /**
   * Get events in a specific cluster
   */
  getClusterEvents(cluster: L.MarkerCluster): TrafficEvent[] {
    const markers = cluster.getAllChildMarkers();
    const events: TrafficEvent[] = [];
    
    markers.forEach(marker => {
      const eventData = (marker as any).eventData as TrafficEvent;
      if (eventData) {
        events.push(eventData);
      }
    });
    
    return events;
  }

  /**
   * Zoom to show a specific cluster
   */
  zoomToShowCluster(cluster: L.MarkerCluster, map: L.Map): void {
    this.clusterGroup.zoomToShowLayer(cluster, () => {
      // Optional callback after zoom
    });
  }

  /**
   * Get cluster statistics
   */
  getClusterStats(): {
    totalMarkers: number;
    totalClusters: number;
    largestCluster: number;
  } {
    let totalClusters = 0;
    let largestCluster = 0;
    
    this.clusterGroup.eachLayer((layer) => {
      if ((layer as any)._childCount) {
        totalClusters++;
        const count = (layer as any)._childCount;
        if (count > largestCluster) {
          largestCluster = count;
        }
      }
    });
    
    return {
      totalMarkers: this.markers.size,
      totalClusters,
      largestCluster,
    };
  }
}
