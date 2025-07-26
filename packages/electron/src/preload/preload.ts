import { contextBridge, ipcRenderer } from 'electron';
import type { ExportSettings, MainToRenderer } from '../renderer/types';

// Expose IPC API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Export operations
  startExport: (settings: ExportSettings) => ipcRenderer.invoke('start-export', settings),
  cancelExport: () => ipcRenderer.invoke('cancel-export'),
  
  // File system operations
  selectDatabase: () => ipcRenderer.invoke('select-database'),
  selectOutputDirectory: () => ipcRenderer.invoke('select-output-directory'),
  openOutputFolder: (path: string) => ipcRenderer.invoke('open-output-folder', path),
  
  // Settings operations
  saveSettings: (settings: ExportSettings) => ipcRenderer.invoke('save-settings', settings),
  saveMode: (mode: string) => ipcRenderer.invoke('save-mode', mode),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  restoreDefaults: () => ipcRenderer.invoke('restore-defaults'),
  
  // Database operations
  detectDatabase: () => ipcRenderer.invoke('detect-database'),
  syncDatabaseState: (databasePath: string) => ipcRenderer.invoke('sync-database-state', databasePath),
  
  // Event listeners for main → renderer communication
  onExportProgress: (callback: MainToRenderer['export-progress']) => {
    ipcRenderer.on('export-progress', (_, progress) => callback(progress));
    return () => ipcRenderer.removeAllListeners('export-progress');
  },
  
  onExportComplete: (callback: MainToRenderer['export-complete']) => {
    ipcRenderer.on('export-complete', (_, result) => callback(result));
    return () => ipcRenderer.removeAllListeners('export-complete');
  },
  
  onExportError: (callback: MainToRenderer['export-error']) => {
    ipcRenderer.on('export-error', (_, error) => callback(error));
    return () => ipcRenderer.removeAllListeners('export-error');
  },
  
  onSettingsLoaded: (callback: MainToRenderer['settings-loaded']) => {
    ipcRenderer.on('settings-loaded', (_, settings) => callback(settings));
    return () => ipcRenderer.removeAllListeners('settings-loaded');
  },
  
  onDatabaseDetected: (callback: MainToRenderer['database-detected']) => {
    ipcRenderer.on('database-detected', (_, path) => callback(path));
    return () => ipcRenderer.removeAllListeners('database-detected');
  },
  
  onOutputLog: (callback: MainToRenderer['output-log']) => {
    ipcRenderer.on('output-log', (_, message) => callback(message));
    return () => ipcRenderer.removeAllListeners('output-log');
  },

  onStructuredError: (callback: MainToRenderer['structured-error']) => {
    ipcRenderer.on('structured-error', (_, error) => callback(error));
    return () => ipcRenderer.removeAllListeners('structured-error');
  },
});

// Type definition for the exposed API
declare global {
  interface Window {
    electronAPI: {
      // Export operations
      startExport: (settings: ExportSettings) => Promise<void>;
      cancelExport: () => Promise<void>;
      
      // File system operations
      selectDatabase: () => Promise<string | null>;
      selectOutputDirectory: () => Promise<string | null>;
      openOutputFolder: (path: string) => Promise<void>;
      
      // Settings operations
      saveSettings: (settings: ExportSettings) => Promise<void>;
      saveMode: (mode: string) => Promise<void>;
      loadSettings: () => Promise<{ settings: ExportSettings; mode: string; windowSize: { width: number; height: number } }>;
      restoreDefaults: () => Promise<void>;
      
      // Database operations
      detectDatabase: () => Promise<string | null>;
      syncDatabaseState: (databasePath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      
      // Event listeners
      onExportProgress: (callback: MainToRenderer['export-progress']) => () => void;
      onExportComplete: (callback: MainToRenderer['export-complete']) => () => void;
      onExportError: (callback: MainToRenderer['export-error']) => () => void;
      onSettingsLoaded: (callback: MainToRenderer['settings-loaded']) => () => void;
      onDatabaseDetected: (callback: MainToRenderer['database-detected']) => () => void;
      onOutputLog: (callback: MainToRenderer['output-log']) => () => void;
      onStructuredError: (callback: MainToRenderer['structured-error']) => () => void;
    };
  }
}
