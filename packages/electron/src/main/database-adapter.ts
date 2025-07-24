/**
 * Database adapter for Electron environment
 * This wraps better-sqlite3 to provide the same interface as bun:sqlite
 */

import BetterSqlite3 from 'better-sqlite3';

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string, options?: { readonly?: boolean }) {
    console.log('Creating database connection to:', dbPath);

    // Validate that path is provided and is a string
    if (!dbPath || typeof dbPath !== 'string') {
      const errorMsg = `Database path is required and must be a string. Received: ${typeof dbPath} (${dbPath})`;
      console.error('Database validation error:', errorMsg);
      throw new Error(errorMsg);
    }

    // Validate that path is not empty
    if (dbPath.trim() === '') {
      const errorMsg = 'Database path cannot be empty';
      console.error('Database validation error:', errorMsg);
      throw new Error(errorMsg);
    }

    console.log('Database path validation passed');
    
    try {
      // Let webpack and electron-forge handle the native module loading
      this.db = new BetterSqlite3(dbPath, options);
      console.log('Database connection created successfully');
    } catch (error) {
      console.error('Database connection failed:', error);
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
    console.log('Closing database connection');
    try {
      this.db.close();
      console.log('Database connection closed successfully');
    } catch (error) {
      console.error('Database close error:', error);
    }
  }
}

// Export as default and named export to match bun:sqlite structure
export default Database; 