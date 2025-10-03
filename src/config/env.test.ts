/**
 * @file config/env.test.ts
 * @description Comprehensive unit tests for environment variable parsing
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Mock import.meta.env before importing the module
const mockEnv = vi.hoisted(() => ({
  VITE_511_API_KEY: 'test-api-key-12345',
  VITE_API_BASE_URL: 'https://api.511.org',
  VITE_POLL_INTERVAL: '60000',
  VITE_CACHE_TTL: '30000',
  VITE_RATE_LIMIT_MAX_REQUESTS: '60',
  VITE_MAP_DEFAULT_LAT: '37.5',
  VITE_MAP_DEFAULT_LNG: '-122.1',
  VITE_MAP_DEFAULT_ZOOM: '10',
  VITE_MAP_TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  VITE_ENABLE_WZDX: 'true',
  VITE_DEBUG: 'false',
  DEV: true,
  PROD: false,
  MODE: 'development',
}));

vi.mock('import.meta', () => ({
  env: mockEnv,
}));

describe('Environment Configuration', () => {
  describe('Environment Variable Parsing', () => {
    beforeEach(() => {
      // Reset to valid defaults before each test
      Object.assign(mockEnv, {
        VITE_511_API_KEY: 'test-api-key-12345',
        VITE_API_BASE_URL: 'https://api.511.org',
        VITE_POLL_INTERVAL: '60000',
        VITE_CACHE_TTL: '30000',
        VITE_RATE_LIMIT_MAX_REQUESTS: '60',
        VITE_MAP_DEFAULT_LAT: '37.5',
        VITE_MAP_DEFAULT_LNG: '-122.1',
        VITE_MAP_DEFAULT_ZOOM: '10',
        VITE_MAP_TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        VITE_ENABLE_WZDX: 'true',
        VITE_DEBUG: 'false',
      });
      
      // Clear module cache to force re-import
      vi.resetModules();
    });

    describe('Numeric Parsing', () => {
      it('should parse VITE_POLL_INTERVAL as number', async () => {
        mockEnv.VITE_POLL_INTERVAL = '45000';
        const { env } = await import('./env');
        
        expect(env.VITE_POLL_INTERVAL).toBe(45000);
        expect(typeof env.VITE_POLL_INTERVAL).toBe('number');
      });

      it('should parse VITE_CACHE_TTL as number', async () => {
        mockEnv.VITE_CACHE_TTL = '20000';
        const { env } = await import('./env');
        
        expect(env.VITE_CACHE_TTL).toBe(20000);
        expect(typeof env.VITE_CACHE_TTL).toBe('number');
      });

      it('should parse VITE_RATE_LIMIT_MAX_REQUESTS as number', async () => {
        mockEnv.VITE_RATE_LIMIT_MAX_REQUESTS = '100';
        const { env } = await import('./env');
        
        expect(env.VITE_RATE_LIMIT_MAX_REQUESTS).toBe(100);
        expect(typeof env.VITE_RATE_LIMIT_MAX_REQUESTS).toBe('number');
      });

      it('should parse VITE_MAP_DEFAULT_ZOOM as number', async () => {
        mockEnv.VITE_MAP_DEFAULT_ZOOM = '12';
        const { env } = await import('./env');
        
        expect(env.VITE_MAP_DEFAULT_ZOOM).toBe(12);
        expect(typeof env.VITE_MAP_DEFAULT_ZOOM).toBe('number');
      });
    });

    describe('Float Parsing', () => {
      it('should parse VITE_MAP_DEFAULT_LAT as float', async () => {
        mockEnv.VITE_MAP_DEFAULT_LAT = '37.12345';
        const { env } = await import('./env');
        
        expect(env.VITE_MAP_DEFAULT_LAT).toBeCloseTo(37.12345);
        expect(typeof env.VITE_MAP_DEFAULT_LAT).toBe('number');
      });

      it('should parse VITE_MAP_DEFAULT_LNG as float', async () => {
        mockEnv.VITE_MAP_DEFAULT_LNG = '-122.98765';
        const { env } = await import('./env');
        
        expect(env.VITE_MAP_DEFAULT_LNG).toBeCloseTo(-122.98765);
        expect(typeof env.VITE_MAP_DEFAULT_LNG).toBe('number');
      });

      it('should handle integer strings for float fields', async () => {
        mockEnv.VITE_MAP_DEFAULT_LAT = '38';
        const { env } = await import('./env');
        
        expect(env.VITE_MAP_DEFAULT_LAT).toBe(38);
      });
    });

    describe('Boolean Parsing', () => {
      it('should parse "true" as boolean true', async () => {
        mockEnv.VITE_ENABLE_WZDX = 'true';
        const { env } = await import('./env');
        
        expect(env.VITE_ENABLE_WZDX).toBe(true);
        expect(typeof env.VITE_ENABLE_WZDX).toBe('boolean');
      });

      it('should parse "false" as boolean false', async () => {
        mockEnv.VITE_DEBUG = 'false';
        const { env } = await import('./env');
        
        expect(env.VITE_DEBUG).toBe(false);
      });

      it('should parse "1" as boolean true', async () => {
        mockEnv.VITE_ENABLE_WZDX = '1';
        const { env } = await import('./env');
        
        expect(env.VITE_ENABLE_WZDX).toBe(true);
      });

      it('should parse "0" as boolean false', async () => {
        mockEnv.VITE_DEBUG = '0';
        const { env } = await import('./env');
        
        expect(env.VITE_DEBUG).toBe(false);
      });

      it('should parse "yes" as boolean true', async () => {
        mockEnv.VITE_ENABLE_WZDX = 'yes';
        const { env } = await import('./env');
        
        expect(env.VITE_ENABLE_WZDX).toBe(true);
      });

      it('should parse "no" as boolean false', async () => {
        mockEnv.VITE_DEBUG = 'no';
        const { env } = await import('./env');
        
        expect(env.VITE_DEBUG).toBe(false);
      });

      it('should handle case-insensitive boolean values', async () => {
        mockEnv.VITE_ENABLE_WZDX = 'TRUE';
        mockEnv.VITE_DEBUG = 'FALSE';
        const { env } = await import('./env');
        
        expect(env.VITE_ENABLE_WZDX).toBe(true);
        expect(env.VITE_DEBUG).toBe(false);
      });
    });

    describe('Default Values', () => {
      it('should use default for missing VITE_POLL_INTERVAL', async () => {
        delete mockEnv.VITE_POLL_INTERVAL;
        const { env } = await import('./env');
        
        expect(env.VITE_POLL_INTERVAL).toBe(60000);
      });

      it('should use default for missing VITE_CACHE_TTL', async () => {
        delete mockEnv.VITE_CACHE_TTL;
        const { env } = await import('./env');
        
        expect(env.VITE_CACHE_TTL).toBe(30000);
      });

      it('should use default for missing VITE_RATE_LIMIT_MAX_REQUESTS', async () => {
        delete mockEnv.VITE_RATE_LIMIT_MAX_REQUESTS;
        const { env } = await import('./env');
        
        expect(env.VITE_RATE_LIMIT_MAX_REQUESTS).toBe(60);
      });

      it('should use default for missing VITE_MAP_DEFAULT_LAT', async () => {
        delete mockEnv.VITE_MAP_DEFAULT_LAT;
        const { env } = await import('./env');
        
        expect(env.VITE_MAP_DEFAULT_LAT).toBe(37.5);
      });

      it('should use default for missing VITE_MAP_DEFAULT_LNG', async () => {
        delete mockEnv.VITE_MAP_DEFAULT_LNG;
        const { env } = await import('./env');
        
        expect(env.VITE_MAP_DEFAULT_LNG).toBe(-122.1);
      });

      it('should use default for missing VITE_MAP_DEFAULT_ZOOM', async () => {
        delete mockEnv.VITE_MAP_DEFAULT_ZOOM;
        const { env } = await import('./env');
        
        expect(env.VITE_MAP_DEFAULT_ZOOM).toBe(10);
      });

      it('should use default for missing VITE_ENABLE_WZDX', async () => {
        delete mockEnv.VITE_ENABLE_WZDX;
        const { env } = await import('./env');
        
        expect(env.VITE_ENABLE_WZDX).toBe(true);
      });

      it('should use default for missing VITE_DEBUG', async () => {
        delete mockEnv.VITE_DEBUG;
        const { env } = await import('./env');
        
        expect(env.VITE_DEBUG).toBe(false);
      });
    });

    describe('Validation Errors', () => {
      it('should throw EnvValidationError for missing API key', async () => {
        delete mockEnv.VITE_511_API_KEY;
        
        await expect(async () => {
          await import('./env');
        }).rejects.toThrow('Environment variable validation failed');
      });

      it('should throw for non-numeric VITE_POLL_INTERVAL', async () => {
        mockEnv.VITE_POLL_INTERVAL = 'not-a-number';
        
        await expect(async () => {
          await import('./env');
        }).rejects.toThrow();
      });

      it('should throw for VITE_POLL_INTERVAL below minimum', async () => {
        mockEnv.VITE_POLL_INTERVAL = '5000'; // Below 15000 minimum
        
        await expect(async () => {
          await import('./env');
        }).rejects.toThrow();
      });

      it('should throw for VITE_POLL_INTERVAL above maximum', async () => {
        mockEnv.VITE_POLL_INTERVAL = '500000'; // Above 300000 maximum
        
        await expect(async () => {
          await import('./env');
        }).rejects.toThrow();
      });

      it('should throw for VITE_MAP_DEFAULT_LAT out of range', async () => {
        mockEnv.VITE_MAP_DEFAULT_LAT = '95'; // Above 90 maximum
        
        await expect(async () => {
          await import('./env');
        }).rejects.toThrow();
      });

      it('should throw for VITE_MAP_DEFAULT_LNG out of range', async () => {
        mockEnv.VITE_MAP_DEFAULT_LNG = '200'; // Above 180 maximum
        
        await expect(async () => {
          await import('./env');
        }).rejects.toThrow();
      });

      it('should throw for VITE_MAP_DEFAULT_ZOOM out of range', async () => {
        mockEnv.VITE_MAP_DEFAULT_ZOOM = '25'; // Above 20 maximum
        
        await expect(async () => {
          await import('./env');
        }).rejects.toThrow();
      });

      it('should throw for invalid URL', async () => {
        mockEnv.VITE_API_BASE_URL = 'not-a-valid-url';
        
        await expect(async () => {
          await import('./env');
        }).rejects.toThrow();
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty string as missing value', async () => {
        mockEnv.VITE_POLL_INTERVAL = '';
        const { env } = await import('./env');
        
        expect(env.VITE_POLL_INTERVAL).toBe(60000); // Default
      });

      it('should handle whitespace-only string as missing', async () => {
        mockEnv.VITE_CACHE_TTL = '   ';
        
        // Whitespace strings won't parse to valid numbers
        await expect(async () => {
          await import('./env');
        }).rejects.toThrow();
      });

      it('should trim whitespace from boolean values', async () => {
        mockEnv.VITE_ENABLE_WZDX = '  true  ';
        const { env } = await import('./env');
        
        expect(env.VITE_ENABLE_WZDX).toBe(true);
      });

      it('should handle negative coordinates', async () => {
        mockEnv.VITE_MAP_DEFAULT_LAT = '-37.5';
        mockEnv.VITE_MAP_DEFAULT_LNG = '122.1';
        const { env } = await import('./env');
        
        expect(env.VITE_MAP_DEFAULT_LAT).toBe(-37.5);
        expect(env.VITE_MAP_DEFAULT_LNG).toBe(122.1);
      });
    });

    describe('Configuration Immutability', () => {
      it('should freeze the env object', async () => {
        const { env } = await import('./env');
        
        expect(Object.isFrozen(env)).toBe(true);
      });

      it('should prevent modification of env properties', async () => {
        const { env } = await import('./env');
        
        expect(() => {
          (env as any).VITE_POLL_INTERVAL = 99999;
        }).toThrow();
      });
    });
  });

  describe('Helper Functions', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    describe('isDevelopment()', () => {
      it('should return true when DEV is true', async () => {
        mockEnv.DEV = true;
        const { isDevelopment } = await import('./env');
        
        expect(isDevelopment()).toBe(true);
      });

      it('should return false when DEV is false', async () => {
        mockEnv.DEV = false;
        const { isDevelopment } = await import('./env');
        
        expect(isDevelopment()).toBe(false);
      });
    });

    describe('isProduction()', () => {
      it('should return true when PROD is true', async () => {
        mockEnv.PROD = true;
        const { isProduction } = await import('./env');
        
        expect(isProduction()).toBe(true);
      });

      it('should return false when PROD is false', async () => {
        mockEnv.PROD = false;
        const { isProduction } = await import('./env');
        
        expect(isProduction()).toBe(false);
      });
    });

    describe('getSafeEnvConfig()', () => {
      it('should redact API key', async () => {
        const { getSafeEnvConfig } = await import('./env');
        const safeConfig = getSafeEnvConfig();
        
        expect(safeConfig.VITE_511_API_KEY).toBe('[REDACTED]');
      });

      it('should include non-sensitive values', async () => {
        const { getSafeEnvConfig } = await import('./env');
        const safeConfig = getSafeEnvConfig();
        
        expect(safeConfig.VITE_POLL_INTERVAL).toBe(60000);
        expect(safeConfig.VITE_CACHE_TTL).toBe(30000);
        expect(safeConfig.VITE_MAP_DEFAULT_LAT).toBe(37.5);
      });

      it('should include mode information', async () => {
        const { getSafeEnvConfig } = await import('./env');
        const safeConfig = getSafeEnvConfig();
        
        expect(safeConfig).toHaveProperty('MODE');
        expect(safeConfig).toHaveProperty('DEV');
        expect(safeConfig).toHaveProperty('PROD');
      });

      it('should handle missing API key', async () => {
        mockEnv.VITE_511_API_KEY = '';
        
        const { getSafeEnvConfig } = await import('./env');
        const safeConfig = getSafeEnvConfig();
        
        expect(safeConfig.VITE_511_API_KEY).toBe('[NOT SET]');
      });
    });

    describe('validateAndLogEnv()', () => {
      it('should not throw for valid configuration', async () => {
        const { validateAndLogEnv } = await import('./env');
        
        expect(() => validateAndLogEnv()).not.toThrow();
      });

      it('should log debug info when VITE_DEBUG is true', async () => {
        mockEnv.VITE_DEBUG = 'true';
        const consoleSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
        
        const { validateAndLogEnv } = await import('./env');
        validateAndLogEnv();
        
        expect(consoleSpy).toHaveBeenCalledWith('🔧 Environment Configuration');
        consoleSpy.mockRestore();
      });

      it('should warn about low poll interval in production', async () => {
        mockEnv.VITE_POLL_INTERVAL = '20000';
        mockEnv.PROD = true;
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        const { validateAndLogEnv } = await import('./env');
        validateAndLogEnv();
        
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('VITE_POLL_INTERVAL is set to less than 30 seconds')
        );
        warnSpy.mockRestore();
      });
    });
  });

  describe('Type Safety', () => {
    it('should export proper TypeScript types', async () => {
      const { env } = await import('./env');
      
      // These type checks happen at compile time
      // Runtime assertions to verify the types match expectations
      expect(typeof env.VITE_POLL_INTERVAL).toBe('number');
      expect(typeof env.VITE_CACHE_TTL).toBe('number');
      expect(typeof env.VITE_MAP_DEFAULT_LAT).toBe('number');
      expect(typeof env.VITE_MAP_DEFAULT_LNG).toBe('number');
      expect(typeof env.VITE_ENABLE_WZDX).toBe('boolean');
      expect(typeof env.VITE_DEBUG).toBe('boolean');
      expect(typeof env.VITE_511_API_KEY).toBe('string');
      expect(typeof env.VITE_API_BASE_URL).toBe('string');
    });
  });
});
