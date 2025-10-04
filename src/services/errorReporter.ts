/**
 * @file services/errorReporter.ts
 * @description Production-ready centralized error reporting service
 * @version 2.0.0
 * 
 * FIXES BUG #17: Removed all console.* statements for production
 * Now uses logger utility that respects environment
 */

import { envConfig } from '../config/environment';
import { logger } from '../utils/logger';

/**
 * Error Types for Categorization
 */
export enum ErrorType {
  NETWORK = 'network',
  ADAPTER = 'adapter',
  PROVIDER = 'provider',
  RENDERING = 'rendering',
  API = 'api',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown'
}

/**
 * Error Severity Levels
 */
export enum ErrorSeverity {
  FATAL = 'fatal',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * Error Metadata Interface
 */
export interface ErrorMetadata {
  type: ErrorType;
  severity?: ErrorSeverity;
  component?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  additionalData?: Record<string, any>;
}

/**
 * Rate Limiter for Error Reports
 */
class ErrorRateLimiter {
  private errorCounts: Map<string, number> = new Map();
  private readonly maxErrorsPerMinute = 10;
  private readonly windowMs = 60000; // 1 minute

  shouldReport(errorKey: string): boolean {
    const now = Date.now();
    const key = `${errorKey}_${Math.floor(now / this.windowMs)}`;
    const count = this.errorCounts.get(key) || 0;

    if (count >= this.maxErrorsPerMinute) {
      return false;
    }

    this.errorCounts.set(key, count + 1);
    this.cleanup(now);
    return true;
  }

  private cleanup(now: number): void {
    const currentWindow = Math.floor(now / this.windowMs);
    
    for (const [key] of this.errorCounts) {
      const keyWindow = parseInt(key.split('_').pop() || '0', 10);
      if (keyWindow < currentWindow - 1) {
        this.errorCounts.delete(key);
      }
    }
  }

  reset(): void {
    this.errorCounts.clear();
  }
}

/**
 * PII Sanitizer for Error Data
 */
class PIISanitizer {
  private static readonly PII_PATTERNS = [
    /\b[\w._%+-]+@[\w.-]+\.[A-Z]{2,}\b/gi, // Email
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit Card
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, // IP Address
  ];

  static sanitize(text: string): string {
    let sanitized = text;
    for (const pattern of this.PII_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }

  static sanitizeObject<T extends Record<string, any>>(obj: T): T {
    const sanitized = { ...obj };
    
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = this.sanitize(sanitized[key]) as any;
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeObject(sanitized[key]);
      }
    }
    
    return sanitized;
  }
}

/**
 * Error Reporter Service
 */
class ErrorReporterService {
  private isInitialized = false;
  private rateLimiter = new ErrorRateLimiter();

  /**
   * Initialize error reporting service
   */
  initialize(): void {
    if (this.isInitialized) {
      logger.warn('Error reporter already initialized');
      return;
    }

    // Production: Initialize Sentry
    if (envConfig.isProduction()) {
      const sentryDsn = envConfig.getMonitoringConfig().VITE_SENTRY_DSN;
      
      if (sentryDsn && window.Sentry) {
        try {
          window.Sentry.init({
            dsn: sentryDsn,
            environment: envConfig.getEnvironment(),
            integrations: [
              new window.Sentry.BrowserTracing(),
            ],
            tracesSampleRate: 0.1,
            beforeSend(event) {
              // Sanitize PII from all event data
              if (event.message) {
                event.message = PIISanitizer.sanitize(event.message);
              }
              if (event.exception?.values) {
                event.exception.values = event.exception.values.map(value => ({
                  ...value,
                  value: value.value ? PIISanitizer.sanitize(value.value) : value.value
                }));
              }
              return event;
            }
          });

          logger.info('Error reporting initialized with Sentry');
        } catch (error) {
          logger.error('Failed to initialize Sentry', { error });
        }
      }
    } else {
      logger.info('Error reporting initialized (Development mode - Logger only)');
    }

    this.isInitialized = true;
  }

  /**
   * Report error with metadata
   */
  reportError(error: Error, metadata: ErrorMetadata): void {
    const errorKey = `${metadata.type}_${error.message}`;

    // Check rate limit
    if (!this.rateLimiter.shouldReport(errorKey)) {
      logger.warn('Error report rate limited', { errorKey });
      return;
    }

    // Sanitize metadata
    const sanitizedMetadata = PIISanitizer.sanitizeObject(metadata);
    const sanitizedError = new Error(PIISanitizer.sanitize(error.message));
    sanitizedError.stack = error.stack ? PIISanitizer.sanitize(error.stack) : undefined;

    // Development: Log to logger (which respects environment)
    logger.error('Error Report', {
      type: metadata.type,
      severity: metadata.severity || 'error',
      component: metadata.component || 'Unknown',
      timestamp: metadata.timestamp,
      error: sanitizedError,
      additionalData: sanitizedMetadata.additionalData
    });

    // Production: Send to Sentry
    if (envConfig.isProduction() && window.Sentry) {
      try {
        window.Sentry.captureException(sanitizedError, {
          level: this.mapSeverityToSentryLevel(metadata.severity),
          tags: {
            errorType: metadata.type,
            component: metadata.component || 'unknown',
          },
          contexts: {
            metadata: sanitizedMetadata
          }
        });
      } catch (reportError) {
        logger.error('Failed to report error to Sentry', { error: reportError });
      }
    }

    // Send to analytics if configured
    if (window.gtag) {
      try {
        window.gtag('event', 'exception', {
          description: sanitizedError.message,
          fatal: metadata.severity === ErrorSeverity.FATAL,
          error_type: metadata.type,
          component: metadata.component
        });
      } catch (analyticsError) {
        logger.error('Failed to report error to analytics', { error: analyticsError });
      }
    }
  }

  /**
   * Report warning (non-error issue)
   */
  reportWarning(message: string, metadata: Partial<ErrorMetadata> = {}): void {
    const warningError = new Error(message);
    this.reportError(warningError, {
      type: ErrorType.UNKNOWN,
      severity: ErrorSeverity.WARNING,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...metadata
    });
  }

  /**
   * Report info message
   */
  reportInfo(message: string, metadata: Partial<ErrorMetadata> = {}): void {
    logger.info(message, metadata);

    if (envConfig.isProduction() && window.Sentry) {
      window.Sentry.captureMessage(message, {
        level: 'info',
        contexts: { metadata }
      });
    }
  }

  /**
   * Map error severity to Sentry level
   */
  private mapSeverityToSentryLevel(severity?: ErrorSeverity): 'fatal' | 'error' | 'warning' | 'info' {
    switch (severity) {
      case ErrorSeverity.FATAL:
        return 'fatal';
      case ErrorSeverity.ERROR:
        return 'error';
      case ErrorSeverity.WARNING:
        return 'warning';
      case ErrorSeverity.INFO:
        return 'info';
      default:
        return 'error';
    }
  }

  resetRateLimiter(): void {
    this.rateLimiter.reset();
  }

  getIsInitialized(): boolean {
    return this.isInitialized;
  }
}

/**
 * Singleton instance
 */
export const errorReporter = new ErrorReporterService();

/**
 * Initialize error reporter on module load
 */
errorReporter.initialize();

/**
 * TypeScript declarations for global error tracking services
 */
declare global {
  interface Window {
    Sentry?: any;
    gtag?: (...args: any[]) => void;
  }
}
