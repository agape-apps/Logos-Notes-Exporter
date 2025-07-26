
import { Database } from 'bun:sqlite';
import { DatabaseLocator, type DatabaseLocation } from './database-locator.js';
import { DatabaseError, Logger, ErrorSeverity, ErrorCategory } from './errors/index.js';

export interface NotesToolNote {
  id: number;
  externalId: string;
  createdDate: string;
  modifiedDate?: string;
  kind: number; // 0=Text, 1=Highlight
  contentRichText?: string;
  anchorBibleBook?: number;
  notebookExternalId: string;
  noteStyleId?: number;
  noteColorId?: number;
  noteIndicatorId?: number;
  anchorDataTypeId?: number;
  anchorResourceIdId?: number;
  tagsJson?: string;
  isDeleted: boolean;
  isTrashed: boolean;
}

export interface BibleReference {
  noteId: number;
  reference: string; // e.g., "bible+nkjv.61.24.14"
  bibleBook?: number;
  anchorIndex: number;
  dataTypeId: number;
}

export interface Notebook {
  notebookId: number;
  externalId: string;
  title?: string;
  createdDate: string;
  isDeleted: boolean;
  isTrashed: boolean;
}

export interface NoteStyle {
  noteStyleId: number;
  name: string;
}

export interface NoteColor {
  noteColorId: number;
  name: string;
}

export interface DataType {
  dataTypeId: number;
  name: string; // e.g., "bible+nkjv"
}

export interface NoteIndicator {
  noteIndicatorId: number;
  name: string;
}

export interface ResourceId {
  resourceIdId: number;
  resourceId: string; // e.g., "LLS:GRMNBBLSCHL2000"
}

export interface NoteAnchorTextRange {
  noteId: number;
  anchorIndex: number;
  resourceIdId: number;
  resourceVersionId: number;
  offset: number;
  pastEnd: number;
  wordNumberCount: number;
}

export class NotesToolDatabase {
  private db: Database;
  private dbLocation: DatabaseLocation;
  private logger: Logger;

  constructor(dbPath?: string, logger?: Logger) {
    this.logger = logger || new Logger({ enableConsole: true, level: 1 });
    try {
      this.dbLocation = this.findDatabase(dbPath);
      
      // Validate the database before opening
      const validation = DatabaseLocator.validateDatabase(this.dbLocation.path);
      if (!validation.valid) {
        throw new DatabaseError(
          `Invalid database: ${validation.error}`,
          {
            component: 'NotesToolDatabase',
            operation: 'constructor',
            metadata: { path: this.dbLocation.path, validation }
          }
        );
      }

      // Open database in READ-ONLY mode for safety
      this.db = new Database(this.dbLocation.path, { readonly: true });
      
      this.logger.logInfo('Database opened successfully', {
        path: this.dbLocation.path,
        type: this.dbLocation.type,
        size: this.dbLocation.size
      }, 'NotesToolDatabase');
      
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        'Failed to initialize database connection',
        {
          component: 'NotesToolDatabase',
          operation: 'constructor',
          metadata: { providedPath: dbPath }
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Find the best database location
   */
  private findDatabase(customPath?: string): DatabaseLocation {
    try {
      // 1. If custom path provided, use it
      if (customPath) {
        const customLocation = DatabaseLocator.checkCustomPath(customPath);
        if (!customLocation) {
          throw new DatabaseError(
            `Invalid custom database path: ${customPath}`,
            {
              component: 'NotesToolDatabase',
              operation: 'findDatabase',
              metadata: { customPath },
              suggestions: [
                'Verify the file path is correct',
                'Check file permissions',
                'Ensure the file exists and is accessible'
              ]
            }
          );
        }
        if (!customLocation.exists) {
          throw new DatabaseError(
            `Database file not found at custom path: ${customPath}`,
            {
              component: 'NotesToolDatabase',
              operation: 'findDatabase',
              metadata: { customPath },
              suggestions: [
                'Check if the file path is correct',
                'Verify Logos has created notes',
                'Try locating the database manually'
              ]
            }
          );
        }
        return customLocation;
      }

      // 2. Search for database in standard locations
      const bestLocation = DatabaseLocator.getBestDatabase();
      if (!bestLocation) {
        const locations = DatabaseLocator.displayLocations();
        const instructions = DatabaseLocator.getSearchInstructions();
        
        throw new DatabaseError(
          'No Logos NotesTool database found in standard locations',
          {
            component: 'NotesToolDatabase',
            operation: 'findDatabase',
            userMessage: 'Cannot find Logos notes database. Please locate it manually.',
            suggestions: [
              'Specify a custom database path',
              'Ensure Logos Bible Software is installed',
              'Check if you have created any notes in Logos',
              'Look for notestool.db in your Documents/Logos folder'
            ],
            metadata: { 
              searchedLocations: locations,
              instructions 
            }
          }
        );
      }

      return bestLocation;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        'Failed to locate database',
        {
          component: 'NotesToolDatabase',
          operation: 'findDatabase',
          metadata: { customPath }
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Execute a database query with error handling
   */
  private executeQuery(
    query: string,
    params: any[] = [],
    operation: string,
    errorMessage: string,
    metadata?: Record<string, any>
  ): any {
    try {
      this.logger.logDebug(`Executing query: ${operation}`, {
        query: query.replace(/\s+/g, ' ').trim(),
        paramCount: params.length,
        ...metadata
      }, 'NotesToolDatabase');

      const startTime = Date.now();
      const result = params.length > 0 
        ? this.db.query(query).all(...params)
        : this.db.query(query).all();
      const duration = Date.now() - startTime;

      this.logger.logDebug(`Query completed: ${operation}`, {
        resultCount: Array.isArray(result) ? result.length : 1,
        duration,
        ...metadata
      }, 'NotesToolDatabase');

      return result;
    } catch (error) {
      this.logger.logError(new DatabaseError(
        errorMessage,
        {
          component: 'NotesToolDatabase',
          operation,
          metadata: {
            query: query.replace(/\s+/g, ' ').trim(),
            paramCount: params.length,
            ...metadata
          }
        },
        error instanceof Error ? error : new Error(String(error))
      ));
      
      throw new DatabaseError(
        errorMessage,
        {
          component: 'NotesToolDatabase',
          operation,
          userMessage: 'Database query failed. Please check your database file.',
          suggestions: [
            'Verify the database is not corrupted',
            'Ensure Logos is not currently running',
            'Try restarting the application',
            'Check available system memory'
          ],
          metadata: {
            query: query.replace(/\s+/g, ' ').trim(),
            paramCount: params.length,
            ...metadata
          }
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Execute a single-row query with error handling
   */
  private executeQuerySingle(
    query: string,
    params: any[] = [],
    operation: string,
    errorMessage: string,
    metadata?: Record<string, any>
  ): any {
    try {
      this.logger.logDebug(`Executing single query: ${operation}`, {
        query: query.replace(/\s+/g, ' ').trim(),
        paramCount: params.length,
        ...metadata
      }, 'NotesToolDatabase');

      const result = params.length > 0 
        ? this.db.query(query).get(...params)
        : this.db.query(query).get();

      return result;
    } catch (error) {
      this.logger.logError(new DatabaseError(
        errorMessage,
        {
          component: 'NotesToolDatabase',
          operation,
          metadata: {
            query: query.replace(/\s+/g, ' ').trim(),
            paramCount: params.length,
            ...metadata
          }
        },
        error instanceof Error ? error : new Error(String(error))
      ));
      
      throw new DatabaseError(
        errorMessage,
        {
          component: 'NotesToolDatabase',
          operation,
          userMessage: 'Database query failed. Please check your database file.',
          suggestions: [
            'Verify the database is not corrupted',
            'Ensure Logos is not currently running',
            'Try restarting the application'
          ],
          metadata: {
            query: query.replace(/\s+/g, ' ').trim(),
            paramCount: params.length,
            ...metadata
          }
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get information about the database being used
   */
  getDatabaseInfo(): DatabaseLocation {
    return { ...this.dbLocation };
  }

  /**
   * Display all available database locations
   */
  static displayAvailableLocations(): string[] {
    return DatabaseLocator.displayLocations();
  }

  /**
   * Get manual search instructions for finding the database
   */
  static getSearchInstructions(): string[] {
    return DatabaseLocator.getSearchInstructions();
  }

  /**
   * Get all active notes (not deleted or trashed)
   */
  getActiveNotes(): NotesToolNote[] {
    const query = `
      SELECT 
        NoteId as id,
        ExternalId as externalId,
        CreatedDate as createdDate,
        ModifiedDate as modifiedDate,
        Kind as kind,
        ContentRichText as contentRichText,
        AnchorBibleBook as anchorBibleBook,
        NotebookExternalId as notebookExternalId,
        NoteStyleId as noteStyleId,
        NoteColorId as noteColorId,
        NoteIndicatorId as noteIndicatorId,
        AnchorDataTypeId as anchorDataTypeId,
        AnchorResourceIdId as anchorResourceIdId,
        TagsJson as tagsJson,
        IsDeleted as isDeleted,
        IsTrashed as isTrashed
      FROM Notes
      WHERE IsDeleted = 0 AND IsTrashed = 0
      ORDER BY CreatedDate, NoteId
    `;

    return this.executeQuery(
      query,
      [],
      'getActiveNotes',
      'Failed to retrieve active notes'
    ) as NotesToolNote[];
  }

  /**
   * Get all Bible references for notes
   */
  getBibleReferences(noteIds?: number[]): BibleReference[] {
    let query = `
      SELECT 
        NoteId as noteId,
        Reference as reference,
        BibleBook as bibleBook,
        AnchorIndex as anchorIndex,
        DataTypeId as dataTypeId
      FROM NoteAnchorFacetReferences
    `;

    if (noteIds && noteIds.length > 0) {
      const placeholders = noteIds.map(() => '?').join(',');
      query += ` WHERE NoteId IN (${placeholders})`;
      return this.executeQuery(
        query,
        noteIds,
        'getBibleReferences',
        'Failed to retrieve Bible references for specific notes',
        { noteCount: noteIds.length }
      ) as BibleReference[];
    }

    query += ` ORDER BY NoteId, AnchorIndex`;
    return this.executeQuery(
      query,
      [],
      'getBibleReferences',
      'Failed to retrieve all Bible references'
    ) as BibleReference[];
  }

  /**
   * Get all active notebooks
   */
  getActiveNotebooks(): Notebook[] {
    const query = `
      SELECT 
        NotebookId as notebookId,
        ExternalId as externalId,
        Title as title,
        CreatedDate as createdDate,
        IsDeleted as isDeleted,
        IsTrashed as isTrashed
      FROM Notebooks
      WHERE IsDeleted = 0 AND IsTrashed = 0
      ORDER BY Title
    `;

    return this.db.query(query).all() as Notebook[];
  }

  /**
   * Get notebook by external ID
   */
  getNotebook(externalId: string): Notebook | null {
    const query = `
      SELECT 
        NotebookId as notebookId,
        ExternalId as externalId,
        Title as title,
        CreatedDate as createdDate,
        IsDeleted as isDeleted,
        IsTrashed as isTrashed
      FROM Notebooks
      WHERE ExternalId = ? AND IsDeleted = 0 AND IsTrashed = 0
    `;

    return this.executeQuerySingle(
      query,
      [externalId],
      'getNotebook',
      'Failed to retrieve notebook by external ID',
      { externalId }
    ) as Notebook | null;
  }

  /**
   * Get all note styles
   */
  getNoteStyles(): NoteStyle[] {
    const query = `
      SELECT 
        NoteStyleId as noteStyleId,
        Name as name
      FROM NoteStyles
      ORDER BY NoteStyleId
    `;

    return this.db.query(query).all() as NoteStyle[];
  }

  /**
   * Get all note colors
   */
  getNoteColors(): NoteColor[] {
    const query = `
      SELECT 
        NoteColorId as noteColorId,
        Name as name
      FROM NoteColors
      ORDER BY NoteColorId
    `;

    return this.db.query(query).all() as NoteColor[];
  }

  /**
   * Get all data types (Bible versions)
   */
  getDataTypes(): DataType[] {
    const query = `
      SELECT 
        DataTypeId as dataTypeId,
        Name as name
      FROM DataTypes
      ORDER BY DataTypeId
    `;

    return this.db.query(query).all() as DataType[];
  }

  /**
   * Get all note indicators
   */
  getNoteIndicators(): NoteIndicator[] {
    const query = `
      SELECT 
        NoteIndicatorId as noteIndicatorId,
        Name as name
      FROM NoteIndicators
      ORDER BY NoteIndicatorId
    `;

    return this.db.query(query).all() as NoteIndicator[];
  }

  /**
   * Get all resource IDs
   */
  getResourceIds(): ResourceId[] {
    const query = `
      SELECT 
        ResourceIdId as resourceIdId,
        ResourceId as resourceId
      FROM ResourceIds
      ORDER BY ResourceIdId
    `;

    return this.db.query(query).all() as ResourceId[];
  }

  /**
   * Get all note anchor text ranges for offset data
   */
  getNoteAnchorTextRanges(noteIds?: number[]): NoteAnchorTextRange[] {
    let query = `
      SELECT 
        NoteId as noteId,
        AnchorIndex as anchorIndex,
        ResourceIdId as resourceIdId,
        ResourceVersionId as resourceVersionId,
        Offset as offset,
        PastEnd as pastEnd,
        WordNumberCount as wordNumberCount
      FROM NoteAnchorTextRanges
    `;

    if (noteIds && noteIds.length > 0) {
      const placeholders = noteIds.map(() => '?').join(',');
      query += ` WHERE NoteId IN (${placeholders})`;
      return this.db.query(query).all(...noteIds) as NoteAnchorTextRange[];
    }

    query += ` ORDER BY NoteId, AnchorIndex`;
    return this.db.query(query).all() as NoteAnchorTextRange[];
  }

  /**
   * Get complete note data with references and metadata
   */
  getNotesWithReferences(): Array<NotesToolNote & { 
    references: BibleReference[], 
    notebook?: Notebook,
    style?: NoteStyle,
    color?: NoteColor,
    indicator?: NoteIndicator,
    dataType?: DataType,
    resourceId?: ResourceId
  }> {
    const notes = this.getActiveNotes();
    const noteIds = notes.map(n => n.id);
    const references = this.getBibleReferences(noteIds);
    const notebooks = this.getActiveNotebooks();
    const styles = this.getNoteStyles();
    const colors = this.getNoteColors();
    const indicators = this.getNoteIndicators();
    const dataTypes = this.getDataTypes();
    const resourceIds = this.getResourceIds();

    // Create lookup maps
    const notebookMap = new Map(notebooks.map(nb => [nb.externalId, nb]));
    const styleMap = new Map(styles.map(s => [s.noteStyleId, s]));
    const colorMap = new Map(colors.map(c => [c.noteColorId, c]));
    const indicatorMap = new Map(indicators.map(i => [i.noteIndicatorId, i]));
    const dataTypeMap = new Map(dataTypes.map(dt => [dt.dataTypeId, dt]));
    const resourceIdMap = new Map(resourceIds.map(r => [r.resourceIdId, r]));
    const referencesMap = new Map<number, BibleReference[]>();
    
    // Group references by note ID
    for (const ref of references) {
      if (!referencesMap.has(ref.noteId)) {
        referencesMap.set(ref.noteId, []);
      }
      referencesMap.get(ref.noteId)!.push(ref);
    }

    // Combine data
    return notes.map(note => ({
      ...note,
      references: referencesMap.get(note.id) || [],
      notebook: notebookMap.get(note.notebookExternalId),
      style: note.noteStyleId ? styleMap.get(note.noteStyleId) : undefined,
      color: note.noteColorId ? colorMap.get(note.noteColorId) : undefined,
      indicator: note.noteIndicatorId ? indicatorMap.get(note.noteIndicatorId) : undefined,
      dataType: note.anchorDataTypeId ? dataTypeMap.get(note.anchorDataTypeId) : undefined,
      resourceId: note.anchorResourceIdId ? resourceIdMap.get(note.anchorResourceIdId) : undefined,
    }));
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalNotes: number;
    activeNotes: number;
    deletedNotes: number;
    trashedNotes: number;
    notesWithContent: number;
    notesWithReferences: number;
    totalNotebooks: number;
    activeNotebooks: number;
  } {
    const statsQuery = `
      SELECT 
        COUNT(*) as totalNotes,
        SUM(CASE WHEN IsDeleted = 0 AND IsTrashed = 0 THEN 1 ELSE 0 END) as activeNotes,
        SUM(CASE WHEN IsDeleted = 1 THEN 1 ELSE 0 END) as deletedNotes,
        SUM(CASE WHEN IsTrashed = 1 THEN 1 ELSE 0 END) as trashedNotes,
        SUM(CASE WHEN IsDeleted = 0 AND IsTrashed = 0 AND ContentRichText IS NOT NULL AND ContentRichText != '' THEN 1 ELSE 0 END) as notesWithContent
      FROM Notes
    `;

    const refStatsQuery = `
      SELECT COUNT(DISTINCT NoteId) as notesWithReferences
      FROM NoteAnchorFacetReferences
    `;

    const notebookStatsQuery = `
      SELECT 
        COUNT(*) as totalNotebooks,
        SUM(CASE WHEN IsDeleted = 0 AND IsTrashed = 0 THEN 1 ELSE 0 END) as activeNotebooks
      FROM Notebooks
    `;

    const noteStats = this.db.query(statsQuery).get() as {
      totalNotes: number;
      activeNotes: number;
      deletedNotes: number;
      trashedNotes: number;
      notesWithContent: number;
    };
    const refStats = this.db.query(refStatsQuery).get() as {
      notesWithReferences: number;
    };
    const notebookStats = this.db.query(notebookStatsQuery).get() as {
      totalNotebooks: number;
      activeNotebooks: number;
    };

    return {
      ...noteStats,
      ...refStats,
      ...notebookStats,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    try {
      this.db.close();
      this.logger.logInfo('Database connection closed successfully', {}, 'NotesToolDatabase');
    } catch (error) {
      this.logger.logWarn('Error closing database connection', {
        error: error instanceof Error ? error.message : String(error)
      }, 'NotesToolDatabase');
    }
  }
} 