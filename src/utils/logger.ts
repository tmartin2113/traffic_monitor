/**
 * @file utils/logger.ts
 * @description Production-ready logging utility with environment-aware logging
 * @version 1.0.0
 * 
 * PRODUCTION-READY FEATURES:
 * - Environment-aware logging (verbose in dev, minimal in prod)
 * - Structured logging with context
 * - Error tracking service integration ready
 * - Type-safe log methods
 * - Performance-optimized
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  environment: string;
}

class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.isProduction = import.meta.env.PROD;
  }

  /**
   * Create a structured log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): LogEntry {
    return {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      environment: this.isDevelopment ? 'development' : 'production',
    };
  }

  /**
   * Send log to external service (Sentry, LogRocket, etc.)
   */
  private sendToExternalService(entry: LogEntry): void {
    if (!this.isProduction) return;

    // Send to Sentry if available
    if (window.Sentry && (entry.level === 'error' || entry.level === 'warn')) {
      window.Sentry.captureException(new Error(entry.message), {
        level: entry.level,
        extra: entry.context,
      });
    }

    // Send to other logging services here
    // Example: LogRocket, Datadog, New Relic, etc.
  }

  /**
   * Debug level logging (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (!this.isDevelopment) return;

    const entry = this.createLogEntry('debug', message, context);
    console.log(`🔍 [DEBUG] ${message}`, context || '');
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('info', message, context);

    if (this.isDevelopment) {
      console.log(`ℹ️ [INFO] ${message}`, context || '');
    } else {
      console.log(message, context || '');
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('warn', message, context);

    console.warn(`⚠️ [WARN] ${message}`, context || '');
    this.sendToExternalService(entry);
  }

  /**
   * Error level logging
   */
  error(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('error', message, context);

    console.error(`❌ [ERROR] ${message}`, context || '');
    this.sendToExternalService(entry);
  }

  /**
   * Group logging (for related logs)
   */
  group(title: string, callback: () => void): void {
    if (this.isDevelopment) {
      console.group(title);
      callback();
      console.groupEnd();
    } else {
      callback();
    }
  }

  /**
   * Table logging (for structured data)
   */
  table(data: any[], columns?: string[]): void {
    if (!this.isDevelopment) return;

    if (columns) {
      console.table(data, columns);
    } else {
      console.table(data);
    }
  }

  /**
   * Time measurement
   */
  time(label: string): void {
    if (!this.isDevelopment) return;
    console.time(label);
  }

  /**
   * End time measurement
   */
  timeEnd(label: string): void {
    if (!this.isDevelopment) return;
    console.timeEnd(label);
  }

  /**
   * Assert logging
   */
  assert(condition: boolean, message: string, context?: LogContext): void {
    if (!condition) {
      this.error(`Assertion failed: ${message}`, context);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for external use
export type { LogLevel, LogContext, LogEntry };

// TypeScript declarations for Sentry
declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error, context?: any) => void;
      captureMessage: (message: string, level?: string) => void;
    };
  }
}
