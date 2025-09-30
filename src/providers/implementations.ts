/**
 * @file providers/implementations.ts
 * @description Specific provider implementations for various traffic APIs
 * @version 1.0.0
 */

import { BaseDataProvider } from './DataProvider';
import { DataProviderConfig, DataProviderError } from '../types/TrafficEvent';
import {
  adaptBayArea511,
  adaptNYCDOT,
  adaptTxDOT,
  adaptGeneric
} from '../adapters';

/**
 * Bay Area 511 Provider
 */
export class BayArea511Provider extends BaseDataProvider {
  constructor(apiKey?: string) {
    const config: DataProviderConfig = {
      name: 'BayArea511',
      baseUrl: 'https://api.511.org',
      defaultParams: {
        format: 'json',
        status: 'ACTIVE'
      },
      apiKey,
      timeout: 30000,
      rateLimit: {
        maxRequests: 100,
        windowMs: 60000 // 100 requests per minute
      },
      headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : undefined
    };
    
    super(config, adaptBayArea511);
  }
  
  protected async fetchRawData(signal?: AbortSignal): Promise<unknown> {
    const url = new URL(`${this.config.baseUrl}/traffic/events`);
    
    // Add query parameters
    if (this.config.defaultParams) {
      Object.entries(this.config.defaultParams).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    
    // Add API key if configured
    if (this.config.apiKey) {
      url.searchParams.append('api_key', this.config.apiKey);
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);
    
    try {
      const response = await fetch(url.toString(), {
        signal: signal || controller.signal,
        headers: {
          'Accept': 'application/json',
          ...this.config.headers
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new DataProviderError(
          `HTTP ${response.status}: ${response.statusText}`,
          this.config.name,
          response
        );
      }
      
      const data = await response.json();
      
      // Bay Area 511 returns events in an 'events' property
      if (!data.events || !Array.isArray(data.events)) {
        throw new DataProviderError(
          'Invalid response structure: missing events array',
          this.config.name
        );
      }
      
      return data.events;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof DataProviderError) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new DataProviderError('Request timeout', this.config.name, error);
        }
        throw new DataProviderError(error.message, this.config.name, error);
      }
      
      throw new DataProviderError('Unknown error occurred', this.config.name, error);
    }
  }
}

/**
 * NYC DOT Open Data Provider
 */
export class NYCDOTProvider extends BaseDataProvider {
  constructor() {
    const config: DataProviderConfig = {
      name: 'NYCDOT',
      baseUrl: 'https://data.cityofnewyork.us/resource',
      defaultParams: {
        $limit: 1000,
        $where: "status='ACTIVE'"
      },
      timeout: 30000,
      rateLimit: {
        maxRequests: 1000,
        windowMs: 3600000 // 1000 requests per hour
      }
    };
    
    super(config, adaptNYCDOT);
  }
  
  protected async fetchRawData(signal?: AbortSignal): Promise<unknown> {
    // NYC Open Data endpoint for real-time traffic incidents
    const datasetId = 'i4gi-tjb9.json'; // Example dataset ID
    const url = new URL(`${this.config.baseUrl}/${datasetId}`);
    
    // Add query parameters
    if (this.config.defaultParams) {
      Object.entries(this.config.defaultParams).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);
    
    try {
      const response = await fetch(url.toString(), {
        signal: signal || controller.signal,
        headers: {
          'Accept': 'application/json',
          'X-App-Token': process.env.REACT_APP_NYC_APP_TOKEN || '',
          ...this.config.headers
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new DataProviderError(
          `HTTP ${response.status}: ${response.statusText}`,
          this.config.name,
          response
        );
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new DataProviderError(
          'Invalid response: expected array',
          this.config.name
        );
      }
      
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof DataProviderError) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new DataProviderError('Request timeout', this.config.name, error);
        }
        throw new DataProviderError(error.message, this.config.name, error);
      }
      
      throw new DataProviderError('Unknown error occurred', this.config.name, error);
    }
  }
}

/**
 * Texas DOT Provider
 */
export class TxDOTProvider extends BaseDataProvider {
  constructor() {
    const config: DataProviderConfig = {
      name: 'TxDOT',
      baseUrl: 'https://its.txdot.gov/ITS_WEB/FrontEnd/api',
      defaultParams: {
        format: 'json',
        activeOnly: true
      },
      timeout: 30000,
      rateLimit: {
        maxRequests: 60,
        windowMs: 60000 // 60 requests per minute
      }
    };
    
    super(config, adaptTxDOT);
  }
  
  protected async fetchRawData(signal?: AbortSignal): Promise<unknown> {
    const url = new URL(`${this.config.baseUrl}/incidents`);
    
    // Add query parameters
    if (this.config.defaultParams) {
      Object.entries(this.config.defaultParams).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);
    
    try {
      const response = await fetch(url.toString(), {
        signal: signal || controller.signal,
        headers: {
          'Accept': 'application/json',
          ...this.config.headers
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new DataProviderError(
          `HTTP ${response.status}: ${response.statusText}`,
          this.config.name,
          response
        );
      }
      
      const data = await response.json();
      
      // TxDOT might return data wrapped in a response object
      const events = data.incidents || data.data || data;
      
      if (!Array.isArray(events)) {
        throw new DataProviderError(
          'Invalid response structure: expected array of incidents',
          this.config.name
        );
      }
      
      return events;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof DataProviderError) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new DataProviderError('Request timeout', this.config.name, error);
        }
        throw new DataProviderError(error.message, this.config.name, error);
      }
      
      throw new DataProviderError('Unknown error occurred', this.config.name, error);
    }
  }
}

/**
 * Generic provider for custom APIs
 */
export class GenericProvider extends BaseDataProvider {
  constructor(
    config: DataProviderConfig,
    private endpointPath: string,
    private dataPath?: string
  ) {
    super(config, adaptGeneric);
  }
  
  protected async fetchRawData(signal?: AbortSignal): Promise<unknown> {
    const url = new URL(`${this.config.baseUrl}${this.endpointPath}`);
    
    // Add query parameters
    if (this.config.defaultParams) {
      Object.entries(this.config.defaultParams).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    
    // Add API key to headers or query params if configured
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...this.config.headers
    };
    
    if (this.config.apiKey) {
      // Try common API key header patterns
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      headers['X-API-Key'] = this.config.apiKey;
      url.searchParams.append('api_key', this.config.apiKey);
      url.searchParams.append('apikey', this.config.apiKey);
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);
    
    try {
      const response = await fetch(url.toString(), {
        signal: signal || controller.signal,
        headers
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new DataProviderError(
          `HTTP ${response.status}: ${response.statusText}`,
          this.config.name,
          response
        );
      }
      
      const data = await response.json();
      
      // Navigate to the data if a path is specified
      let result = data;
      if (this.dataPath) {
        const pathParts = this.dataPath.split('.');
        for (const part of pathParts) {
          result = result?.[part];
          if (result === undefined) {
            throw new DataProviderError(
              `Data path '${this.dataPath}' not found in response`,
              this.config.name
            );
          }
        }
      }
      
      if (!Array.isArray(result)) {
        throw new DataProviderError(
          'Expected array of events',
          this.config.name
        );
      }
      
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof DataProviderError) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new DataProviderError('Request timeout', this.config.name, error);
        }
        throw new DataProviderError(error.message, this.config.name, error);
      }
      
      throw new DataProviderError('Unknown error occurred', this.config.name, error);
    }
  }
}
