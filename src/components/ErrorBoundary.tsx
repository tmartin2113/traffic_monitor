/**
 * @file components/ErrorBoundary.tsx
 * @description Production-ready error boundary with monitoring integration
 * @version 1.0.0
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { envConfig } from '../config/environment';

/**
 * Error types for categorization
 */
export enum ErrorType {
  NETWORK = 'network',
  ADAPTER = 'adapter',
  RENDERING = 'rendering',
  PROVIDER = 'provider',
  UNKNOWN = 'unknown'
}

/**
 * Error metadata for tracking
 */
interface ErrorMetadata {
  type: ErrorType;
  provider?: string;
  metro?: string;
  component?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  additionalData?: Record<string, any>;
}

/**
 * Error reporting service
 */
class ErrorReportingService {
  private errorQueue: Array<{ error: Error; metadata: ErrorMetadata }> = [];
  private isInitialized = false;
  private reportingInterval?: NodeJS.Timeout;
  
  constructor() {
    this.initialize();
  }
  
  /**
   * Initialize error reporting services
   */
  private initialize(): void {
    const config = envConfig.getConfig();
    
    if (config.FEATURES.ENABLE_ERROR_REPORTING) {
      // Initialize Sentry
      if (config.MONITORING.SENTRY_DSN) {
        this.initializeSentry(config.MONITORING.SENTRY_DSN);
      }
      
      // Initialize other monitoring services
      if (config.MONITORING.DATADOG_CLIENT_TOKEN) {
        this.initializeDatadog(config.MONITORING.DATADOG_CLIENT_TOKEN);
      }
      
      // Start batch reporting
      this.reportingInterval = setInterval(() => {
        this.flushErrorQueue();
      }, 30000); // Flush every 30 seconds
      
      this.isInitialized = true;
    }
    
    // Global error handler
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }
  
  /**
   * Initialize Sentry
   */
  private initializeSentry(dsn: string): void {
    // Dynamic import to avoid loading in development
    if (envConfig.isProduction()) {
      import('@sentry/react').then(Sentry => {
        Sentry.init({
          dsn,
          environment: envConfig.getConfig().APP.ENVIRONMENT,
          release: envConfig.getConfig().APP.VERSION,
          tracesSampleRate: 0.1,
          beforeSend: (event, hint) => {
            // Sanitize sensitive data
            if (event.request) {
              delete event.request.cookies;
              delete event.request.headers;
            }
            return event;
          }
        });
      });
    }
  }
  
  /**
   * Initialize Datadog
   */
  private initializeDatadog(clientToken: string): void {
    // Datadog RUM initialization would go here
    console.log('Datadog initialized with token:', clientToken.substring(0, 10) + '...');
  }
  
  /**
   * Handle unhandled promise rejections
   */
  private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    this.reportError(
      new Error(`Unhandled Promise Rejection: ${event.reason}`),
      {
        type: ErrorType.UNKNOWN,
        component: 'global',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    );
  };
  
  /**
   * Report an error
   */
  reportError(error: Error, metadata: ErrorMetadata): void {
    // Add to queue
    this.errorQueue.push({ error, metadata });
    
    // Log in development
    if (envConfig.isDevelopment()) {
      console.error('Error reported:', error, metadata);
    }
    
    // Report immediately if critical
    if (this.isCriticalError(error, metadata)) {
      this.flushErrorQueue();
    }
    
    // Send to console in all environments
    console.error(`[${metadata.type.toUpperCase()}] ${error.message}`, {
      error,
      metadata
    });
  }
  
  /**
   * Determine if error is critical
   */
  private isCriticalError(error: Error, metadata: ErrorMetadata): boolean {
    return (
      metadata.type === ErrorType.NETWORK ||
      error.message.includes('CRITICAL') ||
      error.message.includes('FATAL')
    );
  }
  
  /**
   * Flush error queue to reporting services
   */
  private flushErrorQueue(): void {
    if (this.errorQueue.length === 0) return;
    
    const errors = [...this.errorQueue];
    this.errorQueue = [];
    
    // Send to various services
    errors.forEach(({ error, metadata }) => {
      // Send to Sentry
      if (window.Sentry) {
        window.Sentry.captureException(error, {
          tags: {
            type: metadata.type,
            provider: metadata.provider,
            metro: metadata.metro
          },
          extra: metadata.additionalData
        });
      }
      
      // Send to Google Analytics
      if (window.gtag && envConfig.getConfig().MONITORING.GA_TRACKING_ID) {
        window.gtag('event', 'exception', {
          description: error.message,
          fatal: this.isCriticalError(error, metadata),
          error_type: metadata.type,
          provider: metadata.provider
        });
      }
      
      // Custom error endpoint
      if (envConfig.isProduction()) {
        this.sendToCustomEndpoint(error, metadata);
      }
    });
  }
  
