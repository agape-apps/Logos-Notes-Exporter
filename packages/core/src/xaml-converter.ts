import { XMLParser } from 'fast-xml-parser';
import { getDefaults } from '@logos-notes-exporter/config';
import { UnicodeCleaner } from './unicode-cleaner.js';
import { XamlListProcessor } from './xaml-lists-processor.js';
import { XamlImageProcessor, type ImageProcessingOptions, type ImageStats, type ImageProcessingFailure } from './xaml-image-processor.js';
import { XamlElementProcessor } from './xaml-element-processor.js';
import { XamlFormattingService } from './xaml-formatting-service.js';
import { XamlUtilities } from './xaml-utilities.js';

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

// TODO: Add support for other monospace Font Names
export const DEFAULT_OPTIONS: XamlConverterOptions = getDefaults.xaml();

export interface XamlElement {
  // Keep this as `any` because we don't know what the XAML elements will be
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  '@_FontSize'?: string;
  '@_FontWeight'?: string;
  '@_FontStyle'?: string;
  '@_FontFamily'?: string;
  '@_BorderThickness'?: string;
  '@_BorderBrush'?: string;
  '@_Text'?: string;
  '@_Tag'?: string;
  '@_NavigateUri'?: string;
  '@_MarkerStyle'?: string;
  '@_Kind'?: string; // Added for list Kind
  '@_Margin'?: string; // Added for paragraph indentation
  '#text'?: string;
}

export class XamlToMarkdownConverter {
  private options: XamlConverterOptions;
  private parser: XMLParser;
  private unicodeCleaner: UnicodeCleaner;
  private listProcessor: XamlListProcessor;
  private imageProcessor?: XamlImageProcessor;
  private elementProcessor: XamlElementProcessor;
  private formattingService: XamlFormattingService;
  private utilities: XamlUtilities;

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
    this.unicodeCleaner = new UnicodeCleaner();
    
    // Initialize utility modules
    this.utilities = new XamlUtilities(this.options);
    this.formattingService = new XamlFormattingService(this.options, this.utilities);
    this.listProcessor = new XamlListProcessor(this);
    
    // Initialize image processor if output directory is provided
    if (this.options.outputDirectory && this.options.noteFilename) {
      const imageOptions: ImageProcessingOptions = {
        outputDirectory: this.options.outputDirectory,
        noteFilename: this.options.noteFilename,
        downloadImages: this.options.downloadImages,
        maxImageSizeMB: this.options.maxImageSizeMB,
        downloadTimeoutMs: this.options.downloadTimeoutMs,
        downloadRetries: this.options.downloadRetries,
        onLog: this.options.onLog,
        verbose: this.options.verbose
      };
      this.imageProcessor = new XamlImageProcessor(imageOptions);
    }
    
    // Initialize element processor
    this.elementProcessor = new XamlElementProcessor(
      this.options,
      this.formattingService,
      this.utilities,
      this.listProcessor,
      this.imageProcessor
    );
  }

  private isXamlElement(value: unknown): value is XamlElement {
    return value !== null && typeof value === 'object';
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
      return this.utilities.normalizeMarkdown(markdown);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`XAML parsing failed: ${errorMessage}`);
      if (this.options.ignoreUnknownElements) {
        const fallbackResult = this.utilities.extractPlainText(xamlContent);
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

  public processElement(element: string | XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    return this.elementProcessor.processElement(element, paragraphElement);
  }

  public getAttributes(element: XamlElement): Record<string, string> {
    return this.utilities.getAttributes(element);
  }

  /**
   * Process all collected images asynchronously and replace placeholders in markdown
   */
  public async processCollectedImages(markdown: string): Promise<string> {
    if (!this.imageProcessor) {
      return markdown;
    }

    const pendingImages = this.elementProcessor.getPendingImages();
    if (pendingImages.size === 0) {
      return markdown;
    }

    let processedMarkdown = markdown;

    // Process each collected image
    for (const [placeholderId, uri] of pendingImages) {
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
    this.elementProcessor.clearPendingImages();
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