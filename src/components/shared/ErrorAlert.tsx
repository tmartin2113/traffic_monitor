/**
 * ErrorAlert Component
 * Production-ready error display component with retry capabilities
 * 
 * @module src/shared/ErrorAlert
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, X, RefreshCw, ChevronDown, ChevronUp, WifiOff, Key, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

/**
 * Error severity levels for categorization
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Error type categorization for specialized handling
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  API = 'API',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Props interface for ErrorAlert component
 */
export interface ErrorAlertProps {
  /** Error object or message to display */
  error: Error | string | null;
  /** Optional error type for specialized handling */
  errorType?: ErrorType;
  /** Severity level of the error */
  severity?: ErrorSeverity;
  /** Title to display above the error message */
  title?: string;
  /** Whether the alert can be dismissed */
  dismissible?: boolean;
  /** Callback when the alert is dismissed */
  onDismiss?: () => void;
  /** Whether to show a retry button */
  showRetry?: boolean;
  /** Callback for retry action */
  onRetry?: () => Promise<void> | void;
  /** Whether to show error details (stack trace) */
  showDetails?: boolean;
  /** Custom action buttons */
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    icon?: React.ReactNode;
  }>;
  /** Auto-dismiss timeout in milliseconds */
  autoDismissMs?: number;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Enhanced error information interface
 */
interface EnhancedError {
  message: string;
  code?: string;
  statusCode?: number;
  stack?: string;
  timestamp: Date;
  context?: Record<string, any>;
}

/**
 * Utility function to parse error into enhanced format
 */
const parseError = (error: Error | string | null): EnhancedError | null => {
  if (!error) return null;

  if (typeof error === 'string') {
    return {
      message: error,
      timestamp: new Date()
    };
  }

  const enhancedError: EnhancedError = {
    message: error.message || 'An unexpected error occurred',
    timestamp: new Date(),
    stack: error.stack
  };

  // Extract additional error properties if available
  if ('code' in error) {
    enhancedError.code = (error as any).code;
  }
  if ('statusCode' in error) {
    enhancedError.statusCode = (error as any).statusCode;
  }
  if ('context' in error) {
    enhancedError.context = (error as any).context;
  }

  return enhancedError;
};

/**
 * Determine error type from error object
 */
const determineErrorType = (error: Error | string | null): ErrorType => {
  if (!error) return ErrorType.UNKNOWN;

  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorCode = typeof error === 'object' && 'code' in error ? (error as any).code : '';

  // Network errors
  if (errorMessage.toLowerCase().includes('network') || 
      errorMessage.toLowerCase().includes('fetch') ||
      errorCode === 'NETWORK_ERROR') {
    return ErrorType.NETWORK;
  }

  // API errors
  if (errorMessage.toLowerCase().includes('api') ||
      errorCode === 'UNAUTHORIZED' ||
      errorCode === 'FORBIDDEN') {
    return ErrorType.API;
  }

  // Rate limit errors
  if (errorMessage.toLowerCase().includes('rate limit') ||
      errorCode === 'RATE_LIMITED') {
    return ErrorType.RATE_LIMIT;
  }

  // Permission errors
  if (errorMessage.toLowerCase().includes('permission') ||
      errorMessage.toLowerCase().includes('unauthorized')) {
    return ErrorType.PERMISSION;
  }

  // Validation errors
  if (errorMessage.toLowerCase().includes('invalid') ||
      errorMessage.toLowerCase().includes('validation')) {
    return ErrorType.VALIDATION;
  }

  return ErrorType.UNKNOWN;
};

/**
 * Get icon component based on error type
 */
const getErrorIcon = (errorType: ErrorType, severity: ErrorSeverity): React.ReactNode => {
  const iconClass = 'w-5 h-5';
  
  switch (errorType) {
    case ErrorType.NETWORK:
      return <WifiOff className={iconClass} />;
    case ErrorType.PERMISSION:
    case ErrorType.API:
      return <Key className={iconClass} />;
    case ErrorType.RATE_LIMIT:
      return <AlertCircle className={iconClass} />;
    default:
      return severity === ErrorSeverity.WARNING 
        ? <AlertTriangle className={iconClass} />
        : <AlertCircle className={iconClass} />;
  }
};

/**
 * Get user-friendly error message based on error type
 */
