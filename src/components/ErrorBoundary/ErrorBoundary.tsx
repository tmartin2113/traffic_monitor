/**
 * @file components/ErrorBoundary/ErrorBoundary.tsx
 * @description Production-ready Error Boundary with recovery
 * @version 1.0.0
 * 
 * FIXES BUG #10: Complete error boundary with fallback UI and reset
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { logger } from '@utils/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export enum ErrorType {
  NETWORK = 'NETWORK',
  RENDERING = 'RENDERING',
  DATA = 'DATA',
  UNKNOWN = 'UNKNOWN',
}

export interface ErrorMetadata {
  type: ErrorType;
  component?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  additionalData?: Record<string, any>;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: Array<string | number>;
  level?: 'app' | 'page' | 'section';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId?: NodeJS.Timeout;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError } = this.props;

    this.setState((prev) => ({
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));

    // Log error
    logger.error('ErrorBoundary caught error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Report to error tracking service
    this.reportError(error, errorInfo);

    // Call custom error handler
    onError?.(error, errorInfo);

    // Auto-reset after 10 seconds if error count is low
    if (this.state.errorCount < 3) {
      this.scheduleReset(10000);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && resetKeys?.some((key, idx) => key !== prevProps.resetKeys?.[idx])) {
      this.handleReset();
    }
  }

  componentWillUnmount(): void {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private reportError(error: Error, errorInfo: ErrorInfo): void {
    const metadata: ErrorMetadata = {
      type: this.categorizeError(error),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorCount: this.state.errorCount,
      },
    };

    // Send to Sentry/logging service in production
    if (import.meta.env.PROD && window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: { react: errorInfo },
        tags: { errorType: metadata.type },
      });
    }
  }

  private categorizeError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorType.NETWORK;
    }
    if (message.includes('render')) {
      return ErrorType.RENDERING;
    }
    if (message.includes('data') || message.includes('parse')) {
      return ErrorType.DATA;
    }
    return ErrorType.UNKNOWN;
  }

  private scheduleReset(delay: number): void {
    this.resetTimeoutId = setTimeout(() => {
      this.handleReset();
    }, delay);
  }

  private handleReset = (): void => {
    const { onReset } = this.props;

    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    onReset?.();
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { children, fallback, level = 'section' } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <ErrorFallbackUI
          error={error}
          errorInfo={errorInfo}
          errorCount={errorCount}
          level={level}
          onReset={this.handleReset}
          onReload={this.handleReload}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return children;
  }
}

// ============================================================================
// FALLBACK UI COMPONENT
// ============================================================================

interface ErrorFallbackUIProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  level: 'app' | 'page' | 'section';
  onReset: () => void;
  onReload: () => void;
  onGoHome: () => void;
}

const ErrorFallbackUI: React.FC<ErrorFallbackUIProps> = ({
  error,
  errorInfo,
  errorCount,
  level,
  onReset,
  onReload,
  onGoHome,
}) => {
  const isFullPage = level === 'app' || level === 'page';
  const isDev = import.meta.env.DEV;

  return (
    <div
      className={`flex items-center justify-center p-4 ${
        isFullPage ? 'min-h-screen bg-gray-50' : 'min-h-[400px] bg-gray-50 rounded-lg'
      }`}
    >
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Icon and Title */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {level === 'app' ? 'Application Error' : 'Something went wrong'}
              </h1>
              <p className="text-gray-600">
                {level === 'app'
                  ? 'We encountered an unexpected error. Please try reloading the page.'
                  : 'This section encountered an error. You can try again or continue using other parts of the app.'}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">{error.message}</p>
            </div>
          )}

          {/* Error Count Warning */}
          {errorCount > 1 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ This error has occurred <strong>{errorCount} times</strong>. If the
                problem persists, please contact support.
              </p>
            </div>
          )}

          {/* Development Error Details */}
          {isDev && errorInfo && (
            <details className="mb-6">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 mb-2 flex items-center gap-2">
                <Bug className="w-4 h-4" />
                Show Error Details (Development Only)
              </summary>
              <div className="p-4 bg-gray-50 rounded border border-gray-200">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Error Stack:</h3>
                  <pre className="text-xs text-red-600 overflow-auto max-h-40 font-mono">
                    {error?.stack}
                  </pre>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">
                    Component Stack:
                  </h3>
                  <pre className="text-xs text-gray-600 overflow-auto max-h-40 font-mono">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              </div>
            </details>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>

            {level === 'app' && (
              <button
                onClick={onReload}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>
            )}

            {level !== 'section' && (
              <button
                onClick={onGoHome}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            )}
          </div>

          {/* Support Link */}
          {level === 'app' && (
            <p className="mt-6 text-sm text-gray-500 text-center">
              Need help?{' '}
              <a
                href="https://github.com/yourusername/511-traffic-monitor/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-medium underline"
              >
                Report this issue
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default ErrorBoundary;

// TypeScript declarations
declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error, context?: any) => void;
    };
  }
}
