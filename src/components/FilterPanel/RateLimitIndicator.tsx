/**
 * @file components/FilterPanel/RateLimitIndicator.tsx
 * @description Production-ready rate limit indicator component
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Activity,
  Zap,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow, addMilliseconds } from 'date-fns';

// Service imports
import { rateLimiter } from '@services/rateLimit/RateLimiter';
import type { RateLimitInfo } from '@services/rateLimit/RateLimiter';

/**
 * Props interface for RateLimitIndicator component
 */
export interface RateLimitIndicatorProps {
  /** Optional CSS class name */
  className?: string;
  /** Display mode */
  variant?: 'full' | 'compact' | 'minimal';
  /** Update interval in milliseconds */
  updateInterval?: number;
  /** Callback when rate limit is reached */
  onLimitReached?: () => void;
  /** Callback when rate limit is approaching (80% threshold) */
  onLimitApproaching?: () => void;
  /** Whether to show detailed statistics */
  showDetails?: boolean;
}

/**
 * Rate limit status levels
 */
type RateLimitStatus = 'healthy' | 'warning' | 'critical' | 'exceeded';

/**
 * Get status based on remaining requests
 */
const getRateLimitStatus = (remaining: number, total: number): RateLimitStatus => {
  const percentage = (remaining / total) * 100;
  
  if (remaining === 0) return 'exceeded';
  if (percentage <= 10) return 'critical';
  if (percentage <= 20) return 'warning';
  return 'healthy';
};

/**
 * Status configuration
 */
const STATUS_CONFIG: Record<RateLimitStatus, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  progressColor: string;
  label: string;
}> = {
  healthy: {
    icon: CheckCircle,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    progressColor: 'bg-green-500',
    label: 'Healthy',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    progressColor: 'bg-yellow-500',
    label: 'Warning',
  },
  critical: {
    icon: AlertTriangle,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    progressColor: 'bg-orange-500',
    label: 'Critical',
  },
  exceeded: {
    icon: XCircle,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    progressColor: 'bg-red-500',
    label: 'Exceeded',
  },
};

/**
 * RateLimitIndicator Component
 * 
 * Production-ready rate limit monitoring with:
 * - Real-time rate limit status
 * - Visual progress indicators
 * - Reset countdown timer
 * - Warning thresholds
 * - Multiple display variants
 * - Detailed statistics
 * - Accessibility features
 */
export const RateLimitIndicator: React.FC<RateLimitIndicatorProps> = ({
  className,
  variant = 'full',
  updateInterval = 1000,
  onLimitReached,
  onLimitApproaching,
  showDetails = false,
}) => {
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [previousRemaining, setPreviousRemaining] = useState<number | null>(null);

  // Fetch rate limit info
  const fetchRateLimitInfo = useCallback(() => {
    try {
      const info = rateLimiter.getInfo();
      setRateLimitInfo(info);

      // Track previous remaining for trend
      if (rateLimitInfo) {
        setPreviousRemaining(rateLimitInfo.remaining);
      }

      // Trigger callbacks based on status
      if (info.remaining === 0 && onLimitReached) {
        onLimitReached();
      }

      const percentage = (info.remaining / info.total) * 100;
      if (percentage <= 20 && percentage > 0 && onLimitApproaching) {
        onLimitApproaching();
      }
    } catch (error) {
      console.error('Failed to fetch rate limit info:', error);
    }
  }, [rateLimitInfo, onLimitReached, onLimitApproaching]);

  // Update rate limit info periodically
  useEffect(() => {
    fetchRateLimitInfo();
    const interval = setInterval(fetchRateLimitInfo, updateInterval);
    return () => clearInterval(interval);
  }, [fetchRateLimitInfo, updateInterval]);

  // Calculate derived values
  const status = useMemo(() => {
    if (!rateLimitInfo) return 'healthy';
    return getRateLimitStatus(rateLimitInfo.remaining, rateLimitInfo.total);
  }, [rateLimitInfo]);

  const percentage = useMemo(() => {
    if (!rateLimitInfo) return 100;
    return Math.round((rateLimitInfo.remaining / rateLimitInfo.total) * 100);
  }, [rateLimitInfo]);

  const resetTimeFormatted = useMemo(() => {
    if (!rateLimitInfo) return null;
    try {
      const resetDate = new Date(rateLimitInfo.resetTime);
      return formatDistanceToNow(resetDate, { addSuffix: true });
    } catch {
      return null;
    }
  }, [rateLimitInfo]);

  const trend = useMemo(() => {
    if (previousRemaining === null || !rateLimitInfo) return 'stable';
    if (rateLimitInfo.remaining < previousRemaining) return 'decreasing';
    if (rateLimitInfo.remaining > previousRemaining) return 'increasing';
    return 'stable';
  }, [previousRemaining, rateLimitInfo]);

  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  // Don't render if no data
  if (!rateLimitInfo) {
    return null;
  }

  // Minimal variant - just a small badge
  if (variant === 'minimal') {
    return (
      <div className={clsx('inline-flex items-center gap-1.5 px-2 py-1 rounded-full', statusConfig.bgColor, className)}>
        <Activity className={clsx('w-3 h-3', statusConfig.color)} />
        <span className={clsx('text-xs font-medium', statusConfig.color)}>
          {rateLimitInfo.remaining}/{rateLimitInfo.total}
        </span>
      </div>
    );
  }

  // Compact variant - simple progress bar
  if (variant === 'compact') {
    return (
      <div className={clsx('space-y-2', className)}>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 font-medium">API Rate Limit</span>
          <span className={clsx('font-semibold', statusConfig.color)}>
            {rateLimitInfo.remaining}/{rateLimitInfo.total}
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={clsx('h-full transition-all duration-500', statusConfig.progressColor)}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Reset Time */}
        {resetTimeFormatted && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>Resets {resetTimeFormatted}</span>
          </div>
        )}
      </div>
    );
  }

  // Full variant - comprehensive display
  return (
    <div className={clsx('bg-white rounded-lg border', statusConfig.borderColor, className)}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className={clsx('flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center', statusConfig.bgColor)}>
            <StatusIcon className={clsx('w-5 h-5', statusConfig.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">
                API Rate Limit
              </h3>
              {trend !== 'stable' && (
                <div className="flex items-center gap-1">
                  {trend === 'decreasing' ? (
                    <TrendingDown className="w-3 h-3 text-orange-500" />
                  ) : (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              511.org API request quota
            </p>
          </div>
        </div>

        {/* Main Stats */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-gray-900">
              {rateLimitInfo.remaining}
            </span>
            <span className="text-sm text-gray-500">
              / {rateLimitInfo.total} requests remaining
            </span>
          </div>

          {/* Progress Bar */}
          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={clsx(
                'absolute inset-y-0 left-0 transition-all duration-500',
                statusConfig.progressColor
              )}
              style={{ width: `${percentage}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-700 drop-shadow">
                {percentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="mb-4">
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
            statusConfig.bgColor,
            statusConfig.color,
            'border',
            statusConfig.borderColor
          )}>
            <StatusIcon className="w-3.5 h-3.5" />
            {statusConfig.label}
          </span>
        </div>

        {/* Reset Time */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <Clock className="w-4 h-4 text-gray-400" />
          <span>
            Quota resets{' '}
            <span className="font-medium text-gray-900">
              {resetTimeFormatted}
            </span>
          </span>
        </div>

        {/* Retry After (if limited) */}
        {rateLimitInfo.retryAfter && (
          <div className={clsx(
            'flex items-start gap-2 p-3 rounded-lg mb-4',
            'bg-orange-50 border border-orange-200'
          )}>
            <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-orange-900">
                Rate limit exceeded
              </p>
              <p className="text-xs text-orange-700 mt-1">
                Please wait {Math.ceil(rateLimitInfo.retryAfter / 1000)} seconds before making another request.
              </p>
            </div>
          </div>
        )}

        {/* Warning Messages */}
        {status === 'warning' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 mb-4">
            <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              You're approaching your rate limit. Consider reducing request frequency.
            </p>
          </div>
        )}

        {status === 'critical' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200 mb-4">
            <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-orange-800">
              Critical: Very few requests remaining. Rate limit will reset soon.
            </p>
          </div>
        )}

        {/* Detailed Statistics */}
        {showDetails && (
          <div className="pt-4 border-t border-gray-200 space-y-3">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Details
            </h4>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-500 mb-1">Total Quota</div>
                <div className="font-semibold text-gray-900">
                  {rateLimitInfo.total} requests
                </div>
              </div>
              
              <div>
                <div className="text-xs text-gray-500 mb-1">Used</div>
                <div className="font-semibold text-gray-900">
                  {rateLimitInfo.total - rateLimitInfo.remaining} requests
                </div>
              </div>
              
              <div>
                <div className="text-xs text-gray-500 mb-1">Remaining</div>
                <div className="font-semibold text-gray-900">
                  {rateLimitInfo.remaining} requests
                </div>
              </div>
              
              <div>
                <div className="text-xs text-gray-500 mb-1">Usage</div>
                <div className="font-semibold text-gray-900">
                  {100 - percentage}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-start gap-2 text-xs text-gray-500">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>
              The 511.org API has a limit of {rateLimitInfo.total} requests per hour. 
              This counter updates automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RateLimitIndicator;
