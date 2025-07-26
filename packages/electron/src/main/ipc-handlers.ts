import * as path from 'path';
import * as fs from 'fs';
import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import {
  LogosExportError,
  DatabaseError,
  ValidationError,
  FileSystemError,
  Logger
} from '@logos-notes-exporter/core';
import { loadSettings, saveSettings, resetSettings } from './settings';
import { executeExport, getDefaultDatabasePath } from './export-handler';
import type { ChildProcess } from 'child_process';
import type { ExportSettings, ExportProgress, ExportResult, AppMode } from '../renderer/types';

// Create logger for IPC handlers
const logger = new Logger({ enableConsole: true, enableFile: false });

let exportInProgress = false;
let exportProcess: ChildProcess | null = null; // Process handle for export cancellation

/**
 * Enhanced error reporting to renderer process
 */
function reportErrorToRenderer(error: unknown, operation: string): void {
  const mainWindow = BrowserWindow.getFocusedWindow();
  if (!mainWindow) return;

  if (error instanceof LogosExportError) {
    // Structured error with user-friendly message and suggestions
    const errorDetails = {
      message: error.getUserMessage(),
      suggestions: error.context.suggestions || [],
      severity: error.severity,
      category: error.category
    };
    
    logger.logError(error, { operation }, 'IpcHandlers');
    mainWindow.webContents.send('structured-error', errorDetails);
    mainWindow.webContents.send('output-log', `❌ ${error.getUserMessage()}`);
    
    // Send suggestions as separate log entries
    if (error.context.suggestions) {
      error.context.suggestions.forEach(suggestion => {
        mainWindow.webContents.send('output-log', `💡 ${suggestion}`);
      });
    }
  } else {
    // Generic error handling
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.logError(`Operation failed: ${operation}`, { 
      errorMessage,
      operation 
    }, 'IpcHandlers');
    mainWindow.webContents.send('output-log', `❌ ${operation} failed: ${errorMessage}`);
  }
}

/**
 * Sets up all IPC handlers with enhanced error handling
 */
export function setupIpcHandlers(): void {
  logger.logInfo('Setting up IPC handlers with enhanced error handling', {}, 'setupIpcHandlers');
  
  // Settings operations
  ipcMain.handle('load-settings', async () => {
    logger.logDebug('Loading settings', {}, 'load-settings');
    try {
      const result = loadSettings();
      logger.logInfo('Settings loaded successfully', { hasSettings: !!result.settings }, 'load-settings');
      return result;
    } catch (error) {
      const fsError = new FileSystemError(
        'Failed to load application settings',
        undefined,
        'load-settings',
        { operation: 'load-settings' },
        error instanceof Error ? error : undefined
      );
      logger.logError(fsError, {}, 'load-settings');
      throw fsError;
    }
  });

  ipcMain.handle('save-settings', async (_, settings: ExportSettings) => {
    logger.logDebug('Saving settings', {}, 'save-settings');
    try {
      // Get current mode and window size from settings or defaults
      const currentSettings = loadSettings();
      saveSettings(settings, currentSettings.mode, currentSettings.windowSize);
      logger.logInfo('Settings saved successfully', {}, 'save-settings');
    } catch (error) {
      const fsError = new FileSystemError(
        'Failed to save application settings',
        undefined,
        'save-settings',
        { operation: 'save-settings' },
        error instanceof Error ? error : undefined
      );
      logger.logError(fsError, {}, 'save-settings');
      throw fsError;
    }
  });

  ipcMain.handle('save-mode', async (_, mode: AppMode) => {
    logger.logDebug('Saving application mode', { mode }, 'save-mode');
    try {
      // Get current settings and window size, update mode
      const currentSettings = loadSettings();
      saveSettings(currentSettings.settings, mode, currentSettings.windowSize);
      logger.logInfo('Application mode saved successfully', { mode }, 'save-mode');
    } catch (error) {
      const fsError = new FileSystemError(
        'Failed to save application mode',
        undefined,
        'save-mode',
        { operation: 'save-mode' },
        error instanceof Error ? error : undefined
      );
      logger.logError(fsError, {}, 'save-mode');
      throw fsError;
    }
  });

  ipcMain.handle('restore-defaults', async () => {
    logger.logInfo('Restoring default settings', {}, 'restore-defaults');
    try {
      resetSettings();
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        const loadedData = loadSettings();
        logger.logInfo('Settings restored to defaults successfully', { 
          outputDirectory: loadedData.settings.outputDirectory 
        }, 'restore-defaults');
        mainWindow.webContents.send('settings-loaded', loadedData.settings);
        mainWindow.webContents.send('output-log', '🔄 Settings restored to defaults');
      }
    } catch (error) {
      const fsError = new FileSystemError(
        'Failed to restore default settings',
        undefined,
        'restore-defaults',
        { operation: 'restore-defaults' },
        error instanceof Error ? error : undefined
      );
      reportErrorToRenderer(fsError, 'Restore defaults');
      throw fsError;
    }
  });

  // File system operations
  ipcMain.handle('select-output-directory', async () => {
    logger.logInfo('Opening output directory selection dialog', {}, 'select-output-directory');
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Output Directory',
        properties: ['openDirectory', 'createDirectory']
      });

      if (result.canceled || result.filePaths.length === 0) {
        logger.logInfo('Output directory selection cancelled', {}, 'select-output-directory');
        return null;
      }

      const selectedPath = result.filePaths[0];
      logger.logInfo('Output directory selected', { path: selectedPath }, 'select-output-directory');
      return selectedPath;
    } catch (error) {
      const fsError = new FileSystemError(
        'Failed to open directory selection dialog',
        undefined,
        'select-output-directory',
        { operation: 'select-output-directory' },
        error instanceof Error ? error : undefined
      );
      reportErrorToRenderer(fsError, 'Select output directory');
      return null;
    }
  });

  ipcMain.handle('open-output-folder', async (_, folderPath: string) => {
    logger.logInfo('Opening output folder', { path: folderPath }, 'open-output-folder');
    try {
      if (!fs.existsSync(folderPath)) {
        const error = new FileSystemError(
          'Output folder does not exist',
          folderPath,
          'open-output-folder',
          { operation: 'open-output-folder' }
        );
        reportErrorToRenderer(error, 'Open output folder');
        throw error;
      }

      await shell.openPath(folderPath);
      logger.logInfo('Output folder opened successfully', { path: folderPath }, 'open-output-folder');
    } catch (error) {
      if (error instanceof LogosExportError) {
        throw error;
      }
      
      const fsError = new FileSystemError(
        'Failed to open output folder',
        folderPath,
        'open-output-folder',
        { operation: 'open-output-folder' },
        error instanceof Error ? error : undefined
      );
      reportErrorToRenderer(fsError, 'Open output folder');
      throw fsError;
    }
  });

  // Database operations
  ipcMain.handle('detect-database', async () => {
    logger.logInfo('Starting database detection', {}, 'detect-database');
    
    try {
      const defaultPath = getDefaultDatabasePath();
      logger.logInfo('Database detection completed', { 
        found: !!defaultPath,
        path: defaultPath 
      }, 'detect-database');
      
      if (defaultPath) {
        const mainWindow = BrowserWindow.getFocusedWindow();
        if (mainWindow) {
          mainWindow.webContents.send('database-detected', defaultPath);
          mainWindow.webContents.send('output-log', `🔍 Database detected: ${path.basename(defaultPath)}`);
        }
      }
      return defaultPath;
    } catch (error) {
      const dbError = new DatabaseError(
        'Failed to detect database locations',
        { operation: 'detect-database' },
        error instanceof Error ? error : undefined
      );
      reportErrorToRenderer(dbError, 'Database detection');
      return null;
    }
  });

  // Add new handler for database state synchronization
  ipcMain.handle('sync-database-state', async (_, databasePath: string) => {
    logger.logInfo('Synchronizing database state', { path: databasePath }, 'sync-database-state');
    
    try {
      // Validate the database path exists and is accessible
      if (!databasePath || !fs.existsSync(databasePath)) {
        const error = new ValidationError(
          'Database path does not exist',
          'databasePath',
          databasePath,
          { operation: 'sync-database-state' }
        );
        logger.logError(error, {}, 'sync-database-state');
        return { success: false, error: error.getUserMessage() };
      }

      // Validate it's a valid database file
      if (!databasePath.endsWith('.db')) {
        const error = new ValidationError(
          'File does not appear to be a database',
          'databasePath',
          databasePath,
          { operation: 'sync-database-state' }
        );
        logger.logError(error, {}, 'sync-database-state');
        return { success: false, error: error.getUserMessage() };
      }

      logger.logInfo('Database state synchronized successfully', { path: databasePath }, 'sync-database-state');
      
      // Send confirmation back to renderer with a single, clear message
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        mainWindow.webContents.send('database-detected', databasePath);
        mainWindow.webContents.send('output-log', `🔄 Database reconnected after reload`);
      }
      
      return { success: true, path: databasePath };
    } catch (error) {
      const dbError = new DatabaseError(
        'Failed to synchronize database state',
        { operation: 'sync-database-state' },
        error instanceof Error ? error : undefined
      );
      logger.logError(dbError, {}, 'sync-database-state');
      const errorMessage = dbError.getUserMessage();
      return { success: false, error: errorMessage };
    }
  });

  // File selection operations
  ipcMain.handle('select-database', async () => {
    logger.logInfo('Opening database selection dialog', {}, 'select-database');
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Logos Database File',
        filters: [
          { name: 'SQLite Database', extensions: ['db'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        
        logger.logInfo('Database file selected', { 
          path: selectedPath,
          isNotesTool: path.basename(selectedPath) === 'notestool.db'
        }, 'select-database');
        
        // Validate that this is likely a notestool database
        if (path.basename(selectedPath) === 'notestool.db') {
          const mainWindow = BrowserWindow.getFocusedWindow();
          if (mainWindow) {
            mainWindow.webContents.send('output-log', `📁 Selected database: ${selectedPath}`);
          }
          return selectedPath;
        } else {
          // Show warning but allow selection
          const mainWindow = BrowserWindow.getFocusedWindow();
          if (mainWindow) {
            mainWindow.webContents.send('output-log', '⚠️ Selected file may not be a Logos NotesTool database');
            mainWindow.webContents.send('output-log', `📁 Selected database: ${selectedPath}`);
          }
          return selectedPath;
        }
      }
      
      logger.logInfo('Database selection cancelled', {}, 'select-database');
      return null;
    } catch (error) {
      const fsError = new FileSystemError(
        'Failed to open database selection dialog',
        undefined,
        'select-database',
        { operation: 'select-database' },
        error instanceof Error ? error : undefined
      );
      reportErrorToRenderer(fsError, 'Select database');
      throw fsError;
    }
  });

  // Export operations
  ipcMain.handle('start-export', async (_, settings: ExportSettings) => {
    logger.logInfo('Export request received', {
      hasDatabasePath: !!settings.databasePath,
      hasOutputDir: !!settings.outputDirectory,
      autoDetect: settings.autoDetectDatabase
    }, 'start-export');

    if (exportInProgress) {
      const error = new ValidationError(
        'Export already in progress',
        'exportState',
        'in_progress',
        { operation: 'start-export' }
      );
      logger.logError(error, {}, 'start-export');
      throw error;
    }

    try {
      exportInProgress = true;
      logger.logInfo('Export process started', {}, 'start-export');
      
      const mainWindow = BrowserWindow.getFocusedWindow();
      
      if (mainWindow) {
        // Send initial progress
        const progress: ExportProgress = { progress: 0, message: 'Initializing export...' };
        mainWindow.webContents.send('export-progress', progress);
        mainWindow.webContents.send('output-log', '🚀 Starting export process...');
      }

      // Execute export using the enhanced export handler
      logger.logInfo('Calling enhanced export handler', {}, 'start-export');
      const result = await executeExport(settings, mainWindow);
      logger.logInfo('Export completed', { 
        success: result.success,
        hasError: !!result.error 
      }, 'start-export');
      
      if (mainWindow) {
        mainWindow.webContents.send('export-complete', result);
        if (result.success) {
          mainWindow.webContents.send('output-log', '✅ Export completed successfully!');
        }
      }
      
      return result;
    } catch (error) {
      logger.logError('Export process failed', {
        errorType: error instanceof Error ? error.constructor.name : typeof error
      }, 'start-export');
      
      const mainWindow = BrowserWindow.getFocusedWindow();
      
      if (error instanceof LogosExportError) {
        // Structured error handling
        reportErrorToRenderer(error, 'Export');
        if (mainWindow) {
          const result: ExportResult = {
            success: false,
            error: error.getUserMessage()
          };
          mainWindow.webContents.send('export-complete', result);
        }
      } else {
        // Generic error handling
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (mainWindow) {
          mainWindow.webContents.send('export-error', errorMessage);
          mainWindow.webContents.send('output-log', `❌ Export failed: ${errorMessage}`);
          const result: ExportResult = {
            success: false,
            error: errorMessage
          };
          mainWindow.webContents.send('export-complete', result);
        }
      }
      
      throw error;
    } finally {
      exportInProgress = false;
      exportProcess = null;
      logger.logInfo('Export process cleanup completed', {}, 'start-export');
    }
  });

  ipcMain.handle('cancel-export', async () => {
    if (!exportInProgress) {
      logger.logInfo('Cancel export requested but no export in progress', {}, 'cancel-export');
      return;
    }

    logger.logInfo('Cancelling export process', {}, 'cancel-export');
    try {
      if (exportProcess && exportProcess.kill) {
        exportProcess.kill();
        logger.logInfo('Export process killed', {}, 'cancel-export');
      }
      
      exportInProgress = false;
      exportProcess = null;
      
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        mainWindow.webContents.send('output-log', '🛑 Export cancelled by user');
        
        const result: ExportResult = {
          success: false,
          error: 'Export cancelled by user'
        };
        mainWindow.webContents.send('export-complete', result);
      }
      
      logger.logInfo('Export cancellation completed', {}, 'cancel-export');
    } catch (error) {
      const exportError = new LogosExportError(
        'Failed to cancel export process',
        'ERROR' as any,
        'EXPORT' as any,
        { operation: 'cancel-export' },
        error instanceof Error ? error : undefined
      );
      logger.logError(exportError, {}, 'cancel-export');
      throw exportError;
    }
  });
  
  logger.logInfo('IPC handlers setup completed', {}, 'setupIpcHandlers');
}