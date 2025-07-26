/**
 * Centralized error handling utilities for Logos Notes Exporter
 * Provides error aggregation, recovery strategies, and user-friendly reporting
 */

import { LogosExportError, ErrorSeverity, ErrorCategory, ErrorContext } from './error-types.js';
import { Logger } from './logger.js';

export interface ErrorSummary {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  fatalErrors: LogosExportError[];
  recoverableErrors: LogosExportError[];
  warnings: LogosExportError[];
}

export interface RecoveryStrategy {
  canRecover: boolean;
  suggestedActions: string[];
  automaticRecovery?: () => Promise<boolean>;
}

/**
 * Centralized error handler for managing and processing errors
 */
export class ErrorHandler {
  private readonly logger: Logger;
  private readonly errors: LogosExportError[] = [];
  private readonly maxErrors: number;

  constructor(logger: Logger, maxErrors: number = 1000) {
    this.logger = logger;
    this.maxErrors = maxErrors;
  }

  /**
   * Handle an error with optional recovery attempt
   */
  async handleError(error: LogosExportError): Promise<boolean> {
    // Add to error collection
    this.addError(error);

    // Log the error
    this.logger.logError(error);

    // Determine if we can recover
    const recovery = this.getRecoveryStrategy(error);
    
    if (recovery.canRecover && recovery.automaticRecovery) {
      try {
        const recovered = await recovery.automaticRecovery();
        if (recovered) {
          this.logger.logInfo(`Automatically recovered from ${error.category} error`, {
            errorId: error.context.errorId,
            recovery: recovery.suggestedActions
          });
          return true;
        }
      } catch (recoveryError) {
        this.logger.logError(new LogosExportError(
          'Failed to recover from error',
          ErrorSeverity.ERROR,
          ErrorCategory.EXPORT,
          { operation: 'error-recovery' },
          recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError))
        ));
      }
    }

    // Check if error is fatal
    if (error.severity === ErrorSeverity.FATAL) {
      this.logger.logFatal('Fatal error encountered, stopping execution', error.getDetails());
      return false;
    }

    return true;
  }

  /**
   * Add error to collection
   */
  private addError(error: LogosExportError): void {
    this.errors.push(error);
    
    // Prevent memory issues by limiting error collection
    if (this.errors.length > this.maxErrors) {
      this.errors.shift(); // Remove oldest error
    }
  }

  /**
   * Get recovery strategy for an error
   */
  private getRecoveryStrategy(error: LogosExportError): RecoveryStrategy {
    switch (error.category) {
      case ErrorCategory.XAML_CONVERSION:
        return {
          canRecover: true,
          suggestedActions: [
            'Continue with plain text conversion',
            'Skip problematic formatting'
          ],
          automaticRecovery: async () => true // XAML errors are typically recoverable
        };

      case ErrorCategory.NETWORK:
        return {
          canRecover: true,
          suggestedActions: [
            'Skip image download',
            'Retry with timeout',
            'Continue without images'
          ],
          automaticRecovery: async () => true // Network errors shouldn't stop export
        };

      case ErrorCategory.FILE_SYSTEM:
        return {
          canRecover: error.severity !== ErrorSeverity.FATAL,
          suggestedActions: [
            'Check permissions',
            'Verify disk space',
            'Try alternative output location'
          ]
        };

      case ErrorCategory.DATABASE:
        return {
          canRecover: error.severity === ErrorSeverity.WARN,
          suggestedActions: [
            'Verify database integrity',
            'Check file permissions',
            'Ensure Logos is not running'
          ]
        };

      case ErrorCategory.VALIDATION:
        return {
          canRecover: false,
          suggestedActions: [
            'Fix configuration errors',
            'Verify input parameters',
            'Check file paths'
          ]
        };

      default:
        return {
          canRecover: error.severity !== ErrorSeverity.FATAL,
          suggestedActions: ['Review error details and try again']
        };
    }
  }

  /**
   * Get summary of all errors encountered
   */
  getErrorSummary(): ErrorSummary {
    const summary: ErrorSummary = {
      totalErrors: this.errors.length,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      fatalErrors: [],
      recoverableErrors: [],
      warnings: []
    };

    // Initialize counters
    Object.values(ErrorCategory).forEach(category => {
      summary.errorsByCategory[category] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      summary.errorsBySeverity[severity] = 0;
    });

    // Process errors
    this.errors.forEach(error => {
      summary.errorsByCategory[error.category]++;
      summary.errorsBySeverity[error.severity]++;

      switch (error.severity) {
        case ErrorSeverity.FATAL:
          summary.fatalErrors.push(error);
          break;
        case ErrorSeverity.ERROR:
          summary.recoverableErrors.push(error);
          break;
        case ErrorSeverity.WARN:
          summary.warnings.push(error);
          break;
      }
    });

    return summary;
  }

  /**
   * Clear all collected errors
   */
  clearErrors(): void {
    this.errors.length = 0;
  }

  /**
   * Get all errors for detailed analysis
   */
  getAllErrors(): ReadonlyArray<LogosExportError> {
    return [...this.errors];
  }

  /**
   * Check if there are any fatal errors
   */
  hasFatalErrors(): boolean {
    return this.errors.some(error => error.severity === ErrorSeverity.FATAL);
  }

  /**
   * Get user-friendly error report
   */
  getUserReport(): string {
    const summary = this.getErrorSummary();
    
    if (summary.totalErrors === 0) {
      return 'Export completed successfully with no errors.';
    }

    const lines: string[] = [];
    
    if (summary.fatalErrors.length > 0) {
      lines.push(`❌ ${summary.fatalErrors.length} fatal error(s) prevented completion:`);
      summary.fatalErrors.forEach(error => {
        lines.push(`   • ${error.getUserMessage()}`);
      });
    }

    if (summary.recoverableErrors.length > 0) {
      lines.push(`⚠️  ${summary.recoverableErrors.length} error(s) were recovered from:`);
      summary.recoverableErrors.slice(0, 5).forEach(error => {
        lines.push(`   • ${error.getUserMessage()}`);
      });
      if (summary.recoverableErrors.length > 5) {
        lines.push(`   • ... and ${summary.recoverableErrors.length - 5} more`);
      }
    }

    if (summary.warnings.length > 0) {
      lines.push(`ℹ️  ${summary.warnings.length} warning(s):`);
      summary.warnings.slice(0, 3).forEach(error => {
        lines.push(`   • ${error.getUserMessage()}`);
      });
      if (summary.warnings.length > 3) {
        lines.push(`   • ... and ${summary.warnings.length - 3} more`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Validate system requirements and environment
   */
  async validateEnvironment(): Promise<LogosExportError[]> {
    const errors: LogosExportError[] = [];

    try {
      // Check Node.js version (if applicable)
      if (typeof process !== 'undefined' && process.version) {
        const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
        if (nodeVersion < 16) {
          errors.push(new LogosExportError(
            'Node.js version 16 or higher is required',
            ErrorSeverity.FATAL,
            ErrorCategory.VALIDATION,
            {
              userMessage: 'Please upgrade to Node.js 16 or higher',
              suggestions: ['Update Node.js to a supported version']
            }
          ));
        }
      }

      // Add more environment checks as needed
    } catch (error) {
      errors.push(new LogosExportError(
        'Failed to validate environment',
        ErrorSeverity.WARN,
        ErrorCategory.VALIDATION,
        {},
        error instanceof Error ? error : new Error(String(error))
      ));
    }

    return errors;
  }
}

/**
 * Global error handler instance
 */
let globalErrorHandler: ErrorHandler | null = null;

/**
 * Initialize global error handler
 */
export function initializeErrorHandler(logger: Logger): ErrorHandler {
  globalErrorHandler = new ErrorHandler(logger);
  return globalErrorHandler;
}

/**
 * Get global error handler instance
 */
export function getErrorHandler(): ErrorHandler {
  if (!globalErrorHandler) {
    throw new Error('Error handler not initialized. Call initializeErrorHandler first.');
  }
  return globalErrorHandler;
}

/**
 * Convenience function to handle errors globally
 */
export async function handleError(error: LogosExportError | Error): Promise<boolean> {
  const handler = getErrorHandler();
  
  if (error instanceof LogosExportError) {
    return handler.handleError(error);
  } else {
    // Convert regular Error to LogosExportError
    const logosError = new LogosExportError(
      error.message,
      ErrorSeverity.ERROR,
      ErrorCategory.EXPORT,
      { operation: 'unknown' },
      error
    );
    return handler.handleError(logosError);
  }
}