// Coordinates image processing workflows for markdown notes
// Manages placeholder mappings, async image downloads, and conversion coordination
// Handles image-specific XAML converter configuration and result processing

import type { OrganizedNote, NotebookGroup, FilePathInfo } from './types.js';
import { XamlToMarkdownConverter } from './xaml-converter.js';
import type { ImageProcessingFailure } from './xaml-image-processor.js';

export interface ImageCoordinatorOptions {
  htmlSubSuperscript: boolean;
  indentsNotQuotes: boolean;
  maxImageSizeMB: number;
  downloadTimeoutMs: number;
  downloadRetries: number;
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

export class ImageCoordinator {
  private options: ImageCoordinatorOptions;
  private verbose: boolean;
  private onLog?: (message: string) => void;

  constructor(options: ImageCoordinatorOptions, verbose: boolean = false, onLog?: (message: string) => void) {
    this.options = options;
    this.verbose = verbose;
    this.onLog = onLog;
  }

  /**
   * Create XAML converter configured for image processing
   */
  public createXamlConverterForImages(outputDirectory: string, noteFilename: string): XamlToMarkdownConverter {
    return new XamlToMarkdownConverter({
      htmlSubSuperscript: this.options.htmlSubSuperscript,
      convertIndentsToQuotes: !this.options.indentsNotQuotes,
      outputDirectory,
      noteFilename,
      downloadImages: true,
      maxImageSizeMB: this.options.maxImageSizeMB,
      downloadTimeoutMs: this.options.downloadTimeoutMs,
      downloadRetries: this.options.downloadRetries,
      onLog: this.onLog,
      verbose: this.verbose
    });
  }

  /**
   * Convert note with full image processing support
   */
  public async convertNoteWithImages(
    _note: OrganizedNote, 
    _group: NotebookGroup, 
    _fileInfo: FilePathInfo,
    originalResult: MarkdownResult,
    xamlConverter: XamlToMarkdownConverter
  ): Promise<MarkdownResult> {
    // Process images that were already collected during XAML conversion
    // Process content once to download all images and get placeholder mappings
    const processedContent = await xamlConverter.processCollectedImages(originalResult.content);
    
    // Extract placeholder mappings from the processing
    const placeholderMappings = this.extractPlaceholderMappings(originalResult.content, processedContent);
    
    // Manually apply the same mappings to the body
    const processedBody = this.applyPlaceholderMappings(originalResult.body, placeholderMappings);
    
    return {
      ...originalResult,
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
  public async processImagesInMarkdown(
    markdownResult: MarkdownResult, 
    outputDirectory: string
  ): Promise<MarkdownResult> {
    // Create a new XAML converter with image processing options
    const xamlConverter = new XamlToMarkdownConverter({
      htmlSubSuperscript: this.options.htmlSubSuperscript,
      convertIndentsToQuotes: !this.options.indentsNotQuotes,
      outputDirectory,
      noteFilename: 'temp', // Will be updated per note
      downloadImages: true,
      maxImageSizeMB: this.options.maxImageSizeMB,
      downloadTimeoutMs: this.options.downloadTimeoutMs,
      downloadRetries: this.options.downloadRetries,
      onLog: this.onLog,
      verbose: this.verbose
    });

    // Process any collected images
    const processedContent = await xamlConverter.processCollectedImages(markdownResult.content);
    const processedBody = await xamlConverter.processCollectedImages(markdownResult.body);

    return {
      ...markdownResult,
      content: processedContent,
      body: processedBody
    };
  }

  /**
   * Get image processing failures from XAML converter
   */
  public getImageFailures(xamlConverter: XamlToMarkdownConverter): ImageProcessingFailure[] {
    return xamlConverter.getImageFailures();
  }

  /**
   * Update image statistics from XAML converter
   */
  public getImageStats(xamlConverter: XamlToMarkdownConverter) {
    return xamlConverter.getImageStats();
  }
}