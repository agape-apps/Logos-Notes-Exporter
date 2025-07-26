import * as path from 'path';
import * as fs from 'fs';
import { BrowserWindow } from 'electron';
import { 
  LogosNotesExporter,
  DatabaseLocator,
  type CoreExportOptions,
  type ExportCallbacks,
  DatabaseError,
  ValidationError,
  FileSystemError,
  Logger
} from '@logos-notes-exporter/core';
import type { ExportSettings, ExportResult } from '../renderer/types';

// Create logger for Electron export handler
const logger = new Logger({ enableConsole: true, enableFile: false });

/**
 * Validates export settings with comprehensive error handling
 * Throws structured errors instead of returning validation objects
 */
function validateExportSettings(settings: ExportSettings): void {
  logger.logInfo('Validating export settings', { 
    hasDbPath: !!settings.databasePath, 
    hasOutputDir: !!settings.outputDirectory 
  }, 'validateExportSettings');

  // Check if databasePath exists and is valid
  if (!settings.databasePath || typeof settings.databasePath !== 'string') {
    const error = new ValidationError(
      'Database path is required and must be a valid string',
      'databasePath',
      settings.databasePath,
      { operation: 'validateExportSettings' }
    );
    logger.logError(error, {}, 'validateExportSettings');
    throw error;
  }

  if (!fs.existsSync(settings.databasePath)) {
    const error = new DatabaseError(
      `Database file not found: ${settings.databasePath}`,
      {
        operation: 'validateExportSettings',
        metadata: { filePath: settings.databasePath }
      }
    );
    logger.logError(error, {}, 'validateExportSettings');
    throw error;
  }

  // Check if outputDirectory exists and is a valid string
  if (!settings.outputDirectory || typeof settings.outputDirectory !== 'string' || settings.outputDirectory.trim() === '') {
    const error = new ValidationError(
      'Output directory is required and must be a non-empty string',
      'outputDirectory',
      settings.outputDirectory,
      { operation: 'validateExportSettings' }
    );
    logger.logError(error, {}, 'validateExportSettings');
    throw error;
  }

  try {
    // Safely handle the tilde expansion
    const expandedPath = settings.outputDirectory.replace(/^~/, process.env.HOME || '');
    const outputPath = path.resolve(expandedPath);
    
    logger.logDebug('Creating output directory if needed', { 
      originalPath: settings.outputDirectory,
      expandedPath,
      resolvedPath: outputPath
    }, 'validateExportSettings');
    
    // Try to create output directory if it doesn't exist
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
      logger.logInfo('Created output directory', { path: outputPath }, 'validateExportSettings');
    }
  } catch (error) {
    const fsError = new FileSystemError(
      `Cannot create output directory: ${error instanceof Error ? error.message : String(error)}`,
      settings.outputDirectory,
      'validateExportSettings',
      {
        operation: 'validateExportSettings',
        metadata: {
          originalError: error instanceof Error ? error.message : String(error)
        }
      },
      error instanceof Error ? error : undefined
    );
    logger.logError(fsError, {}, 'validateExportSettings');
    throw fsError;
  }

  logger.logInfo('Export settings validation completed successfully', {}, 'validateExportSettings');
}

/**
 * Detect available database locations with enhanced error handling
 */
export function detectDatabaseLocations(): string[] {
  logger.logInfo('Detecting database locations', {}, 'detectDatabaseLocations');
  
  try {
    const locations = DatabaseLocator.findDatabases();
    const validLocations = locations
      .filter(loc => loc.exists)
      .map(loc => loc.path);
    
    logger.logInfo('Database detection completed', { 
      totalFound: locations.length,
      validFound: validLocations.length 
    }, 'detectDatabaseLocations');
    
    return validLocations;
  } catch (error) {
    const dbError = new DatabaseError(
      'Failed to detect database locations',
      { operation: 'detectDatabaseLocations' },
      error instanceof Error ? error : undefined
    );
    logger.logError(dbError, {}, 'detectDatabaseLocations');
    return [];
  }
}

/**
 * Get the best database location with enhanced error handling
 */
export function getDefaultDatabasePath(): string | null {
  logger.logInfo('Getting default database path', {}, 'getDefaultDatabasePath');
  
  try {
    const location = DatabaseLocator.getBestDatabase();
    const result = location ? location.path : null;
    
    logger.logInfo('Default database path retrieved', { 
      found: !!result,
      path: result 
    }, 'getDefaultDatabasePath');
    
    return result;
  } catch (error) {
    const dbError = new DatabaseError(
      'Failed to get default database path',
      { operation: 'getDefaultDatabasePath' },
      error instanceof Error ? error : undefined
    );
    logger.logError(dbError, {}, 'getDefaultDatabasePath');
    return null;
  }
}

/**
 * Get database search instructions with enhanced error handling
 */
