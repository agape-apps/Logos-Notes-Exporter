import { getDefaults } from '@logos-notes-exporter/config';
import type { OrganizedNote, NotebookGroup, FilePathInfo } from './types.js';
import { XamlToMarkdownConverter, type XamlConversionResult } from './xaml-converter.js';
import { type ImageProcessingFailure } from './xaml-image-processor.js';
import { cleanXamlText } from './unicode-cleaner.js';
import { MetadataProcessor, type MetadataLookups, type MetadataOptions } from './metadata-processor.js';
import type { NotesToolDatabase } from './notestool-database.js';
import type { CatalogDatabase } from './catalog-database.js';
import { XamlConversionError, ValidationError, Logger, ErrorSeverity } from './errors/index.js';

export interface MarkdownOptions {
  /** Include YAML frontmatter */
  includeFrontmatter: boolean;
  /** Include note metadata in content */
  includeMetadata: boolean;
  /** Include creation/modification dates */
  includeDates: boolean;
  /** Include note kind/type */
  includeKind: boolean;
  /** Include notebook information */
  includeNotebook: boolean;
  /** Custom frontmatter fields */
  customFields: Record<string, unknown>;
  /** Date format for display */
  dateFormat: 'iso' | 'locale' | 'short';
  /** Whether to include note ID */
  includeId: boolean;
  /** Use HTML sub/superscript tags instead of Pandoc-style formatting */
  htmlSubSuperscript: boolean;
  /** Use indents with non-breaking spaces instead of blockquotes */
  indentsNotQuotes: boolean;
}

export interface MarkdownConversionStats {
  /** Total notes processed */
  totalNotes: number;
  /** Notes that contained Rich Text (XAML) content */
  notesWithXaml: number;
  /** Rich Text (XAML) notes successfully converted */
  xamlConversionsSucceeded: number;
  /** Rich Text (XAML) notes that failed conversion */
  xamlConversionsFailed: number;
  /** Notes with plain text only */
  plainTextNotes: number;
  /** Notes with empty content */
  emptyNotes: number;
  /** Total images found in XAML */
  imagesFound: number;
  /** Images successfully downloaded */
  imagesDownloaded: number;
  /** Images that failed to download */
  imageDownloadsFailed: number;
  /** Total size of downloaded images in MB */
  totalImageSizeMB: number;
  /** Conversion errors encountered */
  conversionErrors: XamlConversionError[];
  /** Notes with metadata processing errors */
  metadataErrors: number;
  /** Notes with frontmatter generation errors */
  frontmatterErrors: number;
}

export interface XamlConversionStats {
  /** Total notes processed */
  totalNotes: number;
  /** Notes that contained Rich Text (XAML) content */
  notesWithXaml: number;
  /** Rich Text (XAML) notes successfully converted */
  xamlConversionsSucceeded: number;
  /** Rich Text (XAML) notes that failed conversion */
  xamlConversionsFailed: number;
  /** Notes with plain text only */
  plainTextNotes: number;
  /** Notes with empty content */
  emptyNotes: number;
  /** Total images found in XAML */
  imagesFound: number;
  /** Images successfully downloaded */
  imagesDownloaded: number;
  /** Images that failed to download */
  imageDownloadsFailed: number;
  /** Total size of downloaded images in MB */
  totalImageSizeMB: number;
}

export interface XamlConversionFailure {
  noteId: number;
  noteTitle: string;
  failureType: 'empty_content' | 'exception' | 'metadata_error' | 'frontmatter_error';
  errorMessage?: string;
  xamlContentPreview: string;
  recovery?: 'plain_text' | 'basic_frontmatter' | 'skipped';
}

export interface MarkdownResult {
  /** Final markdown content */
  content: string;
  /** YAML frontmatter object */
  frontmatter: Record<string, unknown>;
  /** Content without frontmatter */
  body: string;
  /** Word count */
  wordCount: number;
  /** Character count */
  characterCount: number;
}

export const DEFAULT_MARKDOWN_OPTIONS: MarkdownOptions = getDefaults.markdown();

export class MarkdownConverter {
  private options: MarkdownOptions;
  private xamlConverter: XamlToMarkdownConverter;
  private metadataProcessor?: MetadataProcessor;
  private conversionStats: MarkdownConversionStats;
  private xamlStats: XamlConversionStats;
  private verbose: boolean;
  private xamlFailures: XamlConversionFailure[];
  private onLog?: (message: string) => void;
  private logger: Logger;

