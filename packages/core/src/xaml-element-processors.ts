// Core element processing logic for XAML conversion
// Handles processing of sections, paragraphs, runs, spans, tables, and hyperlinks
// Part of the modular XAML to Markdown conversion system

import { XamlListProcessor } from './xaml-lists-processor.js';
import { XamlImageProcessor, type ImageProcessingOptions, type ImageStats, type ImageProcessingFailure } from './xaml-image-processor.js';
import { XamlElementParser, type XamlElement } from './xaml-element-parser.js';
import { XamlFormattingUtils, type XamlConverterOptions } from './xaml-formatting-utils.js';

export class XamlElementProcessors {
  private parser: XamlElementParser;
  private formatter: XamlFormattingUtils;
  private listProcessor: XamlListProcessor;
  private imageProcessor?: XamlImageProcessor;
  private pendingImages: Map<string, string> = new Map(); // placeholder -> URL
  private options: XamlConverterOptions;

  constructor(options: XamlConverterOptions) {
    this.options = options;
    this.parser = new XamlElementParser();
    this.formatter = new XamlFormattingUtils(options);
    this.listProcessor = new XamlListProcessor(this as any); // Temporary cast for compatibility
    
    // Initialize image processor if output directory is provided
    if (options.outputDirectory && options.noteFilename) {
      const imageOptions: ImageProcessingOptions = {
        outputDirectory: options.outputDirectory,
        noteFilename: options.noteFilename,
        downloadImages: options.downloadImages,
        maxImageSizeMB: options.maxImageSizeMB,
        downloadTimeoutMs: options.downloadTimeoutMs,
        downloadRetries: options.downloadRetries,
        onLog: options.onLog,
        verbose: options.verbose
      };
      this.imageProcessor = new XamlImageProcessor(imageOptions);
    }
  }

  /**
   * Process section elements
   */
  public processSection(section: XamlElement | XamlElement[]): string {
    const sections = Array.isArray(section) ? section : [section];
    let result = '';

    for (const sect of sections) {
      if (!sect) continue;

      const fontFamily = sect['@_FontFamily'] || '';
      const content = this.parser.extractElementContent(sect);

      // Check for code block
      if (this.formatter.isMonospaceFont(fontFamily)) {
        const language = sect['@_Tag'] || '';
        result += '```' + language + '\n' + content + '\n```\n\n';
        continue;
      }

      // Regular section content
      result += content + '\n\n';
    }

    return result;
  }

  /**
   * Process UriMedia elements (images) from XAML
   */
  public processUriMedia(element: XamlElement | XamlElement[]): string {
    const elements = Array.isArray(element) ? element : [element];
    let result = '';

    for (const elem of elements) {
      if (!elem) continue;

      const attrs = this.parser.getAttributes(elem);
      const uri = attrs['@_Uri'] || '';

      if (!uri) continue;

      if (!this.imageProcessor) {
        // If no image processor is available, return a placeholder
        result += '![image unavailable]()\n\n';
        continue;
      }

      // Create a unique placeholder and store the mapping
      const placeholderId = `IMAGE_PLACEHOLDER_${this.pendingImages.size + 1}`;
      this.pendingImages.set(placeholderId, uri);
      
      // Return placeholder that will be replaced later
      result += `![${placeholderId}]()\n\n`;
    }

    return result;
  }

  /**
   * Process all collected images asynchronously and replace placeholders in markdown
   */
  public async processCollectedImages(markdown: string): Promise<string> {
    if (!this.imageProcessor || this.pendingImages.size === 0) {
      return markdown;
    }

    let processedMarkdown = markdown;

    // Process each collected image
    for (const [placeholderId, uri] of this.pendingImages) {
      try {
        // Process the image using the image processor
        const result = await this.imageProcessor.processUriMediaElement({
          '@_Uri': uri
        } as any);

        // Replace the placeholder with the actual markdown reference
        const placeholderPattern = `![${placeholderId}]()`;
        processedMarkdown = processedMarkdown.replace(placeholderPattern, result.trim());
      } catch {
        // If processing fails, replace with unavailable placeholder
        const placeholderPattern = `![${placeholderId}]()`;
        processedMarkdown = processedMarkdown.replace(placeholderPattern, '![image unavailable]()');
      }
    }

    return processedMarkdown;
  }

  /**
   * Clear collected images (for reuse of converter instance)
   */
  public clearCollectedImages(): void {
    this.pendingImages.clear();
    if (this.imageProcessor) {
      this.imageProcessor.resetStats();
    }
  }

  /**
   * Get image processing statistics
   */
  public getImageStats(): ImageStats | null {
    return this.imageProcessor ? this.imageProcessor.getStats() : null;
  }

  /**
   * Get image processing failures
   */
  public getImageFailures(): ImageProcessingFailure[] {
    return this.imageProcessor ? this.imageProcessor.getFailures() : [];
  }
}