/**
 * @file utils/logger.ts
 * @description Production-ready logging utility with ZERO console usage in production
 * @version 2.0.0 - PRODUCTION READY
 * 
 * CRITICAL FIX: Removed ALL console.* statements from production builds
 * 
 * PRODUCTION STANDARDS:
 * - Zero console output in production mode
 * - All logs sent to external monitoring services
 * - Environment-aware logging (verbose in dev, silent in prod)
 * - Structured logging with full context
 * - Type-safe log methods
 * - Performance-optimized with log buffering
 * - Memory-safe with automatic buffer cleanup
 * - Error tracking service integration (Sentry, LogRocket, etc.)
 * - Complete control over what gets logged where
 * 
 * BEHAVIOR:
 * - Development: Full console output with rich formatting
 * - Production: Silent console, all logs to external services only
 * - Can be configured to allow console.error in production for critical errors
 * 
 * @author Senior Development Team
 * @since 2.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Log levels in order of severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Context object for additional log data
 */
export interface LogContext {
  [key: string]: any;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  environment: string;
  stackTrace?: string;
  userAgent?: string;
  url?: string;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Enable console output in production (default: false) */
  enableConsoleInProduction?: boolean;
  /** Allow console.error for critical errors in production (default: false) */
  allowCriticalConsoleInProduction?: boolean;
  /** Maximum number of logs to buffer before sending (default: 100) */
  maxBufferSize?: number;
  /** Time in ms before auto-flushing buffer (default: 5000) */
  bufferFlushInterval?: number;
  /** Enable performance timing logs (default: true in dev, false in prod) */
  enablePerformanceLogs?: boolean;
  /** Minimum log level to record (default: 'debug' in dev, 'warn' in prod) */
  minLogLevel?: LogLevel;
}

/**
 * External logging service interface
 */
export interface ExternalLogService {
  name: string;
  isAvailable: () => boolean;
  sendLog: (entry: LogEntry) => void | Promise<void>;
  sendError: (error: Error, context?: LogContext) => void | Promise<void>;
}

// ============================================================================
// LOG LEVEL UTILITIES
// ============================================================================

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

// ============================================================================
// EXTERNAL SERVICE INTEGRATIONS
// ============================================================================

/**
 * Sentry integration
 */
const SentryService: ExternalLogService = {
  name: 'Sentry',
  isAvailable: () => typeof window !== 'undefined' && !!window.Sentry,
  sendLog: (entry: LogEntry) => {
    if (SentryService.isAvailable() && (entry.level === 'error' || entry.level === 'fatal')) {
      window.Sentry!.captureMessage(entry.message, {
        level: entry.level === 'fatal' ? 'fatal' : 'error',
        extra: entry.context,
        tags: {
          environment: entry.environment,
          url: entry.url,
        },
      });
    }
  },
  sendError: (error: Error, context?: LogContext) => {
    if (SentryService.isAvailable()) {
      window.Sentry!.captureException(error, {
        extra: context,
      });
    }
  },
};

/**
 * LogRocket integration
 */
const LogRocketService: ExternalLogService = {
  name: 'LogRocket',
  isAvailable: () => typeof window !== 'undefined' && !!(window as any).LogRocket,
  sendLog: (entry: LogEntry) => {
    if (LogRocketService.isAvailable()) {
      const LogRocket = (window as any).LogRocket;
      
      switch (entry.level) {
        case 'debug':
          LogRocket.debug?.(entry.message, entry.context);
          break;
        case 'info':
          LogRocket.info?.(entry.message, entry.context);
          break;
        case 'warn':
          LogRocket.warn?.(entry.message, entry.context);
          break;
        case 'error':
        case 'fatal':
          LogRocket.error?.(entry.message, entry.context);
          break;
      }
    }
  },
  sendError: (error: Error, context?: LogContext) => {
    if (LogRocketService.isAvailable()) {
      (window as any).LogRocket.captureException?.(error, {
        extra: context,
      });
    }
  },
};

/**
 * Custom backend logging service (if you have your own logging endpoint)
 */
