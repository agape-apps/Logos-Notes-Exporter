import { XMLParser } from 'fast-xml-parser';
import { getDefaults } from '@logos-notes-exporter/config';
import { XamlTextFormatter, type XamlElement, type TextFormatterOptions } from './xaml-text-formatter.js';
import { XamlContentAnalyzer } from './xaml-content-analyzer.js';
import { XamlElementProcessor, type ElementProcessorOptions } from './xaml-element-processor.js';
import { type ImageStats, type ImageProcessingFailure } from './xaml-image-processor.js';

export interface XamlConverterOptions {
  /** Font sizes that correspond to heading levels [H1, H2, H3, H4, H5, H6] */
  headingSizes: number[];
  /** Font family name used to identify code elements */
  monospaceFontName: string;
  /** Whether to ignore unknown elements */
  ignoreUnknownElements: boolean;
  /** Use HTML sub/superscript tags instead of Pandoc-style formatting */
  htmlSubSuperscript: boolean;
  /** Output directory for the export (used for images subfolder) */
  outputDirectory?: string;
  /** Current note filename for generating unique image names */
  noteFilename?: string;
  /** Whether to download images locally */
  downloadImages: boolean;
  /** Maximum image download size in MB */
  maxImageSizeMB: number;
  /** Download timeout in milliseconds */
  downloadTimeoutMs: number;
  /** Number of download retry attempts */
  downloadRetries: number;
  /** Convert all indent levels to blockquotes instead of &nbsp; indentation */
  convertIndentsToQuotes: boolean;
  /** Optional logging callback for verbose output */
  onLog?: (message: string) => void;
  /** Whether to enable verbose logging */
  verbose?: boolean;
}

// Re-export XamlElement for backwards compatibility
export type { XamlElement };

// TODO: Add support for other monospace Font Names
export const DEFAULT_OPTIONS: XamlConverterOptions = getDefaults.xaml();

export class XamlToMarkdownConverter {
  private options: XamlConverterOptions;
  private parser: XMLParser;
  private textFormatter: XamlTextFormatter;
  private contentAnalyzer: XamlContentAnalyzer;
  private elementProcessor: XamlElementProcessor;

