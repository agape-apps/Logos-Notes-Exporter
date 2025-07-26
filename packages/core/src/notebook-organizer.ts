import { NotesToolDatabase } from './notestool-database.js';
import type { NotesToolNote, Notebook, NoteAnchorTextRange, BibleReference } from './notestool-database.js';
import { BibleReferenceDecoder } from './reference-decoder.js';
import type { DecodedReference } from './reference-decoder.js';
import { Logger } from './errors/logger.js';
import { DatabaseError, LogosExportError, ErrorSeverity, ErrorCategory } from './errors/error-types.js';

export interface NotebookOrganizerOptions {
  skipHighlights?: boolean;
}

export interface OrganizedNote extends NotesToolNote {
  references: DecodedReference[];
  notebook: Notebook | null;
  formattedTitle: string;
  sanitizedFilename: string;
  anchorTextRange?: NoteAnchorTextRange;
}

export interface NotebookGroup {
  notebook: Notebook | null;
  notes: OrganizedNote[];
  totalNotes: number;
  sanitizedFolderName: string;
}

export interface OrganizationStats {
  totalNotes: number;
  notesWithContent: number;
  notesWithReferences: number;
  notebooks: number;
  orphanedNotes: number;
  errors?: OrganizationError[];
}

export interface OrganizationError {
  noteId?: number;
  notebookId?: string;
  operation: string;
  error: string;
  severity: 'warning' | 'error';
}

export interface OrganizationResult {
  groups: NotebookGroup[];
  stats: OrganizationStats;
  errors: OrganizationError[];
  success: boolean;
}

export class NotebookOrganizer {
  private database: NotesToolDatabase;
  private referenceDecoder: BibleReferenceDecoder;
  private options: NotebookOrganizerOptions;
  private logger: Logger;
  private errors: OrganizationError[] = [];

  constructor(database: NotesToolDatabase, options: NotebookOrganizerOptions = {}) {
    this.database = database;
    this.referenceDecoder = new BibleReferenceDecoder();
    this.options = options;
    this.logger = new Logger({ enableConsole: true });
  }

  /**
   * Clear accumulated errors
   */
  private clearErrors(): void {
    this.errors = [];
  }

  /**
   * Add an error to the error collection
   */
  private addError(error: OrganizationError): void {
    this.errors.push(error);
  }

  /**
   * Get accumulated errors
   */
  public getErrors(): OrganizationError[] {
    return [...this.errors];
  }

  /**
   * Organize all active notes by notebooks with references
   */
  public async organizeNotes(): Promise<NotebookGroup[]> {
    this.clearErrors();
    this.logger.logInfo('Starting notebook organization');

    try {
      return await this.organizeNotesWithErrorHandling();
    } catch (error) {
      this.logger.logError('Failed to organize notes', { error });
      this.addError({
        operation: 'organizeNotes',
        error: error instanceof Error ? error.message : 'Unknown error during organization',
        severity: 'error'
      });
      throw new LogosExportError('Failed to organize notes', ErrorSeverity.ERROR, ErrorCategory.EXPORT, { metadata: { originalError: error } });
    }
  }

  /**
   * Organize notes with comprehensive error handling
   */
  private async organizeNotesWithErrorHandling(): Promise<NotebookGroup[]> {
    // Phase 1: Load data with error handling
    const { notes, notebooks, allReferences, allTextRanges } = await this.loadOrganizationData();
    
    // Phase 2: Create lookup maps
    const { notebookMap, referencesMap, textRangesMap } = this.createLookupMaps(notebooks, allReferences, allTextRanges);
    
    // Phase 3: Process notes and organize by notebook
    return this.processAndGroupNotes(notes, notebookMap, referencesMap, textRangesMap);
  }

  /**
   * Load all required data for organization
   */
  private async loadOrganizationData(): Promise<{
    notes: NotesToolNote[];
    notebooks: Notebook[];
    allReferences: BibleReference[];
    allTextRanges: NoteAnchorTextRange[];
  }> {
    let notes: NotesToolNote[];
    let notebooks: Notebook[];
    let allReferences: BibleReference[];
    let allTextRanges: NoteAnchorTextRange[];

    try {
      this.logger.logDebug('Loading active notes');
      notes = this.database.getActiveNotes();
      
      // Filter out highlights if requested
      if (this.options.skipHighlights) {
        const originalCount = notes.length;
        notes = notes.filter((note: NotesToolNote) => note.kind !== 1); // 1 = highlight
        this.logger.logDebug(`Filtered out ${originalCount - notes.length} highlights`);
      }
    } catch (error) {
      this.addError({
        operation: 'loadActiveNotes',
        error: 'Failed to load active notes from database',
        severity: 'error'
      });
      throw new DatabaseError('Failed to load active notes', { metadata: { error: error instanceof Error ? error.message : 'Unknown database error' } });
    }

    try {
      this.logger.logDebug('Loading active notebooks');
      notebooks = this.database.getActiveNotebooks();
    } catch (error) {
      this.addError({
        operation: 'loadActiveNotebooks',
        error: 'Failed to load active notebooks from database',
        severity: 'error'
      });
      throw new DatabaseError('Failed to load active notebooks', { metadata: { error: error instanceof Error ? error.message : 'Unknown database error' } });
    }

    try {
      this.logger.logDebug('Loading Bible references');
      allReferences = this.database.getBibleReferences();
    } catch {
      this.addError({
        operation: 'loadBibleReferences',
        error: 'Failed to load Bible references from database',
        severity: 'warning'
      });
      allReferences = []; // Continue with empty references
    }

    try {
      this.logger.logDebug('Loading note anchor text ranges');
      allTextRanges = this.database.getNoteAnchorTextRanges();
    } catch {
      this.addError({
        operation: 'loadNoteAnchorTextRanges',
        error: 'Failed to load note anchor text ranges from database',
        severity: 'warning'
      });
      allTextRanges = []; // Continue with empty text ranges
    }

    this.logger.logInfo(`Loaded ${notes.length} notes, ${notebooks.length} notebooks, ${allReferences.length} references, ${allTextRanges.length} text ranges`);
    return { notes, notebooks, allReferences, allTextRanges };
  }

  /**
   * Create lookup maps for efficient data access
   */
  private createLookupMaps(
    notebooks: Notebook[],
    allReferences: BibleReference[],
    allTextRanges: NoteAnchorTextRange[]
  ): {
    notebookMap: Map<string, Notebook>;
    referencesMap: Map<number, DecodedReference[]>;
    textRangesMap: Map<number, NoteAnchorTextRange>;
  } {
    this.logger.logDebug('Creating lookup maps');

    // Create a map for quick notebook lookup
    const notebookMap = new Map<string, Notebook>();
    notebooks.forEach((nb: Notebook) => notebookMap.set(nb.externalId, nb));

    // Create a map for quick reference lookup
    const referencesMap = new Map<number, DecodedReference[]>();
    let referenceErrors = 0;
    
    allReferences.forEach((ref: BibleReference) => {
      try {
        const decoded = this.referenceDecoder.decodeReference(ref.reference, ref.bibleBook);
        if (decoded) {
          if (!referencesMap.has(ref.noteId)) {
            referencesMap.set(ref.noteId, []);
          }
          const noteReferences = referencesMap.get(ref.noteId);
          if (noteReferences) {
            noteReferences.push(decoded);
          }
        }
      } catch (error) {
        referenceErrors++;
        this.logger.logWarn(`Failed to decode reference for note ${ref.noteId}`, { 
          reference: ref.reference, 
          bibleBook: ref.bibleBook,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    if (referenceErrors > 0) {
      this.addError({
        operation: 'decodeReferences',
        error: `Failed to decode ${referenceErrors} Bible references`,
        severity: 'warning'
      });
    }

    // Create a map for quick text range lookup (using first range for each note)
    const textRangesMap = new Map<number, NoteAnchorTextRange>();
    allTextRanges.forEach((range: NoteAnchorTextRange) => {
      if (!textRangesMap.has(range.noteId)) {
        textRangesMap.set(range.noteId, range);
      }
    });

    this.logger.logDebug(`Created maps: ${notebookMap.size} notebooks, ${referencesMap.size} note references, ${textRangesMap.size} text ranges`);
    
    return { notebookMap, referencesMap, textRangesMap };
  }

  /**
   * Process notes and group them by notebook
   */
  private processAndGroupNotes(
    notes: NotesToolNote[],
    notebookMap: Map<string, Notebook>,
    referencesMap: Map<number, DecodedReference[]>,
    textRangesMap: Map<number, NoteAnchorTextRange>
  ): NotebookGroup[] {
    this.logger.logDebug(`Processing ${notes.length} notes`);

    const notebookGroups = new Map<string, NotebookGroup>();
    const orphanedGroup: NotebookGroup = {
      notebook: null,
      notes: [],
      totalNotes: 0,
      sanitizedFolderName: 'No Notebook'
    };

    let processedNotes = 0;
    let noteErrors = 0;

    for (const note of notes) {
      try {
        const organizedNote = this.processNote(note, notebookMap, referencesMap, textRangesMap);
        
        if (organizedNote.notebook) {
          const notebookId = organizedNote.notebook.externalId;
          
          if (!notebookGroups.has(notebookId)) {
            notebookGroups.set(notebookId, {
              notebook: organizedNote.notebook,
              notes: [],
              totalNotes: 0,
              sanitizedFolderName: this.sanitizeFilename(organizedNote.notebook.title || 'untitled-notebook')
            });
          }
          
          const group = notebookGroups.get(notebookId)!;
          group.notes.push(organizedNote);
          group.totalNotes++;
        } else {
          orphanedGroup.notes.push(organizedNote);
          orphanedGroup.totalNotes++;
        }
        
        processedNotes++;
      } catch (error) {
        noteErrors++;
        this.logger.logWarn(`Failed to process note ${note.id}`, { 
          noteId: note.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        this.addError({
          noteId: note.id,
          operation: 'processNote',
          error: `Failed to process note: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'warning'
        });
      }
    }

    if (noteErrors > 0) {
      this.logger.logWarn(`Failed to process ${noteErrors} out of ${notes.length} notes`);
    }

    // Convert to array and sort
    const result = Array.from(notebookGroups.values())
      .sort((a, b) => (a.notebook?.title || '').localeCompare(b.notebook?.title || ''));

    // Add orphaned notes (Notes with No Notebook) if any exist
    if (orphanedGroup.totalNotes > 0) {
      result.push(orphanedGroup);
    }

    this.logger.logInfo(`Organization complete: ${result.length} notebook groups, ${processedNotes} notes processed`);
    return result;
  }

  /**
   * Get organization statistics
   */
  public getOrganizationStats(): OrganizationStats {
    try {
      const notes = this.database.getActiveNotes();
      const notebooks = this.database.getActiveNotebooks();
      const references = this.database.getBibleReferences();

      const notesWithContent = notes.filter((n: NotesToolNote) => 
        n.contentRichText && n.contentRichText.trim() !== ''
      ).length;

      const noteIdsWithReferences = new Set(references.map((r: BibleReference) => r.noteId));
      const notesWithReferences = notes.filter((n: NotesToolNote) => noteIdsWithReferences.has(n.id)).length;

      const notebookIds = new Set(notebooks.map((nb: Notebook) => nb.externalId));
      const orphanedNotes = notes.filter((n: NotesToolNote) => !notebookIds.has(n.notebookExternalId)).length;

      return {
        totalNotes: notes.length,
        notesWithContent,
        notesWithReferences,
        notebooks: notebooks.length,
        orphanedNotes,
        errors: this.errors.length > 0 ? [...this.errors] : undefined
      };
    } catch (error) {
      this.logger.logError('Failed to get organization stats', { error });
      this.addError({
        operation: 'getOrganizationStats',
        error: `Failed to get statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
      
      // Return default stats
      return {
        totalNotes: 0,
        notesWithContent: 0,
        notesWithReferences: 0,
        notebooks: 0,
        orphanedNotes: 0,
        errors: [...this.errors]
      };
    }
  }

  /**
   * Get notes by notebook ID (filtered from all notes)
   */
  public getNotesByNotebook(notebookExternalId: string): OrganizedNote[] {
    try {
      const allNotes = this.database.getActiveNotes();
      let notes = allNotes.filter((n: NotesToolNote) => n.notebookExternalId === notebookExternalId);
      
      // Filter out highlights if requested
      if (this.options.skipHighlights) {
        notes = notes.filter((note: NotesToolNote) => note.kind !== 1); // 1 = highlight
      }
      const notebooks = this.database.getActiveNotebooks();
      const allReferences = this.database.getBibleReferences();
      const allTextRanges = this.database.getNoteAnchorTextRanges();

      const notebookMap = new Map<string, Notebook>();
      notebooks.forEach((nb: Notebook) => notebookMap.set(nb.externalId, nb));

      const referencesMap = new Map<number, DecodedReference[]>();
      allReferences.forEach((ref: BibleReference) => {
        try {
          const decoded = this.referenceDecoder.decodeReference(ref.reference, ref.bibleBook);
          if (decoded) {
            if (!referencesMap.has(ref.noteId)) {
              referencesMap.set(ref.noteId, []);
            }
            referencesMap.get(ref.noteId)!.push(decoded);
          }
        } catch (error) {
          this.logger.logWarn(`Failed to decode reference for note ${ref.noteId}`, { error });
        }
      });

      const textRangesMap = new Map<number, NoteAnchorTextRange>();
      allTextRanges.forEach((range: NoteAnchorTextRange) => {
        if (!textRangesMap.has(range.noteId)) {
          textRangesMap.set(range.noteId, range);
        }
      });

      return notes.map((note: NotesToolNote) => this.processNote(note, notebookMap, referencesMap, textRangesMap))
        .filter(note => note !== null);
    } catch (error) {
      this.logger.logError(`Failed to get notes for notebook ${notebookExternalId}`, { error });
      this.addError({
        notebookId: notebookExternalId,
        operation: 'getNotesByNotebook',
        error: `Failed to get notes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
      return [];
    }
  }

  /**
   * Generate a safe filename for a note
   */
  public generateNoteFilename(note: OrganizedNote, index: number): string {
    let filename = '';

    // Prefer title from rich content or use references
    if (note.formattedTitle) {
      filename = note.formattedTitle;
    } else if (note.references.length > 0) {
      filename = note.references[0].formatted;
    } else {
      filename = `Note-${note.id}`;
    }

    // Add index if needed to ensure uniqueness
    if (index > 1) {
      filename += `-${index}`;
    }

    return this.sanitizeFilename(filename) + '.md';
  }

  /**
   * Process a single note with notebook and reference information
   */
  private processNote(
    note: NotesToolNote, 
    notebookMap: Map<string, Notebook>,
    referencesMap: Map<number, DecodedReference[]>,
    textRangesMap: Map<number, NoteAnchorTextRange>
  ): OrganizedNote {
    const notebook = notebookMap.get(note.notebookExternalId) || null;
    const references = referencesMap.get(note.id) || [];
    const anchorTextRange = textRangesMap.get(note.id);
    
    // Generate formatted title
    const formattedTitle = this.generateNoteTitle(note, references);
    
    // Create sanitized filename
    const sanitizedFilename = this.sanitizeFilename(formattedTitle);

    return {
      ...note,
      notebook,
      references,
      formattedTitle,
      sanitizedFilename,
      anchorTextRange
    };
  }

  /**
   * Generate a human-readable title for a note
   */
  private generateNoteTitle(note: NotesToolNote, references: DecodedReference[]): string {
    // Try to extract title from rich text content
    if (note.contentRichText) {
      const title = this.extractTitleFromContent(note.contentRichText);
      if (title) return title;
    }

    // Use primary reference as title
    if (references.length > 0) {
      return references[0].formatted;
    }

    // Fallback to note type and ID
    const noteType = note.kind === 0 ? 'Note' : note.kind === 1 ? 'Highlight' : 'Annotation';
    return `${noteType} ${note.id}`;
  }

  /**
   * Extract title from rich text content (first meaningful line)
   */
  private extractTitleFromContent(content: string): string | null {
    // Remove Rich Text (XAML) tags and extract first meaningful text
    const cleanText = content
      .replace(/<[^>]+>/g, ' ') // Remove XML/XAML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (!cleanText) return null;

    // Get first line or first 50 characters
    const firstLine = cleanText.split(/[\\n\\r]/)[0].trim();
    if (firstLine.length > 50) {
      return firstLine.substring(0, 47) + '...';
    }

    return firstLine || null;
  }

  /**
   * Sanitize a string for use as a filename or folder name
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid file characters
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/-+/g, '-') // Collapse multiple dashes
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes
      .substring(0, 100) // Limit length
      || 'untitled';
  }

  /**
   * Close database connection
   */
  public close(): void {
    this.database.close();
  }
}