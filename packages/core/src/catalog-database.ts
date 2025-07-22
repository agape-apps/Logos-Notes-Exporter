
import { Database } from 'bun:sqlite';
import { DatabaseLocator, type CatalogLocation } from './database-locator.js';

export interface CatalogRecord {
  resourceId: string;
  title: string;
}

export class CatalogDatabase {
  private db: Database;
  private catalogLocation: CatalogLocation;

  constructor(notestoolDbPath: string) {
    const catalogLocation = this.findCatalogDatabase(notestoolDbPath);
    
    if (!catalogLocation || !catalogLocation.exists) {
      throw new Error(`Catalog database not found. Expected at: ${catalogLocation?.path || 'unknown'}`);
    }

    this.catalogLocation = catalogLocation;

    // Open database in READ-ONLY mode for safety
    this.db = new Database(this.catalogLocation.path, { readonly: true });
  }

  /**
   * Find the catalog database location based on the notestool database path
   */
  private findCatalogDatabase(notestoolDbPath: string): CatalogLocation | null {
    return DatabaseLocator.getCatalogLocation(notestoolDbPath);
  }

  /**
   * Get information about the catalog database being used
   */
  getCatalogInfo(): CatalogLocation {
    return { ...this.catalogLocation };
  }

  /**
   * Get book title by resourceId
   */
  getTitleByResourceId(resourceId: string): string | null {
    const query = `
      SELECT Title as title
      FROM Records
      WHERE ResourceId = ?
      LIMIT 1
    `;

    const result = this.db.query(query).get(resourceId) as { title: string } | null;
    return result?.title || null;
  }

  /**
   * Get multiple titles by resourceIds
   */
  getTitlesByResourceIds(resourceIds: string[]): Map<string, string> {
    if (resourceIds.length === 0) {
      return new Map();
    }

    const placeholders = resourceIds.map(() => '?').join(',');
    const query = `
      SELECT ResourceId as resourceId, Title as title
      FROM Records
      WHERE ResourceId IN (${placeholders})
    `;

    const results = this.db.query(query).all(...resourceIds) as CatalogRecord[];
    const titleMap = new Map<string, string>();
    
    for (const record of results) {
      titleMap.set(record.resourceId, record.title);
    }

    return titleMap;
  }

  /**
   * Get all records (for debugging purposes)
   */
  getAllRecords(): CatalogRecord[] {
    const query = `
      SELECT ResourceId as resourceId, Title as title
      FROM Records
      ORDER BY ResourceId
    `;

    return this.db.query(query).all() as CatalogRecord[];
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
} 