const getUserFriendlyMessage = (errorType: ErrorType): string => {
  switch (errorType) {
    case ErrorType.NETWORK:
      return 'Unable to connect to the server. Please check your internet connection.';
    case ErrorType.API:
      return 'There was a problem communicating with our services. Please try again later.';
    case ErrorType.PERMISSION:
      return 'You do not have permission to perform this action.';
    case ErrorType.RATE_LIMIT:
      return 'Too many requests. Please wait a moment before trying again.';
    case ErrorType.VALIDATION:
      return 'The provided information is invalid. Please check your input and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};

/**
 * Production-ready error alert component
 */
export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  error,
  errorType,
  severity = ErrorSeverity.ERROR,
  title,
  dismissible = true,
  onDismiss,
  showRetry = false,
  onRetry,
  showDetails = false,
  actions = [],
  autoDismissMs,
  className,
  testId = 'error-alert'
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const enhancedError = parseError(error);
  const detectedErrorType = errorType || determineErrorType(error);

  // Auto-dismiss effect
  useEffect(() => {
    if (autoDismissMs && autoDismissMs > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoDismissMs);

      return () => clearTimeout(timer);
    }
  }, [autoDismissMs]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss?.();
    }, 300); // Allow animation to complete
  }, [onDismiss]);

  const handleRetry = useCallback(async () => {
    if (!onRetry) return;

    setIsRetrying(true);
    try {
      await onRetry();
      handleDismiss();
    } catch (retryError) {
      console.error('Retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry, handleDismiss]);

  const toggleDetails = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  if (!enhancedError || !isVisible) return null;

  const severityStyles = {
    [ErrorSeverity.INFO]: {
      container: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-600',
      text: 'text-blue-800',
      button: 'text-blue-600 hover:bg-blue-100'
    },
    [ErrorSeverity.WARNING]: {
      container: 'bg-yellow-50 border-yellow-200',
      icon: 'text-yellow-600',
      text: 'text-yellow-800',
      button: 'text-yellow-600 hover:bg-yellow-100'
    },
    [ErrorSeverity.ERROR]: {
      container: 'bg-red-50 border-red-200',
      icon: 'text-red-600',
      text: 'text-red-800',
      button: 'text-red-600 hover:bg-red-100'
    },
    [ErrorSeverity.CRITICAL]: {
      container: 'bg-red-100 border-red-300',
      icon: 'text-red-700',
      text: 'text-red-900',
      button: 'text-red-700 hover:bg-red-200'
    }
  };

  const styles = severityStyles[severity];
  const userFriendlyMessage = getUserFriendlyMessage(detectedErrorType);

  return (
    <div
      data-testid={testId}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={clsx(
        'relative rounded-lg border p-4 transition-all duration-300',
        styles.container,
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
        className
      )}
    >
      <div className="flex">
        {/* Icon */}
        <div className={clsx('flex-shrink-0', styles.icon)}>
          {getErrorIcon(detectedErrorType, severity)}
        </div>

        {/* Content */}
        <div className="flex-1 ml-3">
          {/* Title */}
          {title && (
            <h3 className={clsx('text-sm font-semibold mb-1', styles.text)}>
              {title}
            </h3>
          )}

          {/* Message */}
          <div className={clsx('text-sm', styles.text)}>
            <p>{enhancedError.message}</p>
            {detectedErrorType !== ErrorType.UNKNOWN && (
              <p className="mt-1 text-xs opacity-90">{userFriendlyMessage}</p>
            )}
          </div>

          {/* Error Code/Status */}
          {(enhancedError.code || enhancedError.statusCode) && (
            <div className={clsx('mt-2 text-xs', styles.text, 'opacity-75')}>
              {enhancedError.code && <span>Error Code: {enhancedError.code}</span>}
              {enhancedError.statusCode && (
                <span className="ml-3">Status: {enhancedError.statusCode}</span>
              )}
            </div>
          )}

          {/* Expandable Details */}
          {showDetails && enhancedError.stack && (
            <div className="mt-3">
              <button
                onClick={toggleDetails}
                className={clsx(
                  'inline-flex items-center text-xs font-medium transition-colors',
                  styles.button,
                  'px-2 py-1 rounded'
                )}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Show Details
                  </>
                )}
              </button>

              {isExpanded && (
                <pre className={clsx(
                  'mt-2 p-3 text-xs rounded bg-gray-900 text-gray-100',
                  'overflow-x-auto max-h-40 overflow-y-auto font-mono'
                )}>
                  {enhancedError.stack}
                </pre>
              )}
            </div>
          )}

          {/* Actions */}
          {(showRetry || actions.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {showRetry && onRetry && (
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className={clsx(
                    'inline-flex items-center px-3 py-1.5 text-xs font-medium',
                    'rounded-md transition-colors',
                    styles.button,
                    isRetrying && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <RefreshCw className={clsx('w-3 h-3 mr-1.5', isRetrying && 'animate-spin')} />
                  {isRetrying ? 'Retrying...' : 'Retry'}
                </button>
              )}

              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={clsx(
                    'inline-flex items-center px-3 py-1.5 text-xs font-medium',
                    'rounded-md transition-colors',
                    action.variant === 'primary'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : action.variant === 'danger'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : styles.button
                  )}
                >
                  {action.icon && <span className="mr-1.5">{action.icon}</span>}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        {dismissible && (
          <button
            onClick={handleDismiss}
            className={clsx(
              'flex-shrink-0 ml-4 p-1 rounded-md transition-colors',
              styles.button
            )}
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorAlert;
