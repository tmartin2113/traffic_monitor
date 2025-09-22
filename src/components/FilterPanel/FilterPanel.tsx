/**
 * FilterPanel Component
 * Control panel for filtering traffic events
 */

import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, RefreshCw, Filter, X, Map, Settings } from 'lucide-react';
import { ApiKeyInput } from './ApiKeyInput';
import { RateLimitIndicator } from './RateLimitIndicator';
import { EventType, EventSeverity } from '@types/api.types';
import { FilterState, FILTER_PRESETS } from '@types/filter.types';
import { EVENT_TYPE_CONFIG, SEVERITY_CONFIG } from '@utils/constants';
import clsx from 'clsx';

interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  apiKey: string | null;
  onApiKeySubmit: (key: string) => void;
  rateLimitInfo: {
    remaining: number;
    total: number;
    resetTime: number | null;
  } | null;
  eventCounts: {
    total: number;
    filtered: number;
    closures: number;
  };
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
  apiKey,
  onApiKeySubmit,
  rateLimitInfo,
  eventCounts,
  isCollapsed = false,
  onToggleCollapse,
  onRefresh,
  isRefreshing = false,
}) => {
  const [expandedSections, setExpandedSections] = useState({
    filters: true,
    presets: false,
    settings: false,
  });

  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const applyPreset = useCallback((presetFilters: Partial<FilterState>) => {
    onFilterChange(presetFilters);
  }, [onFilterChange]);

  const clearFilters = useCallback(() => {
    onFilterChange({
      eventType: '',
      severity: '',
      closuresOnly: false,
      activeOnly: true,
      searchTerm: '',
      includeWzdx: false,
    });
  }, [onFilterChange]);

  const hasActiveFilters = filters.eventType || filters.severity || filters.closuresOnly || filters.searchTerm;

  if (isCollapsed) {
    return (
      <div className="absolute top-4 left-4 z-[1000]">
        <button
          onClick={onToggleCollapse}
          className="bg-white rounded-lg shadow-xl p-3 hover:bg-gray-50 transition-colors"
          aria-label="Expand filter panel"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-xl w-80 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Map className="w-5 h-5" />
            <h2 className="text-lg font-bold">Traffic Monitor</h2>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={onRefresh}
              className={clsx(
                "p-1.5 rounded hover:bg-white/20 transition-colors",
                isRefreshing && "animate-spin"
              )}
              aria-label="Refresh events"
              disabled={isRefreshing}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded hover:bg-white/20 transition-colors"
              aria-label="Collapse panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Event counts */}
        <div className="flex items-center justify-between text-xs text-blue-100">
          <span>{eventCounts.filtered} of {eventCounts.total} events</span>
          <span>{eventCounts.closures} closures</span>
        </div>
      </div>

      {/* API Key Section */}
      {!apiKey && (
        <div className="p-4 bg-yellow-50 border-b border-yellow-200">
          <ApiKeyInput onSubmit={onApiKeySubmit} compact />
        </div>
      )}

      {/* Rate Limit Indicator */}
      {apiKey && rateLimitInfo && (
        <div className="px-4 py-2 bg-gray-50 border-b">
          <RateLimitIndicator {...rateLimitInfo} />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Search */}
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Search events..."
            value={filters.searchTerm || ''}
            onChange={(e) => onFilterChange({ searchTerm: e.target.value })}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* Filter Section */}
        <div className="border-b">
          <button
            onClick={() => toggleSection('filters')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <span className="font-medium">Filters</span>
              {hasActiveFilters && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
            {expandedSections.filters ? (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
          </button>
          
          {expandedSections.filters && (
            <div className="px-4 pb-4 space-y-3">
              {/* Event Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Type
                </label>
                <select
                  value={filters.eventType}
                  onChange={(e) => onFilterChange({ eventType: e.target.value as EventType | '' })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">All Types</option>
                  {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.icon} {config.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Severity Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Severity
                </label>
                <select
                  value={filters.severity}
                  onChange={(e) => onFilterChange({ severity: e.target.value as EventSeverity | '' })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">All Severities</option>
                  {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggle Filters */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.closuresOnly}
                    onChange={(e) => onFilterChange({ closuresOnly: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Road Closures Only</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.activeOnly}
                    onChange={(e) => onFilterChange({ activeOnly: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Active Events Only</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.includeWzdx}
                    onChange={(e) => onFilterChange({ includeWzdx: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Include Work Zones</span>
                </label>
              </div>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Preset Filters Section */}
        <div className="border-b">
          <button
            onClick={() => toggleSection('presets')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4 text-gray-600" />
              <span className="font-medium">Quick Presets</span>
            </div>
            {expandedSections.presets ? (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
          </button>
          
          {expandedSections.presets && (
            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-2">
                {FILTER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset.filters)}
                    className="px-3 py-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors text-xs font-medium text-gray-700 flex flex-col items-center space-y-1"
                  >
                    <span className="text-lg">{preset.icon}</span>
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={clsx(
              "w-2 h-2 rounded-full",
              isRefreshing ? "bg-yellow-500 animate-pulse" : "bg-green-500"
            )} />
            <span className="text-xs text-gray-600">
              {isRefreshing ? 'Updating...' : 'Live'}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            Updates every 60s
          </span>
        </div>
      </div>
    </div>
  );
};
