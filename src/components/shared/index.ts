/**
 * Shared Components
 * Common UI components used throughout the application
 */

import React from 'react';
import { AlertCircle, Loader2, X, RefreshCw, Info, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';

// ============ LoadingSpinner Component ============
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message,
  className,
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={clsx('flex flex-col items-center justify-center', className)}>
      <Loader2 className={clsx('animate-spin text-blue-600', sizeClasses[size])} />
      {message && (
        <p className="mt-2 text-sm text-gray-600">{message}</p>
      )}
    </div>
  );
};

// ============ ErrorAlert Component ============
interface ErrorAlertProps {
  message: string;
  details?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  type?: 'error' | 'warning' | 'info' | 'success';
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  details,
  onRetry,
  onDismiss,
  className,
  type = 'error',
}) => {
  const typeConfig = {
    error: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      detailsColor: 'text-red-700',
      icon: XCircle,
      iconColor: 'text-red-400',
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      detailsColor: 'text-yellow-700',
      icon: AlertCircle,
      iconColor: 'text-yellow-400',
    },
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      detailsColor: 'text-blue-700',
      icon: Info,
      iconColor: 'text-blue-400',
    },
    success: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      detailsColor: 'text-green-700',
      icon: CheckCircle,
      iconColor: 'text-green-400',
    },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        'rounded-lg border p-4',
        config.bgColor,
        config.borderColor,
        className
      )}
      role="alert"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={clsx('h-5 w-5', config.iconColor)} />
        </div>
        <div className="ml-3 flex-1">
          <p className={clsx('text-sm font-medium', config.textColor)}>
            {message}
          </p>
          {details && (
            <p className={clsx('mt-1 text-sm', config.detailsColor)}>
              {details}
            </p>
          )}
          {(onRetry || onDismiss) && (
            <div className="mt-3 flex space-x-2">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className={clsx(
                    'inline-flex items-center space-x-1 text-sm font-medium',
                    config.textColor,
                    'hover:underline'
                  )}
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry</span>
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className={clsx(
                    'inline-flex items-center space-x-1 text-sm font-medium',
                    config.textColor,
                    'hover:underline'
                  )}
                >
                  <X className="h-3 w-3" />
                  <span>Dismiss</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ Badge Component ============
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
}) => {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-800',
    primary: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-base',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
};

// ============ Card Component ============
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className, onClick }) => {
  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow-sm border border-gray-200',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className }) => {
  return (
    <div className={clsx('px-6 py-4 border-b border-gray-200', className)}>
      {children}
    </div>
  );
};

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({ children, className }) => {
  return (
    <div className={clsx('px-6 py-4', className)}>
      {children}
    </div>
  );
};

// ============ Skeleton Component ============
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'text',
  width,
  height,
}) => {
  const variantClasses = {
    text: 'rounded',
    rectangular: 'rounded-md',
    circular: 'rounded-full',
  };

  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1em' : '100%'),
  };

  return (
    <div
      className={clsx(
        'animate-pulse bg-gray-200',
        variantClasses[variant],
        className
      )}
      style={style}
    />
  );
};

// ============ Progress Component ============
interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  className,
  showLabel = false,
  variant = 'default',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const variantClasses = {
    default: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    danger: 'bg-red-600',
  };

  return (
    <div className={clsx('relative', className)}>
      <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
        <div
          style={{ width: `${percentage}%` }}
          className={clsx(
            'shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-300',
            variantClasses[variant]
          )}
        />
      </div>
      {showLabel && (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
};

// ============ EmptyState Component ============
interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Info,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div className={clsx('text-center py-12', className)}>
      <Icon className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
};

// Export all components
export default {
  LoadingSpinner,
  ErrorAlert,
  Badge,
  Card,
  CardHeader,
  CardContent,
  Skeleton,
  Progress,
  EmptyState,
};