export function getDatabaseSearchInstructions(): string[] {
  logger.logInfo('Getting database search instructions', {}, 'getDatabaseSearchInstructions');
  
  try {
    const instructions = DatabaseLocator.getSearchInstructions();
    logger.logInfo('Database search instructions retrieved', { 
      count: instructions.length 
    }, 'getDatabaseSearchInstructions');
    return instructions;
  } catch (error) {
    const dbError = new DatabaseError(
      'Failed to get database search instructions',
      { operation: 'getDatabaseSearchInstructions' },
      error instanceof Error ? error : undefined
    );
    logger.logError(dbError, {}, 'getDatabaseSearchInstructions');
    return ['Error getting database instructions - please check your Logos installation'];
  }
}

/**
 * Main export function with enhanced error handling and logging
 */
export async function executeExport(
  settings: ExportSettings,
  mainWindow: BrowserWindow | null
): Promise<ExportResult> {
  logger.logInfo('Starting export process', {
    hasDatabasePath: !!settings.databasePath,
    hasOutputDir: !!settings.outputDirectory,
    autoDetect: settings.autoDetectDatabase
  }, 'executeExport');
  
  try {
    // If no database path provided, try auto-detection
    let finalDatabasePath = settings.databasePath;
    if (!finalDatabasePath) {
      logger.logInfo('No database path provided, attempting auto-detection', {}, 'executeExport');
      finalDatabasePath = getDefaultDatabasePath() || undefined;
      if (finalDatabasePath) {
        logger.logInfo('Auto-detected database path', { path: finalDatabasePath }, 'executeExport');
        if (mainWindow) {
          mainWindow.webContents.send('output-log', `🔍 Auto-detected database: ${finalDatabasePath}`);
        }
      } else {
        logger.logWarn('Auto-detection failed - no database found', {}, 'executeExport');
      }
    } else {
      logger.logInfo('Using provided database path', { path: finalDatabasePath }, 'executeExport');
    }

    // Update settings with the final database path
    const updatedSettings = {
      ...settings,
      databasePath: finalDatabasePath
    };

    // Validate settings - this will throw if validation fails
    logger.logInfo('Validating export settings', {}, 'executeExport');
    validateExportSettings(updatedSettings);
    logger.logInfo('Settings validation passed', {}, 'executeExport');

    // Convert Electron ExportSettings to Core ExportOptions
    const coreOptions: CoreExportOptions = {
      database: updatedSettings.databasePath,
      output: updatedSettings.outputDirectory,
      organizeByNotebooks: updatedSettings.organizeByNotebooks,
      includeDateFolders: updatedSettings.includeDateFolders,
      createIndexFiles: updatedSettings.createIndexFiles,
      includeFrontmatter: updatedSettings.includeFrontmatter,
      includeMetadata: updatedSettings.includeMetadata,
      includeDates: updatedSettings.includeDates,
      includeNotebook: updatedSettings.includeNotebook,
      includeId: updatedSettings.includeId,
      dateFormat: updatedSettings.dateFormat,
      skipHighlights: updatedSettings.skipHighlights,
      htmlSubSuperscript: updatedSettings.htmlSubSuperscript,
      indentsNotQuotes: updatedSettings.indentsNotQuotes,
      verbose: false, // Not verbose by default for Electron
      dryRun: updatedSettings.dryRun,
    };

    logger.logInfo('Core options prepared', {
      database: coreOptions.database,
      output: coreOptions.output,
      dryRun: coreOptions.dryRun
    }, 'executeExport');

    // Create callbacks for Electron IPC communication
    const callbacks: ExportCallbacks = {
      onProgress: (progress: number, message: string) => {
        logger.logDebug('Export progress update', { progress, message }, 'executeExport');
        if (mainWindow) {
          mainWindow.webContents.send('export-progress', { progress, message });
        }
      },
      onLog: (message: string) => {
        logger.logDebug('Export log message', { message }, 'executeExport');
        if (mainWindow) {
          mainWindow.webContents.send('output-log', message);
        }
      }
    };

    // Create and run the core exporter
    logger.logInfo('Creating LogosNotesExporter instance', {}, 'executeExport');
    const exporter = new LogosNotesExporter(coreOptions, callbacks);
    logger.logInfo('LogosNotesExporter created successfully', {}, 'executeExport');
    
    logger.logInfo('Starting core export process', {}, 'executeExport');
    const result = await exporter.export();
    logger.logInfo('Export completed successfully', { 
      success: result.success,
      outputPath: result.outputPath,
      hasError: !!result.error
    }, 'executeExport');

    // Convert core result to Electron result format
    return {
      success: result.success,
      outputPath: result.outputPath,
      error: result.error
    };
  } catch (error) {
    logger.logError('Core export process failed', { 
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error)
    }, 'executeExport');
    
    // Re-throw the error to be handled by the caller
    throw error;
  }
}