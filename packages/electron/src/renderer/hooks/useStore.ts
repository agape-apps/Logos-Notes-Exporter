import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AppState, ExportSettings, AppMode, ExportProgress, ExportResult } from '../types';

interface AppStore extends AppState {
  // Actions for updating state
  setMode: (mode: AppMode) => void;
  setSettings: (settings: Partial<ExportSettings>) => void;
  updateSettings: (updater: (settings: ExportSettings) => Partial<ExportSettings>) => void;
  resetSettings: () => void;
  
  // Export state actions
  setExporting: (isExporting: boolean) => void;
  setExportProgress: (progress: ExportProgress) => void;
  setExportResult: (result: ExportResult) => void;
  setOutputPath: (outputPath: string | undefined) => void;
  
  // Log management
  logMessages: string[];
  addLogMessage: (message: string) => void;
  clearLog: () => void;
  
  // UI state
  selectedDatabasePath: string | undefined;
  setSelectedDatabasePath: (path: string | undefined) => void;
}

import { DEFAULT_SETTINGS } from '../types';

export const useStore = create<AppStore>()(
  subscribeWithSelector((set, _get) => ({
    // Initial state
    mode: "basic",
    settings: DEFAULT_SETTINGS,
    isExporting: false,
    exportProgress: 0,
    exportMessage: "Ready to export...",
    outputPath: undefined as string | undefined,
    lastExportSuccess: false,
    logMessages: [],
    selectedDatabasePath: undefined as string | undefined,

    // Mode actions
    setMode: (mode) => set({ mode }),

    // Settings actions
    setSettings: (newSettings) =>
      set((state) => ({
        settings: { ...state.settings, ...newSettings },
      })),

    updateSettings: (updater) =>
      set((state) => ({
        settings: { ...state.settings, ...updater(state.settings) },
      })),

    resetSettings: () => set({ settings: DEFAULT_SETTINGS }),

    // Export state actions
    setExporting: (isExporting) => set({ isExporting }),

    setExportProgress: (progress) =>
      set({
        exportProgress: progress.progress,
        exportMessage: progress.message,
      }),

    setExportResult: (result) =>
      set({
        lastExportSuccess: result.success,
        outputPath: result.outputPath,
        isExporting: false,
        exportProgress: result.success ? 100 : 0,
        exportMessage: result.success
          ? "Export completed successfully!"
          : result.error || "Export failed",
      }),

    setOutputPath: (outputPath) => set({ outputPath }),

    // Log management
    addLogMessage: (message) =>
      set((state) => ({
        logMessages: [...state.logMessages, message],
      })),

    clearLog: () => set({ logMessages: [] }),

    // UI state
    setSelectedDatabasePath: (path) => set({ selectedDatabasePath: path }),
  }))
);

// Selector hooks for common state slices
export const useMode = () => useStore((state) => state.mode);
export const useSettings = () => useStore((state) => state.settings);
export const useExportState = () => useStore((state) => ({
  isExporting: state.isExporting,
  exportProgress: state.exportProgress,
  exportMessage: state.exportMessage,
  lastExportSuccess: state.lastExportSuccess,
  outputPath: state.outputPath,
}));
export const useLogMessages = () => useStore((state) => state.logMessages);

// Actions selectors
export const useAppActions = () => useStore((state) => ({
  setMode: state.setMode,
  setSettings: state.setSettings,
  updateSettings: state.updateSettings,
  resetSettings: state.resetSettings,
  setExporting: state.setExporting,
  setExportProgress: state.setExportProgress,
  setExportResult: state.setExportResult,
  setOutputPath: state.setOutputPath,
  addLogMessage: state.addLogMessage,
  clearLog: state.clearLog,
  setSelectedDatabasePath: state.setSelectedDatabasePath,
})); 