  constructor(options: Partial<MarkdownOptions> = {}, database?: NotesToolDatabase, verbose: boolean = false, catalogDb?: CatalogDatabase, onLog?: (message: string) => void, logger?: Logger) {
    this.options = { ...DEFAULT_MARKDOWN_OPTIONS, ...options };
    this.verbose = verbose;
    this.onLog = onLog;
    this.logger = logger || new Logger({ enableConsole: true, level: 1 });
    
    this.xamlConverter = new XamlToMarkdownConverter({
      htmlSubSuperscript: this.options.htmlSubSuperscript,
      convertIndentsToQuotes: !this.options.indentsNotQuotes,
      downloadImages: true,
      maxImageSizeMB: 10,
      downloadTimeoutMs: 30000,
      downloadRetries: 3,
      onLog: this.onLog,
      verbose: this.verbose
    });
    this.xamlFailures = [];
    
    // Initialize conversion statistics
    this.conversionStats = {
      totalNotes: 0,
      notesWithXaml: 0,
      xamlConversionsSucceeded: 0,
      xamlConversionsFailed: 0,
      plainTextNotes: 0,
      emptyNotes: 0,
      imagesFound: 0,
      imagesDownloaded: 0,
      imageDownloadsFailed: 0,
      totalImageSizeMB: 0,
      conversionErrors: [],
      metadataErrors: 0,
      frontmatterErrors: 0
    };
    
    this.xamlStats = {
      totalNotes: 0,
      notesWithXaml: 0,
      xamlConversionsSucceeded: 0,
      xamlConversionsFailed: 0,
      plainTextNotes: 0,
      emptyNotes: 0,
      imagesFound: 0,
      imagesDownloaded: 0,
      imageDownloadsFailed: 0,
      totalImageSizeMB: 0
    };
    
    // Initialize enhanced metadata processor if database is provided
    if (database) {
      try {
        const lookups: MetadataLookups = {
          styles: new Map(database.getNoteStyles().map(s => [s.noteStyleId, s])),
          colors: new Map(database.getNoteColors().map(c => [c.noteColorId, c])),
          indicators: new Map(database.getNoteIndicators().map(i => [i.noteIndicatorId, i])),
          dataTypes: new Map(database.getDataTypes().map(d => [d.dataTypeId, d])),
          resourceIds: new Map(database.getResourceIds().map(r => [r.resourceIdId, r]))
        };
        
        const metadataOptions: Partial<MetadataOptions> = {
          includeDates: this.options.includeDates,
          includeNotebook: this.options.includeNotebook,
          includeEnhancedMetadata: true,
          includeTags: true,
          dateFormat: this.options.dateFormat === 'iso' ? 'iso' : 'readable'
        };
        
        this.metadataProcessor = new MetadataProcessor(metadataOptions, lookups, catalogDb);
      } catch (error) {
        this.logger.logWarn('Failed to initialize enhanced metadata processor', {
          error: error instanceof Error ? error.message : String(error),
          hasDatabase: !!database,
          hasCatalogDb: !!catalogDb
        }, 'MarkdownConverter');
      }
    }
  }

  /**
   * Check if content contains Rich Text (XAML) patterns
   */
  private containsXamlContent(content: string): boolean {
    if (!content || !content.trim()) return false;
    
    const xamlPatterns = [
      /<Paragraph[^>]*>/i,
      /<Run[^>]*>/i,
      /<Span[^>]*>/i,
      /Text="[^"]*"/i,
      /<Section[^>]*>/i
    ];

    return xamlPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Get Rich Text (XAML) conversion statistics
   */
  public getXamlConversionStats(): XamlConversionStats {
    return { ...this.xamlStats };
  }
  
  /**
   * Get comprehensive markdown conversion statistics
   */
  public getMarkdownConversionStats(): MarkdownConversionStats {
    return { ...this.conversionStats };
  }

  /**
   * Get Rich Text (XAML) conversion failures
   */
  public getXamlConversionFailures(): XamlConversionFailure[] {
    return [...this.xamlFailures];
  }

  /**
   * Get image processing failures
   */
  public getImageFailures(): ImageProcessingFailure[] {
    return this.xamlConverter.getImageFailures();
  }

