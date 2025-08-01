// Handles content generation and XAML-to-Markdown conversion for note bodies
// Manages conversion statistics, error tracking, and fallback text extraction
// Coordinates with XAML converter while tracking conversion success/failure metrics

import type { OrganizedNote, NotebookGroup, FilePathInfo } from './types.js';
import { XamlToMarkdownConverter } from './xaml-converter.js';
import { cleanXamlText } from './unicode-cleaner.js';

export interface ContentProcessorOptions {
  includeMetadata: boolean;
  includeFrontmatter: boolean;
  includeDates: boolean;
  includeId: boolean;
  includeNotebook: boolean;
  dateFormat: 'iso' | 'locale' | 'short';
  htmlSubSuperscript: boolean;
  indentsNotQuotes: boolean;
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
  failureType: 'empty_content' | 'exception';
  errorMessage?: string;
  xamlContentPreview: string;
}

export class ContentProcessor {
  private options: ContentProcessorOptions;
  private xamlConverter: XamlToMarkdownConverter;
  private xamlStats: XamlConversionStats;
  private xamlFailures: XamlConversionFailure[];
  private verbose: boolean;
  private onLog?: (message: string) => void;

  constructor(options: ContentProcessorOptions, verbose: boolean = false, onLog?: (message: string) => void) {
    this.options = options;
    this.verbose = verbose;
    this.onLog = onLog;
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
   * Generate the body content of the markdown note
   */
  public generateBody(note: OrganizedNote, group: NotebookGroup, _fileInfo?: FilePathInfo): string {
    const sections: string[] = [];

    // Track this note in Rich Text (XAML) conversion statistics
    this.xamlStats.totalNotes++;

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
          const convertedContent = this.xamlConverter.convertToMarkdown(note.contentRichText);
          if (convertedContent.trim()) {
            this.xamlStats.xamlConversionsSucceeded++;
            sections.push(convertedContent.trim());
          } else {
            this.xamlStats.xamlConversionsFailed++;
            if (this.verbose) {
              this.xamlFailures.push({
                noteId: note.id,
                noteTitle: note.formattedTitle || 'Untitled',
                failureType: 'empty_content',
                xamlContentPreview: note.contentRichText.substring(0, 150)
              });
            }
            sections.push('*[This note contains formatting that could not be converted.]*');
          }
        } catch (error) {
          this.xamlStats.xamlConversionsFailed++;
          if (this.verbose) {
            this.xamlFailures.push({
              noteId: note.id,
              noteTitle: note.formattedTitle || 'Untitled',
              failureType: 'exception',
              errorMessage: error instanceof Error ? error.message : String(error),
              xamlContentPreview: note.contentRichText.substring(0, 150)
            });
          }
          // If Rich Text (XAML) conversion fails, extract plain text as fallback
          const plainText = this.extractPlainTextFromXaml(note.contentRichText);
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
   * Count words in text
   */
  public countWords(text: string): number {
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
   * Get Rich Text (XAML) conversion statistics
   */
  public getXamlConversionStats(): XamlConversionStats {
    return { ...this.xamlStats };
  }

  /**
   * Get Rich Text (XAML) conversion failures
   */
  public getXamlConversionFailures(): XamlConversionFailure[] {
    return [...this.xamlFailures];
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
   * Get the internal XAML converter for advanced operations
   */
  public getXamlConverter(): XamlToMarkdownConverter {
    return this.xamlConverter;
  }

  /**
   * Update the XAML converter with new configuration
   */
  public updateXamlConverter(converter: XamlToMarkdownConverter): void {
    this.xamlConverter = converter;
  }

  /**
   * Update image statistics from XAML converter
   */
  public updateImageStats(): void {
    const imageStats = this.xamlConverter.getImageStats();
    if (imageStats) {
      this.xamlStats.imagesFound += imageStats.imagesFound;
      this.xamlStats.imagesDownloaded += imageStats.imagesDownloaded;
      this.xamlStats.imageDownloadsFailed += imageStats.imageDownloadsFailed;
      this.xamlStats.totalImageSizeMB += imageStats.totalImageSizeMB;
    }
  }
}