const BackendLogService: ExternalLogService = {
  name: 'Backend',
  isAvailable: () => typeof window !== 'undefined',
  sendLog: async (entry: LogEntry) => {
    try {
      // Only send warnings and errors to backend to reduce noise
      if (entry.level === 'warn' || entry.level === 'error' || entry.level === 'fatal') {
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
          keepalive: true, // Ensures log is sent even if page is closing
        });
      }
    } catch (error) {
      // Silently fail - don't create infinite loop
    }
  },
  sendError: async (error: Error, context?: LogContext) => {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          context,
          timestamp: new Date().toISOString(),
        }),
        keepalive: true,
      });
    } catch (err) {
      // Silently fail
    }
  },
};

// ============================================================================
// MAIN LOGGER CLASS
// ============================================================================

/**
 * Production-ready Logger class
 * 
 * This logger ensures NO console output in production unless explicitly configured.
 * All logs are sent to external monitoring services instead.
 */
class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;
  private config: Required<LoggerConfig>;
  private logBuffer: LogEntry[] = [];
  private flushTimerId?: NodeJS.Timeout;
  private externalServices: ExternalLogService[] = [];
  private performanceMarks: Map<string, number> = new Map();

  constructor(config: LoggerConfig = {}) {
    this.isDevelopment = import.meta.env?.DEV ?? process.env.NODE_ENV !== 'production';
    this.isProduction = !this.isDevelopment;

    // Set defaults based on environment
    this.config = {
      enableConsoleInProduction: config.enableConsoleInProduction ?? false,
      allowCriticalConsoleInProduction: config.allowCriticalConsoleInProduction ?? false,
      maxBufferSize: config.maxBufferSize ?? 100,
      bufferFlushInterval: config.bufferFlushInterval ?? 5000,
      enablePerformanceLogs: config.enablePerformanceLogs ?? this.isDevelopment,
      minLogLevel: config.minLogLevel ?? (this.isDevelopment ? 'debug' : 'warn'),
    };

    // Register external services
    this.externalServices = [SentryService, LogRocketService, BackendLogService];

    // Setup auto-flush for production
    if (this.isProduction) {
      this.setupAutoFlush();
    }

    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  // ==========================================================================
  // CORE LOGGING METHODS
  // ==========================================================================

  /**
   * Debug level logging (development only by default)
   * 
   * @param message - Log message
   * @param context - Additional context data
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Info level logging
   * 
   * @param message - Log message
   * @param context - Additional context data
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Warning level logging
   * 
   * @param message - Log message
   * @param context - Additional context data
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Error level logging
   * 
   * @param message - Log message
   * @param context - Additional context data
   */
  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  /**
   * Fatal error logging (highest severity)
   * 
   * @param message - Log message
   * @param context - Additional context data
   */
  fatal(message: string, context?: LogContext): void {
    this.log('fatal', message, context);
  }

  // ==========================================================================
  // INTERNAL LOGGING IMPLEMENTATION
  // ==========================================================================

  /**
   * Core log method - handles all logging logic
   * 
   * CRITICAL: This method ensures NO console output in production
   * unless explicitly configured
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    // Check if we should log this level
    if (!shouldLog(level, this.config.minLogLevel)) {
      return;
    }

    // Create structured log entry
    const entry = this.createLogEntry(level, message, context);

    // DEVELOPMENT: Use console with formatting
    if (this.isDevelopment) {
      this.logToConsole(entry);
    }
    // PRODUCTION: Silent console, use external services only
    else {
      // Only allow console for critical errors if configured
      if (
        this.config.allowCriticalConsoleInProduction &&
        (level === 'error' || level === 'fatal')
      ) {
        // Use native console.error only for critical errors
        // This is the ONLY console usage allowed in production
        try {
          console.error(`[${level.toUpperCase()}]`, message, context || '');
        } catch (err) {
          // Silently fail if console is not available
        }
      }

      // ALWAYS send to external services in production
      this.sendToExternalServices(entry);
    }

    // Buffer logs for batch processing
    if (this.isProduction) {
      this.bufferLog(entry);
    }
  }

  /**
   * Create a structured log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      environment: this.isDevelopment ? 'development' : 'production',
    };

    // Add stack trace for errors
    if (level === 'error' || level === 'fatal') {
      entry.stackTrace = new Error().stack;
    }

    // Add browser context if available
    if (typeof window !== 'undefined') {
      entry.userAgent = window.navigator.userAgent;
      entry.url = window.location.href;
    }

    return entry;
  }

  /**
   * Log to console (DEVELOPMENT ONLY)
   * 
   * This method is NEVER called in production unless enableConsoleInProduction is true
   */
  private logToConsole(entry: LogEntry): void {
    // Double-check we're in development or explicitly allowed
    if (!this.isDevelopment && !this.config.enableConsoleInProduction) {
      return;
    }

    const emoji = this.getLogEmoji(entry.level);
    const prefix = `${emoji} [${entry.level.toUpperCase()}]`;
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();

    try {
      switch (entry.level) {
        case 'debug':
          console.debug(`${prefix} [${timestamp}]`, entry.message, entry.context || '');
          break;
        case 'info':
          console.info(`${prefix} [${timestamp}]`, entry.message, entry.context || '');
          break;
        case 'warn':
          console.warn(`${prefix} [${timestamp}]`, entry.message, entry.context || '');
          break;
        case 'error':
        case 'fatal':
          console.error(`${prefix} [${timestamp}]`, entry.message, entry.context || '');
          if (entry.stackTrace) {
            console.error('Stack trace:', entry.stackTrace);
          }
          break;
      }
    } catch (err) {
      // Silently fail if console methods are not available
    }
  }

  /**
   * Get emoji for log level
   */
  private getLogEmoji(level: LogLevel): string {
    const emojis: Record<LogLevel, string> = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      fatal: '💀',
    };
    return emojis[level];
  }

  /**
   * Send log entry to external monitoring services
   */
  private sendToExternalServices(entry: LogEntry): void {
    for (const service of this.externalServices) {
      try {
        if (service.isAvailable()) {
          service.sendLog(entry);
        }
      } catch (error) {
        // Silently fail - don't create infinite error loop
      }
    }
  }

  /**
   * Buffer log for batch processing
   */
  private bufferLog(entry: LogEntry): void {
    this.logBuffer.push(entry);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.config.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Setup automatic buffer flushing
   */
  private setupAutoFlush(): void {
    if (this.flushTimerId) {
      clearInterval(this.flushTimerId);
    }

    this.flushTimerId = setInterval(() => {
      this.flush();
    }, this.config.bufferFlushInterval);
  }

  /**
   * Flush buffered logs
   */
  flush(): void {
    if (this.logBuffer.length === 0) return;

    // Process buffered logs
    const logs = [...this.logBuffer];
    this.logBuffer = [];

    // Send to external services
    // This could be optimized to batch send to a backend
    for (const log of logs) {
      this.sendToExternalServices(log);
    }
  }

  // ==========================================================================
  // EXCEPTION LOGGING
  // ==========================================================================

  /**
   * Log an exception with full context
   * 
   * @param error - Error object
   * @param context - Additional context
   */
  exception(error: Error, context?: LogContext): void {
    this.error(error.message, {
      ...context,
      errorName: error.name,
      stack: error.stack,
    });

    // Send to external error tracking
    for (const service of this.externalServices) {
      try {
        if (service.isAvailable()) {
          service.sendError(error, context);
        }
      } catch (err) {
        // Silently fail
      }
    }
  }

  // ==========================================================================
  // PERFORMANCE LOGGING
  // ==========================================================================

  /**
   * Start a performance timer
   * 
   * @param label - Timer label
   */
  time(label: string): void {
    if (!this.config.enablePerformanceLogs) return;

    this.performanceMarks.set(label, performance.now());

    if (this.isDevelopment) {
      this.debug(`⏱️ Timer started: ${label}`);
    }
  }

  /**
   * End a performance timer and log duration
   * 
   * @param label - Timer label
   */
  timeEnd(label: string): void {
    if (!this.config.enablePerformanceLogs) return;

    const startTime = this.performanceMarks.get(label);
    if (!startTime) {
      this.warn(`Timer "${label}" was never started`);
      return;
    }

    const duration = performance.now() - startTime;
    this.performanceMarks.delete(label);

    this.debug(`⏱️ ${label}: ${duration.toFixed(2)}ms`, {
      duration,
      label,
      performanceMark: true,
    });
  }

  // ==========================================================================
  // GROUPED LOGGING
  // ==========================================================================

  /**
   * Group related logs together (development only)
   * 
   * @param title - Group title
   * @param callback - Function containing grouped logs
   */
  group(title: string, callback: () => void): void {
    if (!this.isDevelopment) {
      callback();
      return;
    }

    try {
      console.group(title);
      callback();
      console.groupEnd();
    } catch (err) {
      callback();
    }
  }

  /**
   * Collapsed group (development only)
   * 
   * @param title - Group title
   * @param callback - Function containing grouped logs
   */
  groupCollapsed(title: string, callback: () => void): void {
    if (!this.isDevelopment) {
      callback();
      return;
    }

    try {
      console.groupCollapsed(title);
      callback();
      console.groupEnd();
    } catch (err) {
      callback();
    }
  }

  // ==========================================================================
  // TABLE LOGGING
  // ==========================================================================

  /**
   * Log data as a table (development only)
   * 
   * @param data - Array of objects to display as table
   * @param columns - Optional column names
   */
  table(data: any[], columns?: string[]): void {
    if (!this.isDevelopment) return;

    try {
      if (columns) {
        console.table(data, columns);
      } else {
        console.table(data);
      }
    } catch (err) {
      // Silently fail
    }
  }

  // ==========================================================================
  // ASSERTION LOGGING
  // ==========================================================================

  /**
   * Assert a condition and log if false
   * 
   * @param condition - Condition to assert
   * @param message - Message to log if assertion fails
   * @param context - Additional context
   */
  assert(condition: boolean, message: string, context?: LogContext): void {
    if (!condition) {
      this.error(`Assertion failed: ${message}`, {
        ...context,
        assertion: true,
      });
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Get current logger configuration
   */
  getConfig(): Required<LoggerConfig> {
    return { ...this.config };
  }

  /**
   * Update logger configuration
   * 
   * @param newConfig - Partial configuration to update
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };

    // Restart auto-flush if interval changed
    if (newConfig.bufferFlushInterval && this.isProduction) {
      this.setupAutoFlush();
    }
  }

  /**
   * Get buffered log count
   */
  getBufferSize(): number {
    return this.logBuffer.length;
  }

  /**
   * Clear all buffered logs (use with caution)
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Destroy logger and cleanup resources
   */
  destroy(): void {
    this.flush();
    
    if (this.flushTimerId) {
      clearInterval(this.flushTimerId);
      this.flushTimerId = undefined;
    }

    this.performanceMarks.clear();
    this.logBuffer = [];
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Singleton logger instance
 * 
 * By default:
 * - Development: Full console output with rich formatting
 * - Production: ZERO console output, all logs to external services
 */
export const logger = new Logger({
  // Production configuration
  enableConsoleInProduction: false, // NO console in production
  allowCriticalConsoleInProduction: false, // Not even for errors
  maxBufferSize: 100,
  bufferFlushInterval: 5000,
  enablePerformanceLogs: import.meta.env?.DEV ?? false,
  minLogLevel: import.meta.env?.DEV ? 'debug' : 'warn',
});

// Export types
export type { LogLevel, LogContext, LogEntry, LoggerConfig, ExternalLogService };

// Export the Logger class for custom instances if needed
export { Logger };

// ============================================================================
// TYPESCRIPT GLOBAL DECLARATIONS
// ============================================================================

declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error, context?: any) => void;
      captureMessage: (message: string, context?: any) => void;
    };
    LogRocket?: any;
  }
}

// ============================================================================
// USAGE EXAMPLES (REMOVE IN PRODUCTION)
// ============================================================================

/*
// Basic usage:
logger.info('User logged in', { userId: '123' });
logger.warn('API rate limit approaching', { remaining: 5 });
logger.error('Failed to fetch data', { endpoint: '/api/events' });

// Exception logging:
try {
  // some code
} catch (error) {
  logger.exception(error as Error, { context: 'data-fetch' });
}

// Performance timing:
logger.time('api-call');
await fetchData();
logger.timeEnd('api-call'); // Logs: "⏱️ api-call: 245.67ms"

// Grouped logs (dev only):
logger.group('User Actions', () => {
  logger.info('Action 1');
  logger.info('Action 2');
});

// Table logging (dev only):
logger.table(users, ['id', 'name', 'email']);

// Assertions:
logger.assert(users.length > 0, 'Users array should not be empty');

// Custom configuration:
const customLogger = new Logger({
  enableConsoleInProduction: true, // If you really need it
  minLogLevel: 'error', // Only log errors and fatal
});
*/
