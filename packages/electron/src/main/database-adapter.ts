/**
 * Database adapter for Electron environment
 * This wraps better-sqlite3 to provide the same interface as bun:sqlite
 */

import BetterSqlite3 from 'better-sqlite3';

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string, options?: { readonly?: boolean }) {
    // Validate that path is provided and is a string
    if (!dbPath || typeof dbPath !== 'string') {
      throw new Error(`Database path is required and must be a string. Received: ${typeof dbPath} (${dbPath})`);
    }

    // Validate that path is not empty
    if (dbPath.trim() === '') {
      throw new Error('Database path cannot be empty');
    }

    console.log('Creating database connection to:', dbPath);
    
    try {
      // Let webpack and electron-forge handle the native module loading
      this.db = new BetterSqlite3(dbPath, options);
    } catch (error) {
      console.error('Failed to create database connection:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to open database at "${dbPath}": ${errorMessage}`);
    }
  }

  query(sql: string) {
    const stmt = this.db.prepare(sql);
    return {
      all: (...params: unknown[]) => stmt.all(...params),
      get: (...params: unknown[]) => stmt.get(...params),
    };
  }

  prepare(sql: string): BetterSqlite3.Statement {
    return this.db.prepare(sql);
  }

  run(sql: string, ...params: unknown[]): BetterSqlite3.RunResult {
    return this.db.prepare(sql).run(...params);
  }

  close(): void {
    this.db.close();
  }
}

// Export as default and named export to match bun:sqlite structure
export default Database; 