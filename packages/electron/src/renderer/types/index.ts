// Export Settings Types
export interface ExportSettings {
  // Database
  databasePath?: string;
  autoDetectDatabase: boolean;

  // Output
  outputDirectory: string;
  organizeByNotebooks: boolean;
  includeDateFolders: boolean;
  createIndexFiles: boolean;
  skipHighlights: boolean;

  // Markdown
  includeFrontmatter: boolean;
  includeMetadata: boolean;
  includeDates: boolean;
  includeNotebook: boolean;
  includeId: boolean;
  dateFormat: "iso" | "locale" | "short";

  // Processing
  htmlSubSuperscript: boolean;
  indentsNotQuotes: boolean;
  dryRun: boolean;
}

// Application State Types
export type AppMode = "basic" | "advanced";

export interface AppState {
  mode: AppMode;
  settings: ExportSettings;
  isExporting: boolean;
  exportProgress: number;
  exportMessage: string;
  outputPath?: string;
  lastExportSuccess: boolean;
  errorState: ErrorDisplayState;
}

// Export Status Types
export interface ExportProgress {
  progress: number;
  message: string;
}

export interface ExportResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

// Enhanced Error Handling Types
export interface StructuredError {
  message: string;
  suggestions: string[];
  severity: 'info' | 'warn' | 'error' | 'fatal';
  category: string;
}

export interface ErrorDisplayState {
  currentError?: StructuredError;
  errorHistory: StructuredError[];
  showErrorDetails: boolean;
}

// IPC Communication Types

// Main → Renderer Events
export interface MainToRenderer {
  "export-progress": (progress: ExportProgress) => void;
  "export-complete": (result: ExportResult) => void;
  "export-error": (error: string) => void;
  "structured-error": (error: StructuredError) => void;
  "settings-loaded": (settings: ExportSettings) => void;
  "database-detected": (path: string) => void;
  "output-log": (message: string) => void;
}

// Renderer → Main Events
export interface RendererToMain {
  "start-export": (settings: ExportSettings) => void;
  "cancel-export": () => void;
  "select-database": () => Promise<string | null>;
  "select-output-directory": () => Promise<string | null>;
  "open-output-folder": (path: string) => void;
  "save-settings": (settings: ExportSettings) => void;
  "load-settings": () => void;
  "restore-defaults": () => void;
  "detect-database": () => void;
}

// Settings Persistence Types
export interface SettingsFile {
  version: string;
  database: {
    autoDetect: boolean;
    customPath?: string;
  };
  output: {
    directory: string;
    organizeByNotebooks: boolean;
    includeDateFolders: boolean;
    createIndexFiles: boolean;
    skipHighlights: boolean;
  };
  markdown: {
    includeFrontmatter: boolean;
    includeMetadata: boolean;
    includeDates: boolean;
    includeNotebook: boolean;
    includeId: boolean;
    dateFormat: "iso" | "locale" | "short";
    indentsNotQuotes: boolean;
  };
  processing: {
    htmlSubSuperscript: boolean;
    dryRun: boolean;
  };
  ui: {
    mode: AppMode;
    windowSize: {
      width: number;
      height: number;
    };
  };
}

import { DEFAULT_CONFIG } from '@logos-notes-exporter/config';

// Default Settings
export const DEFAULT_SETTINGS: ExportSettings = {
  autoDetectDatabase: DEFAULT_CONFIG.export.autoDetectDatabase,
  outputDirectory: DEFAULT_CONFIG.export.outputDirectory,
  organizeByNotebooks: DEFAULT_CONFIG.export.organizeByNotebooks,
  includeDateFolders: DEFAULT_CONFIG.export.includeDateFolders,
  createIndexFiles: DEFAULT_CONFIG.export.createIndexFiles,
  skipHighlights: DEFAULT_CONFIG.export.skipHighlights,
  includeFrontmatter: DEFAULT_CONFIG.markdown.includeFrontmatter,
  includeMetadata: DEFAULT_CONFIG.markdown.includeMetadata,
  includeDates: DEFAULT_CONFIG.markdown.includeDates,
  includeNotebook: DEFAULT_CONFIG.markdown.includeNotebook,
  includeId: DEFAULT_CONFIG.markdown.includeId,
  dateFormat: DEFAULT_CONFIG.markdown.dateFormat,
  htmlSubSuperscript: DEFAULT_CONFIG.markdown.htmlSubSuperscript,
  indentsNotQuotes: DEFAULT_CONFIG.markdown.indentsNotQuotes,
  dryRun: DEFAULT_CONFIG.export.dryRun,
};

export const DEFAULT_APP_STATE: AppState = {
  mode: "basic",
  settings: DEFAULT_SETTINGS,
  isExporting: false,
  exportProgress: 0,
  exportMessage: "Ready to export...",
  lastExportSuccess: false,
  errorState: {
    errorHistory: [],
    showErrorDetails: false,
  },
};