  /**
   * Send to custom error tracking endpoint
   */
  private async sendToCustomEndpoint(error: Error, metadata: ErrorMetadata): Promise<void> {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          metadata,
          timestamp: new Date().toISOString(),
          sessionId: this.getSessionId()
        })
      });
    } catch (err) {
      // Silently fail - don't want error reporting to cause more errors
      console.error('Failed to send error to custom endpoint:', err);
    }
  }
  
  /**
   * Get or create session ID
   */
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
      sessionStorage.setItem('session_id', sessionId);
    }
    return sessionId;
  }
  
  /**
   * Clean up
   */
  destroy(): void {
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }
    this.flushErrorQueue();
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }
}

/**
 * Global error reporting service instance
 */
export const errorReporter = new ErrorReportingService();

/**
 * Error Boundary Props
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
}

/**
 * Error Boundary State
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  lastErrorTime: number | null;
}

/**
 * Production-ready Error Boundary Component
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId?: NodeJS.Timeout;
  
  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: null
    };
  }
  
  /**
   * Update state when error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      lastErrorTime: Date.now()
    };
  }
  
  /**
   * Component did catch error
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { componentName, onError } = this.props;
    const { errorCount } = this.state;
    
    // Update error count
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));
    
    // Report to error service
    errorReporter.reportError(error, {
      type: this.categorizeError(error),
      component: componentName || 'Unknown',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorCount: errorCount + 1
      }
    });
    
    // Call custom error handler
    onError?.(error, errorInfo);
    
    // Auto-recovery after delay if not too many errors
    if (errorCount < 3) {
      this.scheduleReset(10000); // Reset after 10 seconds
    }
  }
  
  /**
   * Component did update
   */
  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;
    
    if (hasError) {
      // Reset on prop changes if configured
      if (resetOnPropsChange && prevProps.children !== this.props.children) {
        this.resetErrorBoundary();
      }
      
      // Reset on key changes
      if (resetKeys?.some((key, idx) => key !== prevProps.resetKeys?.[idx])) {
        this.resetErrorBoundary();
      }
    }
  }
  
  /**
   * Component will unmount
   */
  componentWillUnmount(): void {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }
  
  /**
   * Categorize error type
   */
  private categorizeError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorType.NETWORK;
    }
    if (message.includes('adapter') || message.includes('adapt')) {
      return ErrorType.ADAPTER;
    }
    if (message.includes('provider')) {
      return ErrorType.PROVIDER;
    }
    if (message.includes('render') || message.includes('component')) {
      return ErrorType.RENDERING;
    }
    
    return ErrorType.UNKNOWN;
  }
  
  /**
   * Schedule automatic reset
   */
  private scheduleReset(delay: number): void {
    this.resetTimeoutId = setTimeout(() => {
      this.resetErrorBoundary();
    }, delay);
  }
  
  /**
   * Reset error boundary
   */
  resetErrorBoundary = (): void => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };
  
  /**
   * Render
   */
  render(): ReactNode {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { children, fallback, isolate } = this.props;
    
    if (hasError) {
      // Custom fallback
      if (fallback) {
        return fallback;
      }
      
      // Default error UI
      return (
        <div className={`error-boundary ${isolate ? 'isolated' : 'full-width'}`}>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-4">
            <h2 className="text-xl font-bold text-red-700 mb-2">
              ⚠️ Something went wrong
            </h2>
            
            {envConfig.isDevelopment() && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-red-600 hover:text-red-800">
                  Error details (Development only)
                </summary>
                <div className="mt-2 p-3 bg-red-100 rounded text-xs">
                  <div className="font-mono mb-2">{error?.message}</div>
                  <pre className="overflow-auto max-h-40 text-xs">
                    {error?.stack}
                  </pre>
                  {errorInfo && (
                    <pre className="overflow-auto max-h-40 text-xs mt-2">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}
            
            <div className="mt-4 flex gap-3">
              <button
                onClick={this.resetErrorBoundary}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Refresh Page
              </button>
            </div>
            
            {errorCount > 1 && (
              <p className="mt-3 text-sm text-red-600">
                This error has occurred {errorCount} times
              </p>
            )}
          </div>
        </div>
      );
    }
    
    return children;
  }
}

/**
 * Hook for error reporting
 */
export function useErrorHandler() {
  return (error: Error, metadata?: Partial<ErrorMetadata>) => {
    errorReporter.reportError(error, {
      type: ErrorType.UNKNOWN,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...metadata
    } as ErrorMetadata);
  };
}

/**
 * TypeScript declarations
 */
declare global {
  interface Window {
    Sentry?: any;
    gtag?: (...args: any[]) => void;
  }
}
