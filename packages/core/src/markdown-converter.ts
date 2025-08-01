import { getDefaults } from '@logos-notes-exporter/config';
import type { OrganizedNote, NotebookGroup, FilePathInfo } from './types.js';
import { type ImageProcessingFailure } from './xaml-image-processor.js';
import { MetadataProcessor, type MetadataLookups, type MetadataOptions } from './metadata-processor.js';
import type { NotesToolDatabase } from './notestool-database.js';
import type { CatalogDatabase } from './catalog-database.js';
import { FrontmatterProcessor, type FrontmatterProcessorOptions } from './frontmatter-processor.js';
import { ContentProcessor, type ContentProcessorOptions, type XamlConversionStats, type XamlConversionFailure } from './content-processor.js';
import { ImageCoordinator, type ImageCoordinatorOptions, type MarkdownResult } from './image-coordinator.js';

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

// Re-export types from modules for backward compatibility
export type { XamlConversionStats, XamlConversionFailure } from './content-processor.js';
export type { MarkdownResult } from './image-coordinator.js';

export const DEFAULT_MARKDOWN_OPTIONS: MarkdownOptions = getDefaults.markdown();

export class MarkdownConverter {
  private options: MarkdownOptions;
  private frontmatterProcessor: FrontmatterProcessor;
  private contentProcessor: ContentProcessor;
  private imageCoordinator: ImageCoordinator;
  private verbose: boolean;
  private onLog?: (message: string) => void;

  constructor(options: Partial<MarkdownOptions> = {}, database?: NotesToolDatabase, verbose: boolean = false, catalogDb?: CatalogDatabase, onLog?: (message: string) => void) {
    this.options = { ...DEFAULT_MARKDOWN_OPTIONS, ...options };
    this.verbose = verbose;
    this.onLog = onLog;

    // Initialize enhanced metadata processor if database is provided
    let metadataProcessor: MetadataProcessor | undefined;
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
        
        metadataProcessor = new MetadataProcessor(metadataOptions, lookups, catalogDb);
      } catch (error) {
        console.warn('Failed to initialize enhanced metadata processor:', error);
      }
    }

    // Initialize processors
    const frontmatterOptions: FrontmatterProcessorOptions = {
      includeFrontmatter: this.options.includeFrontmatter,
      includeDates: this.options.includeDates,
      includeKind: this.options.includeKind,
      includeNotebook: this.options.includeNotebook,
      includeId: this.options.includeId,
      customFields: this.options.customFields,
      dateFormat: this.options.dateFormat
    };
    this.frontmatterProcessor = new FrontmatterProcessor(frontmatterOptions, metadataProcessor);

    const contentOptions: ContentProcessorOptions = {
      includeMetadata: this.options.includeMetadata,
      includeFrontmatter: this.options.includeFrontmatter,
      includeDates: this.options.includeDates,
      includeId: this.options.includeId,
      includeNotebook: this.options.includeNotebook,
      dateFormat: this.options.dateFormat,
      htmlSubSuperscript: this.options.htmlSubSuperscript,
      indentsNotQuotes: this.options.indentsNotQuotes
    };
    this.contentProcessor = new ContentProcessor(contentOptions, verbose, onLog);

    const imageOptions: ImageCoordinatorOptions = {
      htmlSubSuperscript: this.options.htmlSubSuperscript,
      indentsNotQuotes: this.options.indentsNotQuotes,
      maxImageSizeMB: 10,
      downloadTimeoutMs: 30000,
      downloadRetries: 3
    };
    this.imageCoordinator = new ImageCoordinator(imageOptions, verbose, onLog);
  }


  /**
   * Get Rich Text (XAML) conversion statistics
   */
  public getXamlConversionStats(): XamlConversionStats {
    return this.contentProcessor.getXamlConversionStats();
  }

  /**
   * Get Rich Text (XAML) conversion failures
   */
  public getXamlConversionFailures(): XamlConversionFailure[] {
    return this.contentProcessor.getXamlConversionFailures();
  }

  /**
   * Get image processing failures
   */
  public getImageFailures(): ImageProcessingFailure[] {
    const xamlConverter = this.contentProcessor.getXamlConverter();
    return this.imageCoordinator.getImageFailures(xamlConverter);
  }

  /**
   * Reset Rich Text (XAML) conversion statistics
   */
  public resetXamlStats(): void {
    this.contentProcessor.resetXamlStats();
  }

  /**
   * Convert an organized note to markdown
   */
  public convertNote(note: OrganizedNote, group: NotebookGroup, fileInfo: FilePathInfo): MarkdownResult {
    const frontmatter = this.frontmatterProcessor.generateFrontmatter(note, group, fileInfo);
    const body = this.contentProcessor.generateBody(note, group, fileInfo);
    
    let content = '';
    if (this.options.includeFrontmatter && Object.keys(frontmatter).length > 0) {
      content += this.frontmatterProcessor.serializeFrontmatter(frontmatter);
      content += '\n---\n\n';
    }
    content += body;

    return {
      content,
      frontmatter,
      body,
      wordCount: this.contentProcessor.countWords(body),
      characterCount: body.length
    };
  }

  /**
   * Update the XAML converter with output directory and note filename for image processing
   */
  public updateXamlConverterForImages(outputDirectory: string, noteFilename: string): void {
    const xamlConverter = this.imageCoordinator.createXamlConverterForImages(outputDirectory, noteFilename);
    this.contentProcessor.updateXamlConverter(xamlConverter);
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
    
    // Convert the note (this will collect image placeholders)
    const result = this.convertNote(note, group, fileInfo);
    
    // Process images using the image coordinator
    const xamlConverter = this.contentProcessor.getXamlConverter();
    const processedResult = await this.imageCoordinator.convertNoteWithImages(
      note, group, fileInfo, result, xamlConverter
    );
    
    // Update image statistics
    this.contentProcessor.updateImageStats();
    
    return processedResult;
  }


  /**
   * Process images in converted markdown asynchronously
   */
  public async processImagesInMarkdown(markdownResult: MarkdownResult, outputDirectory: string): Promise<MarkdownResult> {
    const processedResult = await this.imageCoordinator.processImagesInMarkdown(markdownResult, outputDirectory);
    
    // Update image statistics
    this.contentProcessor.updateImageStats();
    
    return processedResult;
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
} 