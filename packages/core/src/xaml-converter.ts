// Main XAML to Markdown converter - orchestrates the conversion process
// Uses modular components for parsing, processing, and formatting
// Maintains original public API for backward compatibility

import { getDefaults } from '@logos-notes-exporter/config';
import { XamlElementParser, type XamlElement } from './xaml-element-parser.js';
import { XamlFormattingUtils, type XamlConverterOptions } from './xaml-formatting-utils.js';
import { XamlElementProcessors } from './xaml-element-processors.js';
import { XamlListProcessor } from './xaml-lists-processor.js';
import { type ImageStats, type ImageProcessingFailure } from './xaml-image-processor.js';

// TODO: Add support for other monospace Font Names
export const DEFAULT_OPTIONS: XamlConverterOptions = getDefaults.xaml();

// Re-export types for backward compatibility
export type { XamlConverterOptions, XamlElement };

export class XamlToMarkdownConverter {
  private options: XamlConverterOptions;
  private parser: XamlElementParser;
  private formatter: XamlFormattingUtils;
  private processors: XamlElementProcessors;
  private listProcessor: XamlListProcessor;

  constructor(options: Partial<XamlConverterOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.parser = new XamlElementParser();
    this.formatter = new XamlFormattingUtils(this.options);
    this.processors = new XamlElementProcessors(this.options);
    this.listProcessor = new XamlListProcessor(this);
  }

  /**
   * Convert XAML content to Markdown
   */
  public convertToMarkdown(xamlContent: string): string {
    try {
      if (!xamlContent || xamlContent.trim() === '') {
        return '';
      }

      // Parse XAML content
      const parsed = this.parser.parseXaml(xamlContent);
      if (!parsed) {
        return '';
      }

      // Convert to markdown
      const markdown = this.processElement(parsed);
      
      // Clean up and normalize
      return this.formatter.normalizeMarkdown(markdown);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`XAML parsing failed: ${errorMessage}`);
      if (this.options.ignoreUnknownElements) {
        const fallbackResult = this.parser.extractPlainText(xamlContent);
        console.warn(`Falling back to plain text extraction. Result length: ${fallbackResult.length} chars`);
        return '*[Warning: Some formatting lost due to complex content]*\n\n' + fallbackResult;
      }
      throw new Error(`Rich Text (XAML) conversion failed: ${error}`);
    }
  }

  /**
   * Process XAML elements recursively - delegated to existing implementation
   * This maintains compatibility with the existing XamlListProcessor
   */
  public processElement(element: string | XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    if (!element) return '';

    if (typeof element === 'string') {
      return element;
    }

    if (Array.isArray(element)) {
      let result = '';
      for (const item of element) {
        result += this.processElement(item, paragraphElement);
      }
      return result;
    }

    // Handle preserveOrder format - element is an object
    let result = '';

    for (const [tagName, content] of Object.entries(element)) {
      if (tagName === ':@') {
        // Skip attributes - they're handled by individual processors
        continue;
      }

      switch (tagName.toLowerCase()) {
        case 'root':
          // Handle the Root wrapper - process its content array
          if (Array.isArray(content)) {
            for (const childElement of content) {
              result += this.processElement(childElement, paragraphElement);
            }
          } else {
            result += this.processElement(content, paragraphElement);
          }
          break;
        case 'section':
          result += this.processors.processSection(element);
          break;
        case 'urimedia':
          result += this.processors.processUriMedia(element);
          break;
        case 'list':
          result += this.listProcessor.processListElement(element);
          break;
        default:
          if (Array.isArray(content)) {
            // Process array of child elements
            result += this.processElement(content, paragraphElement);
          } else {
            result += this.processElement(content, paragraphElement);
          }
          break;
      }
    }

    return result;
  }

  /**
   * Get attributes from XAML element - delegated to parser
   */
  public getAttributes(element: XamlElement): Record<string, string> {
    return this.parser.getAttributes(element);
  }

  /**
   * Process all collected images asynchronously
   */
  public async processCollectedImages(markdown: string): Promise<string> {
    return this.processors.processCollectedImages(markdown);
  }

  /**
   * Clear collected images
   */
  public clearCollectedImages(): void {
    this.processors.clearCollectedImages();
  }

  /**
   * Get image processing statistics
   */
  public getImageStats(): ImageStats | null {
    return this.processors.getImageStats();
  }

  /**
   * Get image processing failures
   */
  public getImageFailures(): ImageProcessingFailure[] {
    return this.processors.getImageFailures();
  }
}