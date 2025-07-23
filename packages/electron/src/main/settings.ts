import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import * as yaml from 'yaml';
import { DEFAULT_CONFIG } from '@logos-notes-exporter/config';
import type { ExportSettings, SettingsFile, AppMode } from '../renderer/types';

const SETTINGS_FILE_NAME = 'settings.yaml';
const SETTINGS_VERSION = '1.0';

/**
 * Gets the path to the settings file in the userData directory
 */
function getSettingsPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, SETTINGS_FILE_NAME);
}

/**
 * Creates default settings file structure
 */
function createDefaultSettingsFile(settings: ExportSettings, mode: AppMode = 'basic'): SettingsFile {
  return {
    version: SETTINGS_VERSION,
    database: {
      autoDetect: settings.autoDetectDatabase,
      customPath: settings.databasePath,
    },
    output: {
      directory: settings.outputDirectory,
      organizeByNotebooks: settings.organizeByNotebooks,
      includeDateFolders: settings.includeDateFolders,
      createIndexFiles: settings.createIndexFiles,
      skipHighlights: settings.skipHighlights,
    },
    markdown: {
      includeFrontmatter: settings.includeFrontmatter,
      includeMetadata: settings.includeMetadata,
      includeDates: settings.includeDates,
      includeNotebook: settings.includeNotebook,
      includeId: settings.includeId,
      dateFormat: settings.dateFormat,
      indentsNotQuotes: settings.indentsNotQuotes,
    },
    processing: {
      htmlSubSuperscript: settings.htmlSubSuperscript,
      dryRun: settings.dryRun,
    },
    ui: {
      mode: mode,
      windowSize: DEFAULT_CONFIG.ui.windowSize,
    },
  };
}

/**
 * Converts SettingsFile to ExportSettings format
 */
function settingsFileToExportSettings(settingsFile: SettingsFile): ExportSettings {
  return {
    databasePath: settingsFile.database.customPath,
    autoDetectDatabase: settingsFile.database.autoDetect ?? true,
    outputDirectory: settingsFile.output.directory || DEFAULT_CONFIG.export.outputDirectory,
    organizeByNotebooks: settingsFile.output.organizeByNotebooks ?? true,
    includeDateFolders: settingsFile.output.includeDateFolders ?? false,
    createIndexFiles: settingsFile.output.createIndexFiles ?? true,
    skipHighlights: settingsFile.output.skipHighlights ?? true,
    includeFrontmatter: settingsFile.markdown.includeFrontmatter ?? true,
    includeMetadata: settingsFile.markdown.includeMetadata ?? false,
    includeDates: settingsFile.markdown.includeDates ?? true,
    includeNotebook: settingsFile.markdown.includeNotebook ?? true,
    includeId: settingsFile.markdown.includeId ?? false,
    dateFormat: settingsFile.markdown.dateFormat || 'iso',
    htmlSubSuperscript: settingsFile.processing.htmlSubSuperscript ?? false,
    indentsNotQuotes: settingsFile.markdown.indentsNotQuotes ?? false,
    dryRun: settingsFile.processing.dryRun ?? false,
  };
}

/**
 * Loads settings from the YAML file, returns default settings if file doesn't exist
 */
export function loadSettings(): { settings: ExportSettings; mode: AppMode; windowSize: { width: number; height: number } } {
  const settingsPath = getSettingsPath();
  
  try {
    if (!fs.existsSync(settingsPath)) {
      console.log('Settings file does not exist, using defaults');
      const defaultSettings: ExportSettings = {
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
      
      return {
        settings: defaultSettings,
        mode: DEFAULT_CONFIG.ui.mode,
        windowSize: DEFAULT_CONFIG.ui.windowSize,
      };
    }

    const fileContent = fs.readFileSync(settingsPath, 'utf8');
    const settingsFile: SettingsFile = yaml.parse(fileContent);
    
    // Validate version and migrate if necessary
    if (settingsFile.version !== SETTINGS_VERSION) {
      console.log('Settings version mismatch, migrating...');
      // Add migration logic here if needed in the future
    }

    return {
      settings: settingsFileToExportSettings(settingsFile),
      mode: settingsFile.ui.mode,
      windowSize: settingsFile.ui.windowSize,
    };
  } catch (error) {
    console.error('Error loading settings:', error);
    // Return defaults on error
    const defaultSettings: ExportSettings = {
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
    
    return {
      settings: defaultSettings,
      mode: DEFAULT_CONFIG.ui.mode,
      windowSize: DEFAULT_CONFIG.ui.windowSize,
    };
  }
}

/**
 * Saves settings to the YAML file
 */
export function saveSettings(settings: ExportSettings, mode: AppMode, windowSize?: { width: number; height: number }): void {
  const settingsPath = getSettingsPath();
  
  try {
    // Ensure the userData directory exists
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    const currentWindowSize = windowSize || DEFAULT_CONFIG.ui.windowSize;
    const settingsFile = createDefaultSettingsFile(settings, mode);
    settingsFile.ui.windowSize = currentWindowSize;
    
    const yamlContent = yaml.stringify(settingsFile);
    fs.writeFileSync(settingsPath, yamlContent, 'utf8');
    
    console.log('Settings saved successfully');
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}



/**
 * Deletes the settings file (for reset functionality)
 */
export function resetSettings(): void {
  const settingsPath = getSettingsPath();
  
  try {
    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
      console.log('Settings file deleted successfully');
    }
  } catch (error) {
    console.error('Error deleting settings file:', error);
    throw error;
  }
} 