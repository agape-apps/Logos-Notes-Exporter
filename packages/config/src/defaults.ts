/**
 * Central Configuration Module - Single Source of Truth for Default Settings
 * 
 * This module centralizes all default settings to eliminate duplication across
 * CLI, Electron, and core packages. Any new settings should be added here first.
 */

// Declare global for TypeScript
declare const require: any;

/**
 * Get the default output directory path cross-platform (subfolder will be appended)
 * Returns user's Documents/ in Node.js environments (CLI, Electron main)
 * Returns fallback path in other contexts (Electron renderer with context isolation)
 */
function getDefaultOutputDirectory(): string {
  // Simple and reliable Node.js environment detection
  const hasNodeJSAccess = typeof require !== 'undefined' && 
                          typeof process !== 'undefined' && 
                          process.versions && 
                          process.versions.node;
  
  if (hasNodeJSAccess) {
    try {
      const os = require('os');
      const path = require('path');
      const fullPath = path.join(os.homedir(), 'Documents');
      console.log('📁 Using default output directory:', fullPath);
      return fullPath;
    } catch (error) {
      console.warn('⚠️  Failed to access Node.js modules. Using fallback path.');
      console.warn(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    // Context without Node.js access (e.g., Electron renderer with context isolation)
    console.log('📁 Using temporary default path (will be overridden by proper settings)');
  }
  
  // Fallback path
  console.log('📁 Temporary default output directory: ./Logos-Exported-Notes');
  return './Logos-Exported-Notes';
}

export const DEFAULT_CONFIG = {
  /** XAML to Markdown conversion settings */
  xaml: {
    /** Font sizes that correspond to heading levels [H1, H2, H3, H4, H5, H6] */
    headingSizes: [] as number[], // No longer used - we use ranges instead
    /** Font family name used to identify code elements */
    monospaceFontName: 'Courier New',
    /** Whether to ignore unknown elements */
    ignoreUnknownElements: true,
    /** Use HTML sub/superscript tags instead of Pandoc-style formatting */
    htmlSubSuperscript: false,
    /** Whether to download images locally */
    downloadImages: true,
    /** Maximum image download size in MB */
    maxImageSizeMB: 8,
    /** Download timeout in milliseconds */
    downloadTimeoutMs: 30000,
    /** Number of download retry attempts */
    downloadRetries: 3,
    /** Convert all indent levels to blockquotes instead of &nbsp; indentation */
    convertIndentsToQuotes: true,
    /** Optional logging callback for verbose output */
    onLog: undefined as ((message: string) => void) | undefined,
    /** Whether to enable verbose logging */
    verbose: false,
  },

  /** Markdown generation settings */
  markdown: {
    /** Include YAML frontmatter */
    includeFrontmatter: true,
    /** Include note metadata in content */
    includeMetadata: false,
    /** Include creation/modification dates */
    includeDates: true,
    /** Include note kind/type */
    includeKind: true,
    /** Include notebook information */
    includeNotebook: true,
    /** Custom frontmatter fields */
    customFields: {} as Record<string, unknown>,
    /** Date format for display */
    dateFormat: 'iso' as const,
    /** Whether to include note ID */
    includeId: false,
    /** Use HTML sub/superscript tags instead of Pandoc-style formatting */
    htmlSubSuperscript: false,
    /** Use indents with non-breaking spaces instead of blockquotes */
    indentsNotQuotes: false,
  },

  /** File organization and export settings */
  export: {
    /** Auto-detect database location */
    autoDetectDatabase: true,
    /** Default output directory - cross-platform user Documents folder */
    outputDirectory: getDefaultOutputDirectory(),
    /** Default subfolder name to create under the selected output directory */
    defaultSubfolderName: 'Logos-Exported-Notes',
    /** Organize notes by notebooks */
    organizeByNotebooks: true,
    /** Create date-based subdirectories */
    includeDateFolders: false,
    /** Create README.md index files */
    createIndexFiles: true,
    /** Skip highlight notes, export only text and annotation notes */
    skipHighlights: true,
    /** Preview mode - don't write files */
    dryRun: false,
  },

  /** UI and application settings */
  ui: {
    /** Default application mode */
    mode: 'basic' as const,
    /** Default window dimensions */
    windowSize: {
      width: 900,
      height: 700,
    },
  },
} as const;

/** Type-safe access to nested config values */
export type ConfigPath = {
  xaml: typeof DEFAULT_CONFIG.xaml;
  markdown: typeof DEFAULT_CONFIG.markdown;
  export: typeof DEFAULT_CONFIG.export;
  ui: typeof DEFAULT_CONFIG.ui;
};

/** Helper function to get default values for specific categories */
export const getDefaults = {
  xaml: () => ({ ...DEFAULT_CONFIG.xaml }),
  markdown: () => ({ ...DEFAULT_CONFIG.markdown }),
  export: () => ({ ...DEFAULT_CONFIG.export }),
  ui: () => ({ ...DEFAULT_CONFIG.ui }),
  all: () => ({ ...DEFAULT_CONFIG }),
} as const; 