/**
 * @file adapters/__tests__/adapters.test.ts
 * @description Comprehensive test suite for traffic data adapters
 * @version 1.0.0
 */

import {
  adaptBayArea511,
  adaptNYCDOT,
  adaptTxDOT,
  adaptGeneric
} from '../adapters';
import {
  TrafficEvent,
  EventType,
  EventSeverity,
  DataProviderError
} from '../../types/TrafficEvent';

describe('Traffic Data Adapters', () => {
  
  describe('adaptBayArea511', () => {
    
    it('should successfully adapt valid Bay Area 511 data', () => {
      const rawData = {
        id: 'BA511-001',
        headline: 'Multi-vehicle accident on I-880',
        event_type: 'ACCIDENT',
        severity: 'Major',
        geography: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        },
        description: 'Multi-vehicle collision blocking lanes',
        direction: 'Northbound',
        updated: '2024-01-15T10:30:00Z',
        roads: [
          { name: 'I-880' },
          { name: 'US-101' }
        ],
        schedules: [
          {
            start_date: '2024-01-15T10:00:00Z',
            end_date: '2024-01-15T14:00:00Z'
          }
        ],
        lanes_affected: 2
      };
      
      const result = adaptBayArea511(rawData);
      
      expect(result).toMatchObject({
        id: 'BA511-001',
        headline: 'Multi-vehicle accident on I-880',
        eventType: EventType.ACCIDENT,
        severity: EventSeverity.MAJOR,
        geometry: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        },
        source: 'BayArea511',
        description: 'Multi-vehicle collision blocking lanes',
        direction: 'Northbound',
        roads: ['I-880', 'US-101'],
        startTime: '2024-01-15T10:00:00.000Z',
        endTime: '2024-01-15T14:00:00.000Z',
        lanesAffected: 2
      });
    });
    
    it('should use closure_geography when available', () => {
      const rawData = {
        id: 'BA511-002',
        headline: 'Road closure',
        event_type: 'CLOSURE',
        closure_geography: {
          type: 'LineString',
          coordinates: [[-122.4, 37.7], [-122.5, 37.8]]
        },
        geography: {
          type: 'Point',
          coordinates: [-122.45, 37.75]
        }
      };
      
      const result = adaptBayArea511(rawData);
      
      expect(result.geometry).toEqual({
        type: 'LineString',
        coordinates: [[-122.4, 37.7], [-122.5, 37.8]]
      });
    });
    
    it('should handle missing optional fields gracefully', () => {
      const rawData = {
        id: 'BA511-003',
        headline: 'Traffic incident',
        event_type: 'HAZARD',
        geography: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        }
      };
      
      const result = adaptBayArea511(rawData);
      
      expect(result.id).toBe('BA511-003');
      expect(result.roads).toBeUndefined();
      expect(result.startTime).toBeUndefined();
      expect(result.endTime).toBeUndefined();
      expect(result.lanesAffected).toBeUndefined();
      expect(result.severity).toBe(EventSeverity.UNKNOWN);
    });
    
    it('should throw DataProviderError for invalid data', () => {
      expect(() => adaptBayArea511(null)).toThrow(DataProviderError);
      expect(() => adaptBayArea511({})).toThrow(DataProviderError);
      expect(() => adaptBayArea511({ id: 'test' })).toThrow(DataProviderError);
      expect(() => adaptBayArea511({ 
        id: 'test', 
        headline: 'Test',
        geography: 'invalid' 
      })).toThrow(DataProviderError);
    });
    
    it('should map various event types correctly', () => {
      const testCases = [
        { input: 'ACCIDENT', expected: EventType.ACCIDENT },
        { input: 'CONSTRUCTION', expected: EventType.CONSTRUCTION },
        { input: 'ROAD_CLOSURE', expected: EventType.ROAD_CLOSURE },
        { input: 'SPECIAL_EVENT', expected: EventType.SPECIAL_EVENT },
        { input: 'WEATHER', expected: EventType.WEATHER },
        { input: 'UNKNOWN_TYPE', expected: EventType.OTHER }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const rawData = {
          id: 'test',
          headline: 'Test',
          event_type: input,
          geography: { type: 'Point', coordinates: [0, 0] }
        };
        
        const result = adaptBayArea511(rawData);
        expect(result.eventType).toBe(expected);
      });
    });
    
    it('should map various severity levels correctly', () => {
      const testCases = [
        { input: 'Critical', expected: EventSeverity.CRITICAL },
        { input: 'Major', expected: EventSeverity.MAJOR },
        { input: 'Moderate', expected: EventSeverity.MODERATE },
        { input: 'Minor', expected: EventSeverity.MINOR },
        { input: undefined, expected: EventSeverity.UNKNOWN }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const rawData = {
          id: 'test',
          headline: 'Test',
          event_type: 'ACCIDENT',
          severity: input,
          geography: { type: 'Point', coordinates: [0, 0] }
        };
        
        const result = adaptBayArea511(rawData);
        expect(result.severity).toBe(expected);
      });
    });
  });
  
  describe('adaptNYCDOT', () => {
    
    it('should successfully adapt valid NYC DOT data', () => {
      const rawData = {
        event_id: 'NYC-001',
        description: 'Accident on FDR Drive',
        category: 'Collision',
        impact: 'High',
        geometry: {
          type: 'Point',
          coordinates: [-74.006, 40.7128]
        },
        full_description: 'Multi-vehicle accident causing significant delays',
        direction_affected: 'Southbound',
        road_name: 'FDR Drive',
        start_datetime: '2024-01-15T08:00:00',
        end_datetime: '2024-01-15T12:00:00',
        last_updated: '2024-01-15T08:30:00',
        borough: 'Manhattan'
      };
      
      const result = adaptNYCDOT(rawData);
      
      expect(result).toMatchObject({
        id: 'NYC-001',
        headline: 'Accident on FDR Drive',
        eventType: EventType.ACCIDENT,
        severity: EventSeverity.MAJOR,
        geometry: {
          type: 'Point',
          coordinates: [-74.006, 40.7128]
        },
        source: 'NYCDOT',
        description: 'Multi-vehicle accident causing significant delays',
        direction: 'Southbound',
        roads: ['FDR Drive'],
        metadata: { borough: 'Manhattan' }
      });
    });
    
    it('should handle array of affected roads', () => {
      const rawData = {
        event_id: 'NYC-002',
        description: 'Construction',
        geometry: { type: 'Point', coordinates: [0, 0] },
        affected_roads: ['Broadway', 'Times Square', '7th Avenue']
      };
      
      const result = adaptNYCDOT(rawData);
      
      expect(result.roads).toEqual(['Broadway', 'Times Square', '7th Avenue']);
    });
    
    it('should throw DataProviderError for missing event_id', () => {
      const rawData = {
        description: 'Test',
        geometry: { type: 'Point', coordinates: [0, 0] }
      };
      
      expect(() => adaptNYCDOT(rawData)).toThrow(DataProviderError);
    });
  });
  
  describe('adaptTxDOT', () => {
    
    it('should successfully adapt valid TxDOT data', () => {
      const rawData = {
        incident_id: 'TX-001',
        incident_description: 'Major accident on I-35',
        incident_type: 'Crash',
        severity_level: 'Severe',
        latitude: '30.2672',
        longitude: '-97.7431',
        full_description: 'Multi-vehicle crash with injuries',
        direction: 'Northbound',
        highway: 'I-35',
        county: 'Travis',
        lanes_blocked: '3',
        start_time: '2024-01-15T07:00:00',
        estimated_end_time: '2024-01-15T11:00:00',
        last_updated: '2024-01-15T07:30:00'
      };
      
      const result = adaptTxDOT(rawData);
      
      expect(result).toMatchObject({
        id: 'TX-001',
        headline: 'Major accident on I-35',
        eventType: EventType.ACCIDENT,
        severity: EventSeverity.CRITICAL,
        geometry: {
          type: 'Point',
          coordinates: [-97.7431, 30.2672]
        },
        source: 'TxDOT',
        roads: ['I-35'],
        lanesAffected: 3,
        metadata: { county: 'Travis' }
      });
    });
    
    it('should handle geometry object if provided', () => {
      const rawData = {
        id: 'TX-002',
        description: 'Road work',
        type: 'Construction',
        geometry: {
          type: 'LineString',
          coordinates: [[-97.7, 30.2], [-97.8, 30.3]]
        }
      };
      
      const result = adaptTxDOT(rawData);
      
      expect(result.geometry).toEqual({
        type: 'LineString',
        coordinates: [[-97.7, 30.2], [-97.8, 30.3]]
      });
    });
    
    it('should throw DataProviderError when no valid geometry data', () => {
      const rawData = {
        incident_id: 'TX-003',
        description: 'Test'
      };
      
      expect(() => adaptTxDOT(rawData)).toThrow(DataProviderError);
      expect(() => adaptTxDOT(rawData)).toThrow('No valid geometry data found');
    });
  });
  
  describe('adaptGeneric', () => {
    
    it('should adapt data with common field patterns', () => {
      const rawData = {
        uuid: 'GEN-001',
        title: 'Traffic congestion on Main St',
        type: 'Congestion',
        severity: 'Medium',
        location: {
          type: 'Point',
          coordinates: [-100, 35]
        },
        details: 'Heavy traffic due to rush hour',
        start_time: '2024-01-15T17:00:00',
        end_time: '2024-01-15T19:00:00',
        last_updated: '2024-01-15T17:15:00',
        street: 'Main Street'
      };
      
      const result = adaptGeneric(rawData);
      
      expect(result).toMatchObject({
        id: 'GEN-001',
        headline: 'Traffic congestion on Main St',
        eventType: EventType.TRAFFIC_CONGESTION,
        severity: EventSeverity.MODERATE,
        geometry: {
          type: 'Point',
          coordinates: [-100, 35]
        },
        source: 'Generic',
        description: 'Heavy traffic due to rush hour',
        roads: ['Main Street']
      });
    });
    
    it('should handle various coordinate formats', () => {
      const testCases = [
        {
          input: { coordinates: [-100, 35] },
          expected: { type: 'Point', coordinates: [-100, 35] }
        },
        {
          input: { lat: '35', lon: '-100' },
          expected: { type: 'Point', coordinates: [-100, 35] }
        },
        {
          input: { latitude: 35, longitude: -100 },
          expected: { type: 'Point', coordinates: [-100, 35] }
        }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const rawData = {
          id: 'test',
          headline: 'Test',
          ...input
        };
        
        const result = adaptGeneric(rawData);
        expect(result.geometry).toEqual(expected);
      });
    });
    
    it('should find ID from various field names', () => {
      const testCases = [
        { id: 'TEST-1' },
        { event_id: 'TEST-2' },
        { incident_id: 'TEST-3' },
        { ID: 'TEST-4' },
        { eventId: 'TEST-5' },
        { uuid: 'TEST-6' },
        { guid: 'TEST-7' }
      ];
      
      testCases.forEach((rawData, index) => {
        const data = {
          ...rawData,
          headline: 'Test',
          geometry: { type: 'Point', coordinates: [0, 0] }
        };
        
        const result = adaptGeneric(data);
        expect(result.id).toBe(`TEST-${index + 1}`);
      });
    });
    
    it('should throw DataProviderError when no ID field found', () => {
      const rawData = {
        headline: 'Test',
        geometry: { type: 'Point', coordinates: [0, 0] }
      };
      
      expect(() => adaptGeneric(rawData)).toThrow(DataProviderError);
      expect(() => adaptGeneric(rawData)).toThrow('Could not find identifier field');
    });
    
    it('should throw DataProviderError when no valid geometry found', () => {
      const rawData = {
        id: 'test',
        headline: 'Test'
      };
      
      expect(() => adaptGeneric(rawData)).toThrow(DataProviderError);
      expect(() => adaptGeneric(rawData)).toThrow('Could not find valid geometry data');
    });
  });
  
  describe('Edge Cases and Error Handling', () => {
    
    it('should handle null and undefined values gracefully', () => {
      const rawData = {
        id: 'EDGE-001',
        headline: null,
        event_type: undefined,
        geography: { type: 'Point', coordinates: [0, 0] },
        roads: [null, undefined, { name: 'Valid Road' }, { invalid: 'structure' }]
      };
      
      const result = adaptBayArea511(rawData);
      
      expect(result.headline).toBe('Traffic Incident');
      expect(result.eventType).toBe(EventType.OTHER);
      expect(result.roads).toEqual(['Valid Road']);
    });
    
    it('should handle malformed date strings', () => {
      const rawData = {
        id: 'EDGE-002',
        headline: 'Test',
        geography: { type: 'Point', coordinates: [0, 0] },
        updated: 'not-a-date',
        schedules: [{
          start_date: 'invalid',
          end_date: '2024-01-15T10:00:00Z'
        }]
      };
      
      const result = adaptBayArea511(rawData);
      
      expect(result.updated).toBeUndefined();
      expect(result.startTime).toBeUndefined();
      expect(result.endTime).toBe('2024-01-15T10:00:00.000Z');
    });
    
    it('should include raw data when not stripped', () => {
      const rawData = {
        id: 'RAW-001',
        headline: 'Test',
        event_type: 'ACCIDENT',
        geography: { type: 'Point', coordinates: [0, 0] },
        extra_field: 'extra_value'
      };
      
      const result = adaptBayArea511(rawData);
      
      expect(result.rawData).toEqual(rawData);
      expect(result.rawData?.extra_field).toBe('extra_value');
    });
  });
});