  constructor(options: Partial<XamlConverterOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      removeNSPrefix: true,
      parseAttributeValue: false,
      trimValues: false,
      processEntities: true,
      preserveOrder: true,
      allowBooleanAttributes: true,
    });

    // Initialize text formatter
    const textFormatterOptions: TextFormatterOptions = {
      headingSizes: this.options.headingSizes,
      htmlSubSuperscript: this.options.htmlSubSuperscript,
      convertIndentsToQuotes: this.options.convertIndentsToQuotes
    };
    this.textFormatter = new XamlTextFormatter(textFormatterOptions);

    // Initialize content analyzer
    this.contentAnalyzer = new XamlContentAnalyzer();

    // Initialize element processor
    const elementProcessorOptions: ElementProcessorOptions = {
      monospaceFontName: this.options.monospaceFontName,
      ignoreUnknownElements: this.options.ignoreUnknownElements,
      outputDirectory: this.options.outputDirectory,
      noteFilename: this.options.noteFilename,
      downloadImages: this.options.downloadImages,
      maxImageSizeMB: this.options.maxImageSizeMB,
      downloadTimeoutMs: this.options.downloadTimeoutMs,
      downloadRetries: this.options.downloadRetries,
      onLog: this.options.onLog,
      verbose: this.options.verbose
    };
    this.elementProcessor = new XamlElementProcessor(
      this.textFormatter,
      this.contentAnalyzer,
      elementProcessorOptions
    );
  }



  public convertToMarkdown(xamlContent: string): string {
    try {
      if (!xamlContent || xamlContent.trim() === '') {
        return '';
      }

      // Clean and prepare Rich Text (XAML) content
      const cleanedXaml = this.cleanXamlContent(xamlContent);
      if (!cleanedXaml.trim()) {
        return '';
      }

      // Wrap in Root to handle multiple roots
      const wrappedXaml = `<Root>${cleanedXaml}</Root>`;

      // Parse Rich Text (XAML) content
      const parsed = this.parser.parse(wrappedXaml);
      
      // Convert to markdown
      const markdown = this.elementProcessor.processElement(parsed);
      
      // Clean up and normalize
      return this.normalizeMarkdown(markdown);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`XAML parsing failed: ${errorMessage}`);
      if (this.options.ignoreUnknownElements) {
        const fallbackResult = this.extractPlainText(xamlContent);
        console.warn(`Falling back to plain text extraction. Result length: ${fallbackResult.length} chars`);
        return '*[Warning: Some formatting lost due to complex content]*\n\n' + fallbackResult;
      }
      throw new Error(`Rich Text (XAML) conversion failed: ${error}`);
    }
  }

  private cleanXamlContent(xaml: string): string {
    // Remove XML declarations and namespaces
    let cleaned = xaml.replace(/<\?xml[^>]*\?>/gi, '');
    cleaned = cleaned.replace(/xmlns[^=]*="[^"]*"/gi, '');
   
    return cleaned.trim();
  }






















































  
  // TODO Is this function actually used?
  private extractPlainText(xamlContent: string): string {
    const textMatches = xamlContent.match(/Text="([^"]*?)"/g) || [];
    const plainTexts = textMatches.map((match) => {
      let text = match.replace(/Text="([^"]*?)"/, "$1");
      text = this.textFormatter.decodeEntities(text);
      return text;
    });

    let result = plainTexts.join("\n").trim();

    // Detect and format simple structures

    // Adds two blank lines before and after the H3 heading
    result = result.replace(/### (.+)/g, "\n\n### $1\n\n");
    // Detects ordered list items like 1. or 2. and ensures they start on a new line.
    result = result.replace(/\b[0-9]+\. /g, "\n$0");
    // Formats unordered list items using asterisk (* )
    result = result.replace(/\b\* /g, "\n$0");
    // Formats unordered list items using dash (- )
    result = result.replace(/\b- /g, "\n$0");

    return result;
  }

  private normalizeMarkdown(markdown: string): string {
    let result = markdown;
    
    // Add blank line after blockquote sequences when convertIndentsToQuotes is enabled
    if (this.options.convertIndentsToQuotes) {
      // Find blockquote lines followed immediately by non-blockquote content
      // Pattern: blockquote line(s) followed by a line that doesn't start with > and is not a blank line
      result = result.replace(/(^>+\s.*\n)(^(?!>)(?!\s*$).*)/gm, '$1\n$2');
    }
    
    return result
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .replace(/[ \t]{3,}$/gm, '  ')
      .replace(/[ \t]+$/gm, (match) => match === '  ' ? '  ' : '');
  }















  /**
   * Process all collected images asynchronously and replace placeholders in markdown
   */
  public async processCollectedImages(markdown: string): Promise<string> {
    const pendingImages = this.elementProcessor.getPendingImages();
    const imageProcessor = this.elementProcessor.getImageProcessor();
    
    if (!imageProcessor || pendingImages.size === 0) {
      return markdown;
    }

    let processedMarkdown = markdown;

    // Process each collected image
    for (const [placeholderId, uri] of pendingImages) {
      try {
        // Process the image using the image processor
        const result = await imageProcessor.processUriMediaElement({
          '@_Uri': uri
        } as XamlElement);

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
    this.elementProcessor.clearPendingImages();
    const imageProcessor = this.elementProcessor.getImageProcessor();
    if (imageProcessor) {
      imageProcessor.resetStats();
    }
  }

  /**
   * Get image processing statistics
   */
  public getImageStats(): ImageStats | null {
    const imageProcessor = this.elementProcessor.getImageProcessor();
    return imageProcessor ? imageProcessor.getStats() : null;
  }

  /**
   * Get image processing failures
   */
  public getImageFailures(): ImageProcessingFailure[] {
    const imageProcessor = this.elementProcessor.getImageProcessor();
    return imageProcessor ? imageProcessor.getFailures() : [];
  }
} 