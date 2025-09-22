/**
 * RateLimitIndicator Component
 * Displays API rate limit status and information
 */

import React, { useMemo } from 'react';
import { Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Progress } from '@components/shared';
import clsx from 'clsx';

interface RateLimitIndicatorProps {
  remaining: number;
  total: number;
  resetTime: number | null;
  compact?: boolean;
}

export const RateLimitIndicator: React.FC<RateLimitIndicatorProps> = ({
  remaining,
  total,
  resetTime,
  compact = false,
}) => {
  const percentage = (remaining / total) * 100;
  
  const status = useMemo(() => {
    if (percentage > 50) return 'healthy';
    if (percentage > 20) return 'warning';
    return 'critical';
  }, [percentage]);

  const formatResetTime = (time: number | null): string => {
    if (!time) return 'Unknown';
    
    const now = Date.now();
    const diff = time - now;
    
    if (diff <= 0) return 'Resetting...';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const StatusIcon = useMemo(() => {
    switch (status) {
      case 'healthy':
        return CheckCircle;
      case 'warning':
        return AlertTriangle;
      case 'critical':
        return XCircle;
      default:
        return Clock;
    }
  }, [status]);

  const statusColor = useMemo(() => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  }, [status]);

  const progressVariant = useMemo(() => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'danger';
      default:
        return 'default';
    }
  }, [status]) as 'default' | 'success' | 'warning' | 'danger';

  if (compact) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <StatusIcon className={clsx('w-4 h-4', statusColor)} />
          <span className="text-xs text-gray-600">
            API Requests: <span className="font-medium">{remaining}/{total}</span>
          </span>
        </div>
        {resetTime && remaining < total && (
          <span className="text-xs text-gray-500">
            Resets in {formatResetTime(resetTime)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <StatusIcon className={clsx('w-5 h-5', statusColor)} />
          <span className="text-sm font-medium text-gray-700">API Rate Limit</span>
        </div>
        <span className="text-sm text-gray-600">
          {remaining} / {total}
        </span>
      </div>
      
      <Progress
        value={remaining}
        max={total}
        variant={progressVariant}
        showLabel={false}
      />
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {percentage.toFixed(0)}% remaining
        </span>
        {resetTime && remaining < total && (
          <span>
            Resets in {formatResetTime(resetTime)}
          </span>
        )}
      </div>
      
      {status === 'critical' && (
        <div className="mt-2 p-2 bg-red-50 rounded-md">
          <p className="text-xs text-red-700 flex items-start">
            <AlertTriangle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
            API rate limit is low. Updates may be delayed until the limit resets.
          </p>
        </div>
      )}
      
      {status === 'warning' && (
        <div className="mt-2 p-2 bg-yellow-50 rounded-md">
          <p className="text-xs text-yellow-700 flex items-start">
            <AlertTriangle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
            Approaching API rate limit. Consider reducing update frequency.
          </p>
        </div>
      )}
    </div>
  );
};

export default RateLimitIndicator;
