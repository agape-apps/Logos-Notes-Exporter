/**
 * Custom error type hierarchy for Logos Notes Exporter
 * Provides structured error handling with context and recovery strategies
 */

export enum ErrorSeverity {
  INFO = 'info',
  WARN = 'warn', 
  ERROR = 'error',
  FATAL = 'fatal'
}

export enum ErrorCategory {
  DATABASE = 'database',
  XAML_CONVERSION = 'xaml_conversion',
  FILE_SYSTEM = 'file_system',
  VALIDATION = 'validation',
  NETWORK = 'network',
  EXPORT = 'export'
}

export interface ErrorContext {
  /** Unique identifier for error tracking */
  errorId?: string;
  /** Component or module where error occurred */
  component?: string;
  /** Operation being performed when error occurred */
  operation?: string;
  /** Additional context data */
  metadata?: Record<string, any>;
  /** Timestamp when error occurred */
  timestamp?: Date;
  /** User-facing error message */
  userMessage?: string;
  /** Suggested recovery actions */
  suggestions?: string[];
}

/**
 * Base error class for all Logos Export errors
 */
export class LogosExportError extends Error {
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly context: ErrorContext;
  public readonly cause?: Error;

  constructor(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    category: ErrorCategory,
    context: ErrorContext = {},
    cause?: Error
  ) {
    super(message);
    this.name = 'LogosExportError';
    this.severity = severity;
    this.category = category;
    this.context = {
      timestamp: new Date(),
      ...context
    };
    this.cause = cause;

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.context.userMessage || this.message;
  }

  /**
   * Get error details for logging
   */
  getDetails(): Record<string, any> {
    return {
      message: this.message,
      severity: this.severity,
      category: this.category,
      context: this.context,
      stack: this.stack,
      cause: this.cause?.message
    };
  }
}

/**
 * Database-related errors (connection, queries, schema issues)
 */
export class DatabaseError extends LogosExportError {
  constructor(
    message: string,
    context: ErrorContext = {},
    cause?: Error,
    severity: ErrorSeverity = ErrorSeverity.ERROR
  ) {
    super(message, severity, ErrorCategory.DATABASE, {
      userMessage: 'Database operation failed. Please check your database file and try again.',
      suggestions: [
        'Verify the database file exists and is not corrupted',
        'Check file permissions',
        'Ensure Logos is not currently running',
        'Try a different database location'
      ],
      ...context
    }, cause);
    this.name = 'DatabaseError';
  }
}

/**
 * XAML conversion and parsing errors
 */
export class XamlConversionError extends LogosExportError {
  public readonly xamlSnippet?: string;
  public readonly conversionStats?: Record<string, number>;

  constructor(
    message: string,
    xamlSnippet?: string,
    context: ErrorContext = {},
    cause?: Error
  ) {
    super(message, ErrorSeverity.WARN, ErrorCategory.XAML_CONVERSION, {
      userMessage: 'Some note formatting could not be converted. Content will be preserved as plain text.',
      suggestions: [
        'Review the converted notes for formatting issues',
        'Report complex XAML structures for future improvements'
      ],
      ...context
    }, cause);
    this.name = 'XamlConversionError';
    this.xamlSnippet = xamlSnippet?.substring(0, 200); // Limit snippet size
  }
}

/**
 * File system operation errors
 */
export class FileSystemError extends LogosExportError {
  public readonly path?: string;
  public readonly operation?: string;

  constructor(
    message: string,
    path?: string,
    operation?: string,
    context: ErrorContext = {},
    cause?: Error
  ) {
    super(message, ErrorSeverity.ERROR, ErrorCategory.FILE_SYSTEM, {
      userMessage: 'File system operation failed. Check permissions and available disk space.',
      suggestions: [
        'Verify you have write permissions to the output directory',
        'Check available disk space',
        'Ensure the path is valid and accessible',
        'Try a different output location'
      ],
      ...context
    }, cause);
    this.name = 'FileSystemError';
    this.path = path;
    this.operation = operation;
  }
}

/**
 * Input validation and configuration errors
 */
export class ValidationError extends LogosExportError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(
    message: string,
    field?: string,
    value?: any,
    context: ErrorContext = {},
    cause?: Error
  ) {
    super(message, ErrorSeverity.ERROR, ErrorCategory.VALIDATION, {
      userMessage: 'Invalid configuration or input detected.',
      suggestions: [
        'Check your export settings',
        'Verify all required fields are filled',
        'Ensure file paths are valid'
      ],
      ...context
    }, cause);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Network-related errors (image downloads, connectivity)
 */
export class NetworkError extends LogosExportError {
  public readonly url?: string;
  public readonly statusCode?: number;

  constructor(
    message: string,
    url?: string,
    statusCode?: number,
    context: ErrorContext = {},
    cause?: Error
  ) {
    super(message, ErrorSeverity.WARN, ErrorCategory.NETWORK, {
      userMessage: 'Network operation failed. Some images may not be downloaded.',
      suggestions: [
        'Check your internet connection',
        'Retry the export',
        'Skip image downloads if not needed'
      ],
      ...context
    }, cause);
    this.name = 'NetworkError';
    this.url = url;
    this.statusCode = statusCode;
  }
}

/**
 * High-level export process errors
 */
export class ExportError extends LogosExportError {
  public readonly phase?: string;
  public readonly progress?: number;

  constructor(
    message: string,
    phase?: string,
    progress?: number,
    context: ErrorContext = {},
    cause?: Error
  ) {
    super(message, ErrorSeverity.ERROR, ErrorCategory.EXPORT, {
      userMessage: 'Export process failed. Some notes may not have been exported.',
      suggestions: [
        'Review the error log for specific issues',
        'Try exporting a smaller subset of notes',
        'Check database and output directory permissions'
      ],
      ...context
    }, cause);
    this.name = 'ExportError';
    this.phase = phase;
    this.progress = progress;
  }
}

/**
 * Error factory for creating appropriate error types
 */
export class ErrorFactory {
  static createDatabaseError(message: string, context?: ErrorContext, cause?: Error): DatabaseError {
    return new DatabaseError(message, context, cause);
  }

  static createXamlError(message: string, xamlSnippet?: string, context?: ErrorContext, cause?: Error): XamlConversionError {
    return new XamlConversionError(message, xamlSnippet, context, cause);
  }

  static createFileSystemError(message: string, path?: string, operation?: string, context?: ErrorContext, cause?: Error): FileSystemError {
    return new FileSystemError(message, path, operation, context, cause);
  }

  static createValidationError(message: string, field?: string, value?: any, context?: ErrorContext, cause?: Error): ValidationError {
    return new ValidationError(message, field, value, context, cause);
  }

  static createNetworkError(message: string, url?: string, statusCode?: number, context?: ErrorContext, cause?: Error): NetworkError {
    return new NetworkError(message, url, statusCode, context, cause);
  }

  static createExportError(message: string, phase?: string, progress?: number, context?: ErrorContext, cause?: Error): ExportError {
    return new ExportError(message, phase, progress, context, cause);
  }
}