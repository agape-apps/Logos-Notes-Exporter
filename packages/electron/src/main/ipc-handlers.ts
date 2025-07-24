import * as path from 'path';
import * as fs from 'fs';
import type { ChildProcess } from 'child_process';
import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import type { ExportSettings, ExportProgress, ExportResult, AppMode } from '../renderer/types';
import { loadSettings, saveSettings, resetSettings } from './settings';
import { executeExport, getDefaultDatabasePath } from './export-handler';

let exportInProgress = false;
let exportProcess: ChildProcess | null = null; // Process handle for export cancellation

/**
 * Sets up all IPC handlers for communication with renderer process
 */
export function setupIpcHandlers(): void {
  console.log('Setting up IPC handlers');
  // Settings operations
  ipcMain.handle('load-settings', async () => {
    try {
      return loadSettings();
    } catch (error) {
      console.error('Error loading settings:', error);
      throw error;
    }
  });

  ipcMain.handle('save-settings', async (_, settings: ExportSettings) => {
    try {
      // Get current mode and window size from settings or defaults
      const currentSettings = loadSettings();
      saveSettings(settings, currentSettings.mode, currentSettings.windowSize);
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  });

  ipcMain.handle('save-mode', async (_, mode: AppMode) => {
    try {
      // Get current settings and window size, update mode
      const currentSettings = loadSettings();
      saveSettings(currentSettings.settings, mode, currentSettings.windowSize);
    } catch (error) {
      console.error('Error saving mode:', error);
      throw error;
    }
  });

  ipcMain.handle('restore-defaults', async () => {
    try {
      resetSettings();
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        const loadedData = loadSettings();
        mainWindow.webContents.send('settings-loaded', loadedData.settings);
      }
    } catch (error) {
      console.error('Error restoring defaults:', error);
      throw error;
    }
  });

  // File system operations
  ipcMain.handle('select-output-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Output Directory',
        properties: ['openDirectory', 'createDirectory']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0];
    } catch (error) {
      console.error('Error selecting output directory:', error);
      return null;
    }
  });

  ipcMain.handle('open-output-folder', async (_, folderPath: string) => {
    try {
      if (fs.existsSync(folderPath)) {
        await shell.openPath(folderPath);
      } else {
        throw new Error('Folder does not exist');
      }
    } catch (error) {
      console.error('Error opening output folder:', error);
      throw error;
    }
  });

  // Database operations
  ipcMain.handle('detect-database', async () => {
    console.log('Detect database IPC: Starting detection');
    
    try {
      const defaultPath = getDefaultDatabasePath();
      console.log('Detect database result:', defaultPath ? `Found: ${defaultPath}` : 'Not found');
      
      if (defaultPath) {
        const mainWindow = BrowserWindow.getFocusedWindow();
        if (mainWindow) {
          console.log('Sending database-detected event to renderer');
          mainWindow.webContents.send('database-detected', defaultPath);
        }
      }
      return defaultPath;
    } catch (error) {
      console.error('Detect database error:', error);
      return null;
    }
  });

  // Add new handler for database state synchronization
  ipcMain.handle('sync-database-state', async (_, databasePath: string) => {
    console.log('Sync database state: Received path:', databasePath);
    
    try {
      // Validate the database path exists and is accessible
      if (!databasePath || !fs.existsSync(databasePath)) {
        console.log('Sync database state: Database path does not exist:', databasePath);
        return { success: false, error: 'Database path does not exist' };
      }

      // Validate it's a valid database file
      if (!databasePath.endsWith('.db')) {
        console.log('Sync database state: File does not appear to be a database:', databasePath);
        return { success: false, error: 'File does not appear to be a database' };
      }

      console.log('Sync database state: Database path validated successfully');
      
      // Send confirmation back to renderer with a single, clear message
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        console.log('Sync database state: Sending database-detected event to renderer');
        mainWindow.webContents.send('database-detected', databasePath);
        mainWindow.webContents.send('output-log', `🔄 Database reconnected after reload`);
      }
      
      return { success: true, path: databasePath };
    } catch (error) {
      console.error('Sync database state error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  // File selection operations
  ipcMain.handle('select-database', async () => {
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
        
        // Validate that this is likely a notestool database
        if (path.basename(selectedPath) === 'notestool.db') {
          return selectedPath;
        } else {
          // Show warning but allow selection
          const mainWindow = BrowserWindow.getFocusedWindow();
          if (mainWindow) {
            mainWindow.webContents.send('output-log', '⚠️ Selected file may not be a Logos NotesTool database');
          }
          return selectedPath;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error selecting database:', error);
      throw error;
    }
  });

  // Export operations
  ipcMain.handle('start-export', async (_, settings: ExportSettings) => {
    console.log('Export request received');
    console.log('Export settings:', {
      databasePath: settings.databasePath,
      outputDirectory: settings.outputDirectory,
      autoDetectDatabase: settings.autoDetectDatabase
    });

    if (exportInProgress) {
      const errorMsg = 'Export already in progress';
      console.log('Export blocked:', errorMsg);
      throw new Error(errorMsg);
    }

    try {
      exportInProgress = true;
      console.log('Export started');
      
      const mainWindow = BrowserWindow.getFocusedWindow();
      
      if (mainWindow) {
        // Send initial progress
        const progress: ExportProgress = { progress: 0, message: 'Initializing export...' };
        mainWindow.webContents.send('export-progress', progress);
      }

      // Execute export using the export handler
      console.log('Calling export handler');
      const result = await executeExport(settings, mainWindow);
      console.log('Export result:', result);
      
      if (mainWindow) {
        mainWindow.webContents.send('export-complete', result);
      }
      
    } catch (error) {
      console.error('Export error:', error);
      const mainWindow = BrowserWindow.getFocusedWindow();
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (mainWindow) {
        mainWindow.webContents.send('export-error', errorMessage);
        mainWindow.webContents.send('output-log', `❌ Export failed: ${errorMessage}`);
      }
      throw error;
    } finally {
      exportInProgress = false;
      exportProcess = null;
      console.log('Export finished - resetting flags');
    }
  });

  ipcMain.handle('cancel-export', async () => {
    if (!exportInProgress) {
      return;
    }

    try {
      if (exportProcess && exportProcess.kill) {
        exportProcess.kill();
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
    } catch (error) {
      console.error('Error cancelling export:', error);
      throw error;
    }
  });
}

 