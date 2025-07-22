import { existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

export interface DatabaseLocation {
  /** Full path to the database file */
  path: string;
  /** Location type */
  type: 'development' | 'windows' | 'macos' | 'custom';
  /** Human-readable description */
  description: string;
  /** Whether the file exists */
  exists: boolean;
  /** File size if it exists */
  size?: number;
  /** Last modified date if it exists */
  lastModified?: Date;
}

export interface CatalogLocation {
  /** Full path to the catalog database file */
  path: string;
  /** Whether the file exists */
  exists: boolean;
  /** File size if it exists */
  size?: number;
  /** Last modified date if it exists */
  lastModified?: Date;
}

export class DatabaseLocator {
  private static readonly DATABASE_FILENAME = 'notestool.db';
  private static readonly SUBDIRECTORY = 'NotesToolManager';
  private static readonly CATALOG_FILENAME = 'catalog.db';
  private static readonly CATALOG_SUBDIRECTORY = 'LibraryCatalog';

  /**
   * Find all possible Logos NotesTool database locations
   */
  public static findDatabases(): DatabaseLocation[] {
    const locations: DatabaseLocation[] = [];

    // 1. Development/Current directory location (current default)
    const devPath = join('LogosDocuments', this.SUBDIRECTORY, this.DATABASE_FILENAME);
    locations.push(this.createLocation(devPath, 'development', 'Development location (current working directory)'));

    // 2. Platform-specific standard locations
    const platform = process.platform;
    
    if (platform === 'win32') {
      locations.push(...this.findWindowsLocations());
    } else if (platform === 'darwin') {
      locations.push(...this.findMacOSLocations());
    }

    // Sort by existence and file size (prioritize existing, larger files)
    return locations.sort((a, b) => {
      if (a.exists && !b.exists) return -1;
      if (!a.exists && b.exists) return 1;
      if (a.exists && b.exists) {
        return (b.size || 0) - (a.size || 0);
      }
      return 0;
    });
  }

  /**
   * Get the best database location (first existing one)
   */
  public static getBestDatabase(): DatabaseLocation | null {
    const locations = this.findDatabases();
    return locations.find(loc => loc.exists) || null;
  }

  /**
   * Find database in custom path
   */
  public static checkCustomPath(customPath: string): DatabaseLocation | null {
    if (!customPath) return null;

    // If it's a directory, look for the database file inside
    let fullPath = customPath;
    if (existsSync(customPath) && statSync(customPath).isDirectory()) {
      fullPath = join(customPath, this.DATABASE_FILENAME);
    }

    return this.createLocation(fullPath, 'custom', `Custom path: ${customPath}`);
  }

  /**
   * Find Windows Logos installations
   */
  private static findWindowsLocations(): DatabaseLocation[] {
    const locations: DatabaseLocation[] = [];
    
    // Check LOCALAPPDATA environment variable
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) return locations;

    const logosPath = join(localAppData, 'Logos', 'Documents');
    return this.searchRandomIdDirectories(logosPath, 'windows', 'Windows Logos installation');
  }

  /**
   * Find macOS Logos installations
   */
  private static findMacOSLocations(): DatabaseLocation[] {
    const logosPath = join(homedir(), 'Library', 'Application Support', 'Logos4', 'Documents');
    return this.searchRandomIdDirectories(logosPath, 'macos', 'macOS Logos installation');
  }

  /**
   * Search for random ID directories containing the database
   */
  private static searchRandomIdDirectories(basePath: string, type: DatabaseLocation['type'], description: string): DatabaseLocation[] {
    const locations: DatabaseLocation[] = [];

    if (!existsSync(basePath)) return locations;

    try {
      const entries = readdirSync(basePath);
      
      for (const entry of entries) {
        const entryPath = join(basePath, entry);
        
        // Check if it's a directory (likely a random ID)
        if (statSync(entryPath).isDirectory()) {
          const dbPath = join(entryPath, this.SUBDIRECTORY, this.DATABASE_FILENAME);
          
          if (existsSync(dbPath)) {
            locations.push(this.createLocation(
              dbPath, 
              type, 
              `${description} (${entry})`
            ));
          }
        }
      }
    } catch {
      // Ignore directory read errors (permissions, etc.)
    }

    return locations;
  }

  /**
   * Create a database location object with metadata
   */
  private static createLocation(path: string, type: DatabaseLocation['type'], description: string): DatabaseLocation {
    const fullPath = resolve(path);
    const exists = existsSync(fullPath);
    
    let size: number | undefined;
    let lastModified: Date | undefined;
    
    if (exists) {
      try {
        const stats = statSync(fullPath);
        size = stats.size;
        lastModified = stats.mtime;
      } catch {
        // Ignore stat errors
      }
    }

    return {
      path: fullPath,
      type,
      description,
      exists,
      size,
      lastModified
    };
  }

  /**
   * Validate that a database file is readable and appears to be a valid SQLite database
   */
  public static validateDatabase(path: string): { valid: boolean; error?: string; info?: string } {
    if (!existsSync(path)) {
      return { valid: false, error: 'Database file does not exist' };
    }

    try {
      const stats = statSync(path);
      
      if (stats.size === 0) {
        return { valid: false, error: 'Database file is empty' };
      }

      if (stats.size < 1024) {
        return { valid: false, error: 'Database file is too small (likely corrupted)' };
      }

      // Basic SQLite file signature check
      // SQLite files start with "SQLite format 3\000"
      const buffer = Buffer.alloc(16);
      const fd = openSync(path, 'r');
      
      try {
        readSync(fd, buffer, 0, 16, 0);
        const signature = buffer.toString('ascii', 0, 15);
        
        if (!signature.startsWith('SQLite format 3')) {
          return { valid: false, error: 'File does not appear to be a valid SQLite database' };
        }
      } finally {
        closeSync(fd);
      }

      return { 
        valid: true, 
        info: `Valid SQLite database (${(stats.size / 1024 / 1024).toFixed(1)} MB, modified ${stats.mtime.toISOString()})` 
      };
      
    } catch (error) {
      return { valid: false, error: `Failed to validate database: ${error}` };
    }
  }

  /**
   * Display all found database locations for debugging
   */
  public static displayLocations(): string[] {
    const locations = this.findDatabases();
    const lines: string[] = [];

    lines.push('🔍 Searching for Logos NotesTool databases...\n');

    if (locations.length === 0) {
      lines.push('❌ No database locations found');
      return lines;
    }

    for (const [index, location] of locations.entries()) {
      const status = location.exists ? '✅' : '❌';
      const sizeInfo = location.size ? ` (${(location.size / 1024 / 1024).toFixed(1)} MB)` : '';
      const dateInfo = location.lastModified ? ` - ${location.lastModified.toLocaleDateString()}` : '';
      
      lines.push(`${status} [${index + 1}] ${location.description}`);
      lines.push(`    ${location.path}${sizeInfo}${dateInfo}`);
      
      if (location.exists && index === 0) {
        lines.push('    👆 This database will be used by default');
      }
      lines.push('');
    }

    return lines;
  }

  /**
   * Get platform-specific search instructions for manual database location
   */
  public static getSearchInstructions(): string[] {
    const platform = process.platform;
    const lines: string[] = [];

    lines.push('📋 Manual Database Location Instructions:\n');

    if (platform === 'win32') {
      lines.push('Windows:');
      lines.push('1. Open File Explorer');
      lines.push('2. Navigate to: %LOCALAPPDATA%\\Logos\\Documents');
      lines.push('3. Look for a directory with a random ID (e.g., "abc123def456...")');
      lines.push('4. Inside that directory, look for: NotesToolManager\\notestool.db');
      lines.push('');
      lines.push('Example path:');
      lines.push('C:\\Users\\YourName\\AppData\\Local\\Logos\\Documents\\{random-id}\\NotesToolManager\\notestool.db');
    } else if (platform === 'darwin') {
      lines.push('macOS:');
      lines.push('1. Open Finder');
      lines.push('2. Press Cmd+Shift+G (Go to Folder)');
      lines.push('3. Navigate to: ~/Library/Application Support/Logos4/Documents');
      lines.push('4. Look for a directory with a random ID');
      lines.push('5. Inside that directory, look for: NotesToolManager/notestool.db');
      lines.push('');
      lines.push('Example path:');
      lines.push('/Users/YourName/Library/Application Support/Logos4/Documents/{random-id}/NotesToolManager/notestool.db');
    } else {
      lines.push('Linux/Other:');
      lines.push('Database location varies by Logos installation method.');
      lines.push('Check your Logos installation documentation.');
    }

    lines.push('');
    lines.push('💡 Tip: Use the --database flag to specify a custom path:');
    lines.push('   bun run export --database "/path/to/your/notestool.db"');

    return lines;
  }

  /**
   * Get the catalog database location based on the notestool database path
   */
  public static getCatalogLocation(notestoolPath: string): CatalogLocation | null {
    try {
      // Convert Documents path to Data path
      // e.g., /Users/user/Library/Application Support/Logos4/Documents/random/NotesToolManager/notestool.db
      // to   /Users/user/Library/Application Support/Logos4/Data/random/LibraryCatalog/catalog.db
      
      let catalogPath = notestoolPath;
      
      // Replace Documents with Data
      catalogPath = catalogPath.replace('/Documents/', '/Data/');
      
      // Replace NotesToolManager with LibraryCatalog
      catalogPath = catalogPath.replace('/NotesToolManager/', '/LibraryCatalog/');
      
      // Replace notestool.db with catalog.db
      catalogPath = catalogPath.replace('/notestool.db', '/catalog.db');
      
      // For Windows paths
      catalogPath = catalogPath.replace('\\Documents\\', '\\Data\\');
      catalogPath = catalogPath.replace('\\NotesToolManager\\', '\\LibraryCatalog\\');
      catalogPath = catalogPath.replace('\\notestool.db', '\\catalog.db');
      
      const exists = existsSync(catalogPath);
      let size: number | undefined;
      let lastModified: Date | undefined;
      
      if (exists) {
        try {
          const stats = statSync(catalogPath);
          size = stats.size;
          lastModified = stats.mtime;
        } catch {
          // Ignore stat errors
        }
      }

      return {
        path: catalogPath,
        exists,
        size,
        lastModified
      };
    } catch {
      return null;
    }
  }
} 