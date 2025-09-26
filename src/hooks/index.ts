/**
 * FilterPanel Component Exports
 * 
 * @module components/FilterPanel
 * @description Centralized export point for all FilterPanel components.
 * Provides filtering, API key management, and rate limiting UI components.
 * 
 * @author Senior Development Team
 * @since 1.0.0
 * @license MIT
 */

// Component Exports
export { default as FilterPanel } from './FilterPanel';
export { default as ApiKeyInput } from './ApiKeyInput';
export { default as RateLimitIndicator } from './RateLimitIndicator';

// Type Exports
export type { FilterPanelProps } from './FilterPanel';
export type { ApiKeyInputProps } from './ApiKeyInput';
export type { RateLimitIndicatorProps } from './RateLimitIndicator';

// Named Exports for Convenience
import FilterPanel from './FilterPanel';
import ApiKeyInput from './ApiKeyInput';
import RateLimitIndicator from './RateLimitIndicator';

/**
 * FilterPanel namespace containing all filter-related components
 * @namespace FilterPanel
 */
export const Filter = {
  Panel: FilterPanel,
  ApiKey: ApiKeyInput,
  RateLimit: RateLimitIndicator,
} as const;

/**
 * Composite component that combines all filter functionality
 * @returns Combined filter panel with all sub-components
 */
export const FilterControls = {
  Main: FilterPanel,
  ApiKeyInput,
  RateLimitIndicator,
} as const;

// Re-export utility types for filter handling
export interface FilterPanelComponents {
  FilterPanel: typeof FilterPanel;
  ApiKeyInput: typeof ApiKeyInput;
  RateLimitIndicator: typeof RateLimitIndicator;
}

// Configuration constants
export const FILTER_PANEL_CONFIG = {
  DEFAULT_EXPANDED: true,
  MAX_HEIGHT: '100vh',
  MIN_WIDTH: '320px',
  ANIMATION_DURATION: 300,
} as const;

// Version information
export const FILTER_PANEL_VERSION = '1.0.0' as const;
