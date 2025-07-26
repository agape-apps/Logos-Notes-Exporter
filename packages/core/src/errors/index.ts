/**
 * Error handling module exports for Logos Notes Exporter
 * Provides centralized error management, logging, and recovery strategies
 */

// Error types and hierarchy
export {
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
  LogosExportError,
  DatabaseError,
  XamlConversionError,
  FileSystemError,
  ValidationError,
  NetworkError,
  ExportError,
  ErrorFactory
} from './error-types.js';

// Error handler and management
export {
  ErrorHandler,
  ErrorSummary,
  RecoveryStrategy,
  initializeErrorHandler,
  getErrorHandler,
  handleError
} from './error-handler.js';

// Logging system
export {
  Logger,
  LogLevel,
  LogEntry,
  LoggerConfig,
  initializeLogger,
  getLogger,
  log
} from './logger.js';