export { NotesToolDatabase } from './notestool-database.js';
export { MarkdownConverter, DEFAULT_MARKDOWN_OPTIONS } from './markdown-converter.js';
export { XamlToMarkdownConverter } from './xaml-converter.js';
export { XamlListProcessor } from './xaml-lists-processor.js';
export { XamlImageProcessor } from './xaml-image-processor.js';
export { BibleReferenceDecoder } from './reference-decoder.js';
export { NotebookOrganizer } from './notebook-organizer.js';
export { FileOrganizer, DEFAULT_FILE_OPTIONS } from './file-organizer.js';
export { CatalogDatabase } from './catalog-database.js';
export { MetadataProcessor } from './metadata-processor.js';
export { UnicodeCleaner } from './unicode-cleaner.js';
export { ExportValidator } from './validator.js';
export { DatabaseLocator } from './database-locator.js';
export {
  LogosNotesExporter,
  type CoreExportOptions,
  type ExportCallbacks,
  type ExportResult,
  type ProgressCallback,
  type LogCallback
} from './exporter.js';

// Error handling exports
export {
  LogosExportError,
  DatabaseError,
  ValidationError,
  FileSystemError,
  NetworkError,
  XamlConversionError,
  ErrorSeverity,
  ErrorCategory,
  type ErrorContext
} from './errors/error-types.js';

export { Logger, LogLevel, type LogEntry, type LoggerConfig } from './errors/logger.js';
export { ErrorHandler } from './errors/error-handler.js';

export type * from './types.js';