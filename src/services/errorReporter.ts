/**
 * @file services/errorReporter.ts
 * @description Production-ready centralized error reporting service
 * @version 1.0.0
 * 
 * PRODUCTION-READY STANDARDS:
 * - Integrates with Sentry for production error tracking
 * - Rate limiting to prevent spam
 * - PII sanitization
 * - Development vs Production behavior
 * - Error categorization and metadata
 */

import { envConfig } from '../config/environment';

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

  /**
   * Check if error should be reported based on rate limit
   */
  shouldReport(errorKey: string): boolean {
    const now = Date.now();
    const key = `${errorKey}_${Math.floor(now / this.windowMs)}`;
    const count = this.errorCounts.get(key) || 0;

    if (count >= this.maxErrorsPerMinute) {
      return false;
    }

    this.errorCounts.set(key, count + 1);

    // Cleanup old entries
    this.cleanup(now);

    return true;
  }

  /**
   * Cleanup old rate limit entries
   */
  private cleanup(now: number): void {
    const currentWindow = Math.floor(now / this.windowMs);
    
    for (const [key] of this.errorCounts) {
      const keyWindow = parseInt(key.split('_').pop() || '0', 10);
      if (keyWindow < currentWindow - 1) {
        this.errorCounts.delete(key);
      }
    }
  }

  /**
   * Reset rate limiter
   */
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

  /**
   * Sanitize string by removing PII
   */
  static sanitize(text: string): string {
    let sanitized = text;

    for (const pattern of this.PII_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    return sanitized;
  }

  /**
   * Sanitize object recursively
   */
  static sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitize(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }
}

/**
 * Error Reporter Service
 */
class ErrorReporterService {
  private rateLimiter = new ErrorRateLimiter();
  private isInitialized = false;

  /**
   * Initialize error reporter
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Initialize Sentry in production
    if (envConfig.isProduction() && window.Sentry) {
      try {
        window.Sentry.init({
          dsn: import.meta.env.VITE_SENTRY_DSN,
          environment: envConfig.getEnvironment(),
          release: import.meta.env.VITE_APP_VERSION || 'unknown',
          tracesSampleRate: 0.1,
          beforeSend: (event) => {
            // Sanitize PII from error data
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

        console.log('Error reporting initialized (Sentry)');
      } catch (error) {
        console.error('Failed to initialize error reporting:', error);
      }
    } else if (envConfig.isDevelopment()) {
      console.log('Error reporting initialized (Development mode - Console only)');
    }

    this.isInitialized = true;
  }

  /**
   * Report error with metadata
   */
  reportError(error: Error, metadata: ErrorMetadata): void {
    // Generate error key for rate limiting
    const errorKey = `${metadata.type}_${error.message}`;

    // Check rate limit
    if (!this.rateLimiter.shouldReport(errorKey)) {
      if (envConfig.isDevelopment()) {
        console.warn('Error report rate limited:', errorKey);
      }
      return;
    }

    // Sanitize metadata
    const sanitizedMetadata = PIISanitizer.sanitizeObject(metadata);
    const sanitizedError = new Error(PIISanitizer.sanitize(error.message));
    sanitizedError.stack = error.stack ? PIISanitizer.sanitize(error.stack) : undefined;

    // Development: Log to console
    if (envConfig.isDevelopment()) {
      console.group(`🔴 Error Report: ${metadata.type}`);
      console.error('Error:', sanitizedError);
      console.table({
        Type: metadata.type,
        Severity: metadata.severity || 'error',
        Component: metadata.component || 'Unknown',
        Timestamp: metadata.timestamp,
      });
      if (sanitizedMetadata.additionalData) {
        console.log('Additional Data:', sanitizedMetadata.additionalData);
      }
      console.groupEnd();
    }

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
        console.error('Failed to report error to Sentry:', reportError);
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
        console.error('Failed to report error to analytics:', analyticsError);
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
    if (envConfig.isDevelopment()) {
      console.info(`ℹ️ ${message}`, metadata);
    }

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

  /**
   * Reset rate limiter (useful for testing)
   */
  resetRateLimiter(): void {
    this.rateLimiter.reset();
  }

  /**
   * Check if error reporting is initialized
   */
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
    Sentry?: {
      init: (options: any) => void;
      captureException: (error: Error, options?: any) => void;
      captureMessage: (message: string, options?: any) => void;
    };
    gtag?: (...args: any[]) => void;
  }
}
