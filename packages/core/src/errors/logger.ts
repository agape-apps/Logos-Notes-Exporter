/**
 * Structured logging system for Logos Notes Exporter
 * Provides console and file-based logging with different levels and formats
 */

import { LogosExportError, ErrorSeverity } from './error-types.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  component?: string;
  operation?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  includeStackTrace?: boolean;
  jsonFormat?: boolean;
}

/**
 * Structured logger with multiple output targets
 */
export class Logger {
  private readonly config: LoggerConfig;
  private readonly logs: LogEntry[] = [];
  private readonly maxMemoryLogs: number = 1000;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      includeStackTrace: true,
      jsonFormat: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      ...config
    };
  }

  /**
   * Log debug message
   */
  logDebug(message: string, context?: Record<string, any>, component?: string): void {
    this.log(LogLevel.DEBUG, message, context, undefined, component);
  }

  /**
   * Log info message
   */
  logInfo(message: string, context?: Record<string, any>, component?: string): void {
    this.log(LogLevel.INFO, message, context, undefined, component);
  }

  /**
   * Log warning message
   */
  logWarn(message: string, context?: Record<string, any>, component?: string): void {
    this.log(LogLevel.WARN, message, context, undefined, component);
  }

  /**
   * Log error
   */
  logError(error: LogosExportError | Error | string, context?: Record<string, any>, component?: string): void {
    if (typeof error === 'string') {
      this.log(LogLevel.ERROR, error, context, undefined, component);
    } else if (error instanceof LogosExportError) {
      const errorContext = {
        ...context,
        ...error.getDetails()
      };
      this.log(LogLevel.ERROR, error.message, errorContext, error, error.context.component || component);
    } else {
      this.log(LogLevel.ERROR, error.message, context, error, component);
    }
  }

  /**
   * Log fatal error
   */
  logFatal(message: string, context?: Record<string, any>, component?: string): void {
    this.log(LogLevel.FATAL, message, context, undefined, component);
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error,
    component?: string,
    operation?: string
  ): void {
    // Check if we should log this level
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error,
      component,
      operation
    };

    // Add to memory storage
    this.addToMemory(entry);

    // Output to console if enabled
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // Output to file if enabled (simplified - would need fs in real implementation)
    if (this.config.enableFile && this.config.filePath) {
      this.logToFile(entry);
    }
  }

  /**
   * Add log entry to memory storage
   */
  private addToMemory(entry: LogEntry): void {
    this.logs.push(entry);
    
    // Prevent memory issues
    if (this.logs.length > this.maxMemoryLogs) {
      this.logs.shift();
    }
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level].padEnd(5);
    const component = entry.component ? `[${entry.component}] ` : '';
    
    let message = `${timestamp} ${levelStr} ${component}${entry.message}`;

    // Add context if available
    if (entry.context && Object.keys(entry.context).length > 0) {
      if (this.config.jsonFormat) {
        message += ` ${JSON.stringify(entry.context)}`;
      } else {
        message += ` ${this.formatContextForConsole(entry.context)}`;
      }
    }

    // Choose appropriate console method
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message);
        if (entry.error && this.config.includeStackTrace) {
          console.error(entry.error.stack);
        }
        break;
    }
  }

  /**
   * Format context object for console display
   */
  private formatContextForConsole(context: Record<string, any>): string {
    const pairs = Object.entries(context).map(([key, value]) => {
      if (typeof value === 'object') {
        return `${key}=${JSON.stringify(value)}`;
      }
      return `${key}=${value}`;
    });
    return `{${pairs.join(', ')}}`;
  }

  /**
   * Log to file (simplified implementation)
   */
  private logToFile(entry: LogEntry): void {
    // In a real implementation, this would write to file system
    // For now, just store the formatted entry for potential file output
    const formatted = this.config.jsonFormat 
      ? this.formatEntryAsJson(entry)
      : this.formatEntryAsText(entry);
      
    // Would write `formatted` to file here
  }

  /**
   * Format log entry as JSON
   */
  private formatEntryAsJson(entry: LogEntry): string {
    const jsonEntry = {
      timestamp: entry.timestamp.toISOString(),
      level: LogLevel[entry.level],
      message: entry.message,
      component: entry.component,
      operation: entry.operation,
      context: entry.context,
      error: entry.error ? {
        message: entry.error.message,
        stack: entry.error.stack
      } : undefined
    };

    return JSON.stringify(jsonEntry);
  }

  /**
   * Format log entry as plain text
   */
  private formatEntryAsText(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level].padEnd(5);
    const component = entry.component ? `[${entry.component}] ` : '';
    
    let line = `${timestamp} ${level} ${component}${entry.message}`;
    
    if (entry.context) {
      line += ` ${this.formatContextForConsole(entry.context)}`;
    }
    
    if (entry.error && this.config.includeStackTrace) {
      line += `\n${entry.error.stack}`;
    }
    
    return line;
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get error summary
   */
  getErrorSummary(): { errors: number; warnings: number; fatals: number } {
    return {
      errors: this.logs.filter(log => log.level === LogLevel.ERROR).length,
      warnings: this.logs.filter(log => log.level === LogLevel.WARN).length,
      fatals: this.logs.filter(log => log.level === LogLevel.FATAL).length
    };
  }

  /**
   * Clear all logs from memory
   */
  clearLogs(): void {
    this.logs.length = 0;
  }

  /**
   * Set log level dynamically
   */
  setLogLevel(level: LogLevel): void {
    (this.config as any).level = level;
  }

  /**
   * Enable/disable console output
   */
  setConsoleEnabled(enabled: boolean): void {
    (this.config as any).enableConsole = enabled;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<LoggerConfig> {
    return { ...this.config };
  }

  /**
   * Create child logger with component context
   */
  createChildLogger(component: string): Logger {
    const childConfig = { ...this.config };
    const childLogger = new Logger(childConfig);
    
    // Override log method to automatically include component
    const originalLog = (childLogger as any).log.bind(childLogger);
    (childLogger as any).log = (
      level: LogLevel,
      message: string,
      context?: Record<string, any>,
      error?: Error,
      comp?: string,
      operation?: string
    ) => {
      originalLog(level, message, context, error, comp || component, operation);
    };
    
    return childLogger;
  }
}

/**
 * Default logger instance
 */
let defaultLogger: Logger | null = null;

/**
 * Initialize default logger
 */
export function initializeLogger(config?: Partial<LoggerConfig>): Logger {
  defaultLogger = new Logger(config);
  return defaultLogger;
}

/**
 * Get default logger instance
 */
export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger();
  }
  return defaultLogger;
}

/**
 * Convenience logging functions using default logger
 */
export const log = {
  debug: (message: string, context?: Record<string, any>, component?: string) => 
    getLogger().logDebug(message, context, component),
  
  info: (message: string, context?: Record<string, any>, component?: string) => 
    getLogger().logInfo(message, context, component),
  
  warn: (message: string, context?: Record<string, any>, component?: string) => 
    getLogger().logWarn(message, context, component),
  
  error: (error: LogosExportError | Error | string, context?: Record<string, any>, component?: string) => 
    getLogger().logError(error, context, component),
  
  fatal: (message: string, context?: Record<string, any>, component?: string) => 
    getLogger().logFatal(message, context, component)
};