  /**
   * Reset Rich Text (XAML) conversion statistics
   */
  public resetXamlStats(): void {
    this.xamlStats = {
      totalNotes: 0,
      notesWithXaml: 0,
      xamlConversionsSucceeded: 0,
      xamlConversionsFailed: 0,
      plainTextNotes: 0,
      emptyNotes: 0,
      imagesFound: 0,
      imagesDownloaded: 0,
      imageDownloadsFailed: 0,
      totalImageSizeMB: 0
    };
    this.xamlFailures = [];
  }

  /**
   * Convert an organized note to markdown with comprehensive error handling
   */
  public convertNote(note: OrganizedNote, group: NotebookGroup, fileInfo: FilePathInfo): MarkdownResult {
    try {
      this.conversionStats.totalNotes++;
      
      this.logger.logDebug('Converting note to markdown', {
        noteId: note.id,
        noteTitle: note.formattedTitle || 'Untitled',
        hasXaml: this.containsXamlContent(note.contentRichText || ''),
        filename: fileInfo.filename
      }, 'MarkdownConverter');
      
      // Generate frontmatter with error handling
      const frontmatter = this.generateFrontmatterSafely(note, group, fileInfo);
      
      // Generate body content with error handling
      const body = this.generateBodySafely(note, group, fileInfo);
      
      // Combine content
      let content = '';
      if (this.options.includeFrontmatter && Object.keys(frontmatter).length > 0) {
        try {
          content += this.serializeFrontmatter(frontmatter);
          content += '\n---\n\n';
        } catch (error) {
          this.conversionStats.frontmatterErrors++;
          this.logger.logWarn('Failed to serialize frontmatter', {
            noteId: note.id,
            error: error instanceof Error ? error.message : String(error)
          }, 'MarkdownConverter');
          
          // Continue without frontmatter
        }
      }
      content += body;

      const result = {
        content,
        frontmatter,
        body,
        wordCount: this.countWords(body),
        characterCount: body.length
      };
      
      this.logger.logDebug('Note conversion completed', {
        noteId: note.id,
        wordCount: result.wordCount,
        characterCount: result.characterCount,
        hasFrontmatter: Object.keys(frontmatter).length > 0
      }, 'MarkdownConverter');
      
      return result;
      
    } catch (error) {
      const conversionError = new XamlConversionError(
        `Failed to convert note ${note.id} to markdown`,
        note.contentRichText?.substring(0, 200),
        {
          component: 'MarkdownConverter',
          operation: 'convertNote',
          metadata: {
            noteId: note.id,
            noteTitle: note.formattedTitle,
            filename: fileInfo.filename
          }
        },
        error instanceof Error ? error : new Error(String(error))
      );
      
      this.conversionStats.conversionErrors.push(conversionError);
      this.logger.logError(conversionError);
      
      // Return a minimal result rather than failing completely
      return {
        content: `# ${note.formattedTitle || 'Untitled Note'}\n\n*[Error: This note could not be converted properly.]*`,
        frontmatter: { title: note.formattedTitle || 'Untitled Note' },
        body: '*[Error: This note could not be converted properly.]*',
        wordCount: 0,
        characterCount: 0
      };
    }
  }

  /**
   * Update the XAML converter with output directory and note filename for image processing
   */
  public updateXamlConverterForImages(outputDirectory: string, noteFilename: string): void {
    this.xamlConverter = new XamlToMarkdownConverter({
      htmlSubSuperscript: this.options.htmlSubSuperscript,
      convertIndentsToQuotes: !this.options.indentsNotQuotes,
      outputDirectory,
      noteFilename,
      downloadImages: true,
      maxImageSizeMB: 10,
      downloadTimeoutMs: 30000,
      downloadRetries: 3,
      onLog: this.onLog,
      verbose: this.verbose
    });
  }

  /**
   * Convert note with full image processing support
   */
  public async convertNoteWithImages(
    note: OrganizedNote, 
    group: NotebookGroup, 
    fileInfo: FilePathInfo,
    _outputDirectory: string
  ): Promise<MarkdownResult> {
    // Update XAML converter with proper note directory and filename
    this.updateXamlConverterForImages(fileInfo.directory, fileInfo.filename + '.md');
    
    // Clear any previous images from the converter
    this.xamlConverter.clearCollectedImages();
    
    // Convert the note (this will collect image placeholders)
    const result = this.convertNote(note, group, fileInfo);
    
    // Process images only once, then replace in both content and body
    // Process content once to download all images and get placeholder mappings
    const processedContent = await this.xamlConverter.processCollectedImages(result.content);
    
    // Extract placeholder mappings from the processing
    const placeholderMappings = this.extractPlaceholderMappings(result.content, processedContent);
    
    // Manually apply the same mappings to the body
    const processedBody = this.applyPlaceholderMappings(result.body, placeholderMappings);
    
    // Update image statistics
    const imageStats = this.xamlConverter.getImageStats();
    if (imageStats) {
      this.xamlStats.imagesFound += imageStats.imagesFound;
      this.xamlStats.imagesDownloaded += imageStats.imagesDownloaded;
      this.xamlStats.imageDownloadsFailed += imageStats.imageDownloadsFailed;
      this.xamlStats.totalImageSizeMB += imageStats.totalImageSizeMB;
    }
    
    return {
      ...result,
      content: processedContent,
      body: processedBody
    };
  }

  /**
   * Extract placeholder mappings from original and processed markdown
   */
  private extractPlaceholderMappings(original: string, processed: string): Map<string, string> {
    const mappings = new Map<string, string>();
    
    // Find all placeholders in original markdown
    const placeholderRegex = /!\[IMAGE_PLACEHOLDER_\d+\]\(\)/g;
    const originalPlaceholders = original.match(placeholderRegex) || [];
    
    // Find all image references in processed markdown
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const processedImages: string[] = [];
    let match;
    while ((match = imageRegex.exec(processed)) !== null) {
      processedImages.push(match[0]); // Full markdown image reference
    }
    
    // Map placeholders to their replacements
    for (let i = 0; i < originalPlaceholders.length && i < processedImages.length; i++) {
      mappings.set(originalPlaceholders[i], processedImages[i]);
    }
    
    return mappings;
  }

  /**
   * Apply placeholder mappings to markdown text
   */
  private applyPlaceholderMappings(markdown: string, mappings: Map<string, string>): string {
    let result = markdown;
    
    for (const [placeholder, replacement] of mappings) {
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    }
    
    return result;
  }

  /**
   * Process images in converted markdown asynchronously
   */
  public async processImagesInMarkdown(markdownResult: MarkdownResult, outputDirectory: string): Promise<MarkdownResult> {
    // Initialize XAML converter with image processing options if not already done
    if (!this.xamlConverter.getImageStats()) {
      // We need to recreate the converter with image processing options
      this.xamlConverter = new XamlToMarkdownConverter({
        htmlSubSuperscript: this.options.htmlSubSuperscript,
        convertIndentsToQuotes: !this.options.indentsNotQuotes,
        outputDirectory,
        noteFilename: 'temp', // Will be updated per note
        downloadImages: true,
        maxImageSizeMB: 10,
        downloadTimeoutMs: 30000,
        downloadRetries: 3,
        onLog: this.onLog,
        verbose: this.verbose
      });
    }

    // Process any collected images
    const processedContent = await this.xamlConverter.processCollectedImages(markdownResult.content);
    const processedBody = await this.xamlConverter.processCollectedImages(markdownResult.body);

    // Update image statistics
    const imageStats = this.xamlConverter.getImageStats();
    if (imageStats) {
      this.xamlStats.imagesFound += imageStats.imagesFound;
      this.xamlStats.imagesDownloaded += imageStats.imagesDownloaded;
      this.xamlStats.imageDownloadsFailed += imageStats.imageDownloadsFailed;
      this.xamlStats.totalImageSizeMB += imageStats.totalImageSizeMB;
    }

    return {
      ...markdownResult,
      content: processedContent,
      body: processedBody
    };
  }

  /**
   * Generate YAML frontmatter for a note
   */
  private generateFrontmatter(note: OrganizedNote, group: NotebookGroup, fileInfo: FilePathInfo): Record<string, unknown> {
    if (this.metadataProcessor) {
      // Use enhanced metadata processor
      const metadata = this.metadataProcessor.generateMetadata(note);
      const frontmatter: Record<string, unknown> = { ...metadata };
      
      // Add file information
      if (fileInfo.filename) {
        frontmatter.filename = fileInfo.filename;
      }
      
      // Add custom fields
      Object.assign(frontmatter, this.options.customFields);
      
      return frontmatter;
    } else {
      // Fallback to basic frontmatter generation
      return this.generateBasicFrontmatter(note, group, fileInfo);
    }
  }

  /**
   * Generate basic frontmatter when enhanced metadata processor is not available
   */
  private generateBasicFrontmatter(note: OrganizedNote, group: NotebookGroup, fileInfo: FilePathInfo): Record<string, unknown> {
    const frontmatter: Record<string, unknown> = {};

    // Title
    frontmatter.title = note.formattedTitle || this.generateTitleFromReferences(note) || 'Untitled Note';

    // Dates
    if (this.options.includeDates) {
      frontmatter.created = this.formatDate(note.createdDate);
      if (note.modifiedDate) {
        frontmatter.modified = this.formatDate(note.modifiedDate);
      }
    }

    // Note kind/type
    if (this.options.includeKind) {
      frontmatter.noteType = this.getNoteTypeName(note.kind);
    }

    // Note ID
    if (this.options.includeId) {
      frontmatter.noteId = note.id;
    }

    // Notebook information
    if (this.options.includeNotebook && group.notebook) {
      frontmatter.notebook = group.notebook.title;
    }

    // References - always include when available
    if (note.references.length > 0) {
      frontmatter.references = note.references.map(ref => ref.formatted);
    }

    // Tags
    const tags = this.extractTags(note);
    if (tags.length > 0) {
      frontmatter.tags = tags;
    }

    // File information
    if (fileInfo.filename) {
      frontmatter.filename = fileInfo.filename;
    }

    // Custom fields
    Object.assign(frontmatter, this.options.customFields);

    return frontmatter;
  }

  /**
   * Generate frontmatter with error handling
   */
  private generateFrontmatterSafely(note: OrganizedNote, group: NotebookGroup, fileInfo: FilePathInfo): Record<string, unknown> {
    try {
      return this.generateFrontmatter(note, group, fileInfo);
    } catch (error) {
      this.conversionStats.frontmatterErrors++;
      this.logger.logWarn('Failed to generate frontmatter, using basic fallback', {
        noteId: note.id,
        error: error instanceof Error ? error.message : String(error)
      }, 'MarkdownConverter');
      
      // Return basic frontmatter as fallback
      return {
        title: note.formattedTitle || 'Untitled Note',
        noteId: note.id,
        created: note.createdDate
      };
    }
  }
  
  /**
   * Generate body content with error handling
   */
  private generateBodySafely(note: OrganizedNote, group: NotebookGroup, fileInfo?: FilePathInfo): string {
    try {
      return this.generateBody(note, group, fileInfo);
    } catch (error) {
      this.logger.logError(new XamlConversionError(
        `Failed to generate body content for note ${note.id}`,
        note.contentRichText?.substring(0, 200),
        {
          component: 'MarkdownConverter',
          operation: 'generateBodySafely',
          metadata: {
            noteId: note.id,
            noteTitle: note.formattedTitle
          }
        },
        error instanceof Error ? error : new Error(String(error))
      ));
      
      // Return a fallback body
      return '*[Error: Could not generate note content.]*';
    }
  }

  /**
   * Generate the body content of the markdown note
   */
  private generateBody(note: OrganizedNote, group: NotebookGroup, _fileInfo?: FilePathInfo): string {
    const sections: string[] = [];

    // Track this note in Rich Text (XAML) conversion statistics
    this.xamlStats.totalNotes++;
    this.conversionStats.totalNotes++;

    // Add title as H1 if not including frontmatter
    if (!this.options.includeFrontmatter) {
      const title = note.formattedTitle || this.generateTitleFromReferences(note) || 'Untitled Note';
      sections.push(`# ${title}\n`);
    }

    // Add metadata section if enabled
    if (this.options.includeMetadata && !this.options.includeFrontmatter) {
      sections.push(this.generateMetadataSection(note, group));
    }

    // Add references section if not in frontmatter - always include when available
    if (note.references.length > 0 && !this.options.includeFrontmatter) {
      sections.push(this.generateReferencesSection(note));
    }

    // Add main content with Rich Text (XAML)-to-Markdown conversion and tracking
    if (note.contentRichText && note.contentRichText.trim()) {
      const hasXaml = this.containsXamlContent(note.contentRichText);
      
      if (hasXaml) {
        this.xamlStats.notesWithXaml++;
        
        try {
          const conversionResult = this.xamlConverter.convertToMarkdownWithStats(note.contentRichText);
          
          if (conversionResult.success && conversionResult.markdown.trim()) {
            this.xamlStats.xamlConversionsSucceeded++;
            this.conversionStats.xamlConversionsSucceeded++;
            sections.push(conversionResult.markdown.trim());
            
            // Log any warnings from conversion stats
            if (conversionResult.stats.errors.length > 0) {
              this.logger.logWarn('XAML conversion completed with errors', {
                noteId: note.id,
                errorCount: conversionResult.stats.errors.length,
                failedElements: conversionResult.stats.failedElements
              }, 'MarkdownConverter');
            }
          } else {
            this.xamlStats.xamlConversionsFailed++;
            this.conversionStats.xamlConversionsFailed++;
            
            const failure: XamlConversionFailure = {
              noteId: note.id,
              noteTitle: note.formattedTitle || 'Untitled',
              failureType: 'empty_content',
              xamlContentPreview: note.contentRichText.substring(0, 150),
              recovery: 'plain_text'
            };
            
            if (this.verbose) {
              this.xamlFailures.push(failure);
            }
            
            // Try to extract content from conversion result errors
            const errorContent = this.extractContentFromConversionErrors(conversionResult.stats.errors);
            if (errorContent) {
              sections.push(errorContent);
              failure.recovery = 'plain_text';
            } else {
              sections.push('*[This note contains formatting that could not be converted.]*');
              failure.recovery = 'skipped';
            }
            
            this.conversionStats.conversionErrors.push(...conversionResult.stats.errors);
          }
        } catch (error) {
          this.xamlStats.xamlConversionsFailed++;
          this.conversionStats.xamlConversionsFailed++;
          
          const conversionError = new XamlConversionError(
            `XAML conversion failed for note ${note.id}`,
            note.contentRichText.substring(0, 200),
            {
              component: 'MarkdownConverter',
              operation: 'generateBody',
              metadata: {
                noteId: note.id,
                noteTitle: note.formattedTitle
              }
            },
            error instanceof Error ? error : new Error(String(error))
          );
          
          this.conversionStats.conversionErrors.push(conversionError);
          
          if (this.verbose) {
            this.xamlFailures.push({
              noteId: note.id,
              noteTitle: note.formattedTitle || 'Untitled',
              failureType: 'exception',
              errorMessage: conversionError.message,
              xamlContentPreview: note.contentRichText.substring(0, 150),
              recovery: 'plain_text'
            });
          }
          
          // If Rich Text (XAML) conversion fails, extract plain text as fallback
          const plainText = this.extractPlainTextFromXamlSafely(note.contentRichText);
          if (plainText.trim()) {
            sections.push(plainText.trim());
          } else {
            sections.push('*[This note contains content that could not be processed.]*');
          }
        }
      } else {
        // Plain text content, no Rich Text (XAML)
        this.xamlStats.plainTextNotes++;
        sections.push(note.contentRichText.trim());
      }
    } else {
      // If no content, add a note about it (unless it's a highlight - they get special treatment)
      if (note.kind !== 1) {
        this.xamlStats.emptyNotes++;
        sections.push('*[This note appears to be empty.]*');
      } else {
        this.xamlStats.emptyNotes++;
      }
    }

    // Add highlight information if present
    if (note.kind === 1) {
      // Extract reference for highlighted passage - only use actual Bible references
      let reference = '';
      if (note.references.length > 0 && note.references[0]) {
        const formattedRef = note.references[0].formatted;
        if (typeof formattedRef === 'string' && formattedRef.trim()) {
          reference = formattedRef.trim();
        }
      }
      
      if (reference) {
        sections.push(`Highlighted passage: ${reference}`);
      } else {
        sections.push('This is a highlighted passage');
      }
    }

    return sections.join('\n\n');
  }

  /**
   * Generate metadata section for markdown body
   */
  private generateMetadataSection(note: OrganizedNote, group: NotebookGroup): string {
    const lines = ['## Metadata\n'];

    lines.push(`**Type:** ${this.getNoteTypeName(note.kind)}  `);
    lines.push(`**Created:** ${this.formatDate(note.createdDate)}  `);
    if (note.modifiedDate) {
      lines.push(`**Modified:** ${this.formatDate(note.modifiedDate)}  `);
    }

    if (group.notebook) {
      lines.push(`**Notebook:** ${group.notebook.title || 'Untitled'}  `);
    }

    if (this.options.includeId) {
      lines.push(`**ID:** ${note.id}  `);
    }

    return lines.join('\n');
  }

  /**
   * Generate references section for markdown body
   */
  private generateReferencesSection(note: OrganizedNote): string {
    const lines = ['## References\n'];
    
    for (const ref of note.references) {
      lines.push(`- ${ref.formatted}`);
    }

    return lines.join('\n');
  }

  /**
   * Serialize frontmatter to YAML
   */
  private serializeFrontmatter(frontmatter: Record<string, unknown>): string {
    const lines = ['---'];
    
    // Define the preferred field order for better readability
    const fieldOrder = [
      'title', 'created', 'modified', 'tags', 'noteType', 'references', 
      'noteId', 'notebook', 'logosBibleBook', 'bibleVersion', 'noteStyle', 
      'noteColor', 'noteIndicator', 'dataType', 'resourceId', 'resourceTitle', 'anchorLink', 'filename'
    ];
    
    // Add fields in the preferred order first
    for (const key of fieldOrder) {
      if (frontmatter[key] !== null && frontmatter[key] !== undefined) {
        lines.push(this.serializeYamlValue(key, frontmatter[key], 0));
      }
    }
    
    // Add any remaining fields that weren't in the preferred order
    for (const [key, value] of Object.entries(frontmatter)) {
      if (value === null || value === undefined || fieldOrder.includes(key)) {
        continue;
      }
      
      lines.push(this.serializeYamlValue(key, value, 0));
    }
    
    return lines.join('\n');
  }

  /**
   * Serialize a YAML value with proper formatting
   */
  private serializeYamlValue(key: string, value: unknown, indent: number = 0): string {
    const prefix = '  '.repeat(indent);
    
    if (value === null || value === undefined) {
      return `${prefix}${key}: null`;
    }
    
    if (typeof value === 'string') {
      // Escape quotes and handle multiline strings
      if (value.includes('\n') || value.includes('"') || value.includes('\'')) {
        const escapedValue = value.replace(/"/g, '\\"');
        return `${prefix}${key}: "${escapedValue}"`;
      }
      return `${prefix}${key}: "${value}"`;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return `${prefix}${key}: ${value}`;
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `${prefix}${key}: []`;
      }
      
      const lines = [`${prefix}${key}:`];
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          lines.push(`${prefix}  -`);
          for (const [subKey, subValue] of Object.entries(item)) {
            lines.push(this.serializeYamlValue(subKey, subValue, indent + 2));
          }
        } else {
          lines.push(`${prefix}  - ${this.formatYamlScalar(item)}`);
        }
      }
      return lines.join('\n');
    }
    
    if (typeof value === 'object') {
      const lines = [`${prefix}${key}:`];
      for (const [subKey, subValue] of Object.entries(value)) {
        lines.push(this.serializeYamlValue(subKey, subValue, indent + 1));
      }
      return lines.join('\n');
    }
    
    return `${prefix}${key}: ${String(value)}`;
  }

  /**
   * Format a scalar value for YAML
   */
  private formatYamlScalar(value: unknown): string {
    if (typeof value === 'string') {
      if (value.includes('"') || value.includes('\'') || value.includes('\n')) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return `"${value}"`;
    }
    return String(value);
  }

  /**
   * Get human-readable note type name
   */
  private getNoteTypeName(kind: number): string {
    switch (kind) {
      case 0: return 'note';
      case 1: return 'highlight';
      case 2: return 'annotation';
      default: return 'unknown';
    }
  }

  /**
   * Format date according to options
   */
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    
    switch (this.options.dateFormat) {
      case 'locale':
        return date.toLocaleDateString();
      case 'short': {
        const isoString = date.toISOString();
        return isoString.split('T')[0] || isoString; // YYYY-MM-DD
      }
      case 'iso':
      default:
        return date.toISOString();
    }
  }

  /**
   * Generate a title from references if no title exists
   */
  private generateTitleFromReferences(note: OrganizedNote): string | null {
    if (note.references.length === 0) return null;
    
    // Use the first reference as title
    const firstRef = note.references[0];
    if (firstRef && firstRef.formatted) {
      return String(firstRef.formatted);
    }
    return null;
  }

  /**
   * Extract plain text from Rich Text (XAML) as fallback
   */
  private extractPlainTextFromXaml(xaml: string): string {
    if (!xaml) return '';
    
    // Extract text from Text attributes
    const textMatches = xaml.match(/Text="([^"]*?)"/g) || [];
    const texts = textMatches.map(match => 
      cleanXamlText(match.replace(/Text="([^"]*?)"/, '$1').trim())
    ).filter(text => text);

    return texts.join(' ');
  }

  /**
   * Extract tags from a note (placeholder for future implementation)
   */
  private extractTags(note: OrganizedNote): string[] {
    // For now, return basic tags based on note type and content
    const tags: string[] = [];

    // Add note type tag
    switch (note.kind) {
      case 0:
        tags.push('note');
        break;
      case 1:
        tags.push('highlight');
        break;
      case 2:
        tags.push('annotation');
        break;
      default:
        tags.push('note');
    }

    // Add reference-based tags
    if (note.references.length > 0) {
      tags.push('scripture');
      
      // Add book tags for unique books
      const books = [...new Set(note.references.map(ref => ref.bookName).filter(Boolean))];
      for (const book of books.slice(0, 3)) { // Limit to 3 book tags
        if (book && typeof book === 'string') {
          tags.push(book.toLowerCase().replace(/\s+/g, '-'));
        }
      }
    }

    return tags;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    if (!text || text.trim().length === 0) return 0;
    
    // Remove markdown formatting and count words
    const plainText = text
      .replace(/[#*_`~]/g, '') // Remove markdown characters
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with text
      .trim();
    
    if (plainText.length === 0) return 0;
    
    return plainText.split(/\s+/).length;
  }

  /**
   * Update converter options
   */
  public updateOptions(newOptions: Partial<MarkdownOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current options
   */
  public getOptions(): MarkdownOptions {
    return { ...this.options };
  }

  /**
   * Convert multiple notes for a notebook group
   */
  public convertNotebook(group: NotebookGroup, fileMap: Map<OrganizedNote, FilePathInfo>): Map<OrganizedNote, MarkdownResult> {
    const results = new Map<OrganizedNote, MarkdownResult>();
    
    for (const note of group.notes) {
      const fileInfo = fileMap.get(note);
      if (fileInfo) {
        const result = this.convertNote(note, group, fileInfo);
        results.set(note, result);
      }
    }
    
    return results;
  }

  /**
   * Convert multiple notes for a notebook group with image processing
   */
  public async convertNotebookWithImages(
    group: NotebookGroup, 
    fileMap: Map<OrganizedNote, FilePathInfo>,
    outputDirectory: string
  ): Promise<Map<OrganizedNote, MarkdownResult>> {
    const results = new Map<OrganizedNote, MarkdownResult>();
    
    for (const note of group.notes) {
      const fileInfo = fileMap.get(note);
      if (fileInfo) {
        const result = await this.convertNoteWithImages(note, group, fileInfo, outputDirectory);
        results.set(note, result);
      }
    }
    
    return results;
  }

  /**
   * Get statistics for converted notes
   */
  public getConversionStats(results: Map<OrganizedNote, MarkdownResult>): {
    totalNotes: number;
    totalWords: number;
    totalCharacters: number;
    notesWithContent: number;
    averageWordCount: number;
  } {
    let totalWords = 0;
    let totalCharacters = 0;
    let notesWithContent = 0;

    for (const result of results.values()) {
      totalWords += result.wordCount;
      totalCharacters += result.characterCount;
      if (result.wordCount > 0) {
        notesWithContent++;
      }
    }

    return {
      totalNotes: results.size,
      totalWords,
      totalCharacters,
      notesWithContent,
      averageWordCount: results.size > 0 ? Math.round(totalWords / results.size) : 0
    };
  }

  /**
   * Extract content from conversion errors
   */
  private extractContentFromConversionErrors(errors: XamlConversionError[]): string | null {
    const extractedTexts: string[] = [];
    
    for (const error of errors) {
      if (error.xamlSnippet) {
        // Try to extract any text from the XAML snippet
        const text = this.extractPlainTextFromXamlSafely(error.xamlSnippet);
        if (text.trim()) {
          extractedTexts.push(text.trim());
        }
      }
    }
    
    return extractedTexts.length > 0 ? extractedTexts.join(' ') : null;
  }
  
  /**
   * Extract plain text from XAML with error handling
   */
  private extractPlainTextFromXamlSafely(xaml: string): string {
    try {
      return this.extractPlainTextFromXaml(xaml);
    } catch (error) {
      this.logger.logDebug('Failed to extract plain text from XAML', {
        error: error instanceof Error ? error.message : String(error),
        xamlLength: xaml.length
      }, 'MarkdownConverter');
      
      // Very basic fallback - just remove XML tags
      return xaml
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }
}
