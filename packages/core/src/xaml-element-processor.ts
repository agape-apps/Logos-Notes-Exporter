import type { XamlElement } from './xaml-text-formatter.js';
import { XamlTextFormatter } from './xaml-text-formatter.js';
import { XamlContentAnalyzer } from './xaml-content-analyzer.js';
import { XamlListProcessor } from './xaml-lists-processor.js';
import { XamlImageProcessor, type ImageProcessingOptions } from './xaml-image-processor.js';

export interface ElementProcessorOptions {
  /** Font family name used to identify code elements */
  monospaceFontName: string;
  /** Whether to ignore unknown elements */
  ignoreUnknownElements: boolean;
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
  /** Optional logging callback for verbose output */
  onLog?: (message: string) => void;
  /** Whether to enable verbose logging */
  verbose?: boolean;
}

/**
 * Handles processing of XAML elements into markdown content
 */
export class XamlElementProcessor {
  private textFormatter: XamlTextFormatter;
  private contentAnalyzer: XamlContentAnalyzer;
  private listProcessor: XamlListProcessor;
  private imageProcessor?: XamlImageProcessor;
  private pendingImages: Map<string, string> = new Map(); // placeholder -> URL
  private options: ElementProcessorOptions;

  constructor(
    textFormatter: XamlTextFormatter,
    contentAnalyzer: XamlContentAnalyzer,
    options: ElementProcessorOptions
  ) {
    this.textFormatter = textFormatter;
    this.contentAnalyzer = contentAnalyzer;
    this.options = options;
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
  }

  /**
   * Main element processing dispatcher
   */
  public processElement(element: string | XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    if (!element) return '';

    if (typeof element === 'string') {
      return element;
    }

    if (Array.isArray(element)) {
      let result = '';
      let i = 0;
      
      while (i < element.length) {
        let current = element[i];
        let codeLines: string[] = [];
        while (i < element.length && this.contentAnalyzer.isParagraph(current) && this.contentAnalyzer.isCodeParagraph(current)) {
          const content = this.processParagraph(current, true);
          if (content.trim()) {
            codeLines.push(content.trim());
          }
          i++;
          if (i < element.length) {
            current = element[i];
          }
        }
        if (codeLines.length > 0) {
          if (codeLines.length === 1) {
            result += '`' + codeLines[0] + '`  \n';
          } else {
            result += '```\n' + codeLines.join('\n') + '\n```\n\n';
          }
        } else {
          result += this.processElement(current, paragraphElement);
          i++;
        }
      }
      return result;
    }

    // Handle preserveOrder format - element is an array of objects
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
          result += this.processSection(element);
          break;
        case 'paragraph':
          result += this.processParagraph(element);
          break;
        case 'run':
          result += this.processRun(element, paragraphElement);
          break;
        case 'span':
          result += this.processSpan(element, paragraphElement);
          break;
        case 'list':
          result += this.processList(element);
          break;
        case 'table':
          result += this.processTable(element);
          break;
        case 'hyperlink':
          result += this.processHyperlink(element, paragraphElement);
          break;
        case 'urilink':
          result += this.processHyperlink(element, paragraphElement);
          break;
        case 'urimedia':
          result += this.processUriMedia(element);
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
   * Process section elements
   */
  public processSection(section: XamlElement | XamlElement[]): string {
    const sections = Array.isArray(section) ? section : [section];
    let result = '';

    for (const sect of sections) {
      if (!sect) continue;

      const fontFamily = sect['@_FontFamily'] || '';
      const content = this.extractElementContent(sect);

      // Check for code block
      if (this.textFormatter.isMonospaceFont(fontFamily)) {
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
   * Process paragraph elements
   */
  public processParagraph(paragraph: XamlElement | XamlElement[], skipNewline = false): string {
    const paragraphs = Array.isArray(paragraph) ? paragraph : [paragraph];
    let result = '';

    for (const para of paragraphs) {
      if (!para) continue;

      // Get paragraph attributes for margin processing
      const attrs = this.textFormatter.getAttributes(para);
      const margin = attrs['@_Margin'] || '';

      // Handle preserveOrder structure - get Paragraph content array
      const paragraphContent = para.Paragraph || para.paragraph || [];
      
      // Process paragraph content (array of child elements)
      let content = '';
      if (Array.isArray(paragraphContent)) {
        content = this.processElement(paragraphContent, para);
      } else {
        content = this.extractElementContent(para, para);
      }

      if (skipNewline) {
        result += content;
      } else {
        if (!content.trim()) {
          result += '\n\n';
          continue;
        }

        // Calculate indent level from margin
        const indentLevel = this.textFormatter.parseIndentLevel(margin);
        const indentPrefix = this.textFormatter.formatIndent(indentLevel);

        const headingLevel = this.textFormatter.getHeadingLevelFromParagraph(para);
        if (headingLevel > 0) {
          // For headings, add indent prefix before the hash marks
          result += indentPrefix + '#'.repeat(headingLevel) + ' ' + content.trim() + '\n';
        } else {
          // For regular paragraphs, add indent prefix before content
          result += indentPrefix + content.trimEnd() + '  \n';
        }
      }
    }

    return result;
  }

  /**
   * Process run elements
   */
  public processRun(run: XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    const runs = Array.isArray(run) ? run : [run];
    let result = '';

    for (const r of runs) {
      if (!r) continue;

      // Get attributes from the Run element
      const attrs = this.textFormatter.getAttributes(r);
      
      // Get text from attributes
      let text = attrs['@_Text'] || '';
      
      // Fallback to direct text content
      if (!text) {
        text = r['#text'] || '';
      }
      
      if (!text) continue;

      // Decode entities after parsing
      text = this.textFormatter.decodeEntities(text);

      // Convert leading tabs to indents before other processing
      text = this.textFormatter.convertLeadingTabsToIndents(text);

      // Check if this is monospace font (code) - preserve as-is without link conversion
      let fontFamily = attrs['@_FontFamily'] || '';
      
      // If no run-level font family, check paragraph level
      if (!fontFamily && paragraphElement) {
        const paragraphAttrs = this.textFormatter.getAttributes(paragraphElement);
        fontFamily = paragraphAttrs['@_FontFamily'] || '';
      }
      
      if (this.textFormatter.isMonospaceFont(fontFamily)) {
        // For code context, preserve existing markdown syntax
        result += '`' + text + '`';
        continue;
      }

      // Check if text already contains markdown syntax - preserve it
      if (this.contentAnalyzer.hasMarkdownLinkSyntax(text)) {
        result += text;
        continue;
      }

      // Apply inline formatting for non-code, non-markdown content
      text = this.textFormatter.applyInlineFormatting(text, r, paragraphElement);
      result += text;
    }

    return result;
  }

  /**
   * Process span elements
   */
  public processSpan(span: XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    const spans = Array.isArray(span) ? span : [span];
    let result = '';

    for (const s of spans) {
      if (!s) continue;

      let content = this.extractElementContent(s);
      // Decode entities after parsing
      content = this.textFormatter.decodeEntities(content);
      // Convert leading tabs to indents before formatting
      content = this.textFormatter.convertLeadingTabsToIndents(content);
      const formatted = this.textFormatter.applyInlineFormatting(content, s, paragraphElement);
      result += formatted;
    }

    return result;
  }

  /**
   * Process list elements
   */
  public processList(list: XamlElement | XamlElement[]): string {
    return this.listProcessor.processListElement(list);
  }

  /**
   * Process table elements
   */
  public processTable(table: XamlElement | XamlElement[]): string {
    const tables = Array.isArray(table) ? table : [table];
    let result = '';

    for (const t of tables) {
      if (!t) continue;

      const rows = this.extractTableRows(t);
      if (rows.length === 0) continue;

      // Process header row
      if (rows.length > 0) {
        const headerCells = this.extractTableCells(rows[0] as XamlElement);
        const headerRow = '| ' + headerCells.join(' | ') + ' |';
        const separatorRow = '| ' + headerCells.map(() => '---').join(' | ') + ' |';
        
        result += headerRow + '\n' + separatorRow + '\n';

        // Process data rows
        for (let i = 1; i < rows.length; i++) {
          const cells = this.extractTableCells(rows[i] as XamlElement);
          const dataRow = '| ' + cells.join(' | ') + ' |';
          result += dataRow + '\n';
        }
      }

      result += '\n';
    }

    return result;
  }

  /**
   * Process hyperlink elements
   */
  public processHyperlink(hyperlink: XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    const hyperlinks = Array.isArray(hyperlink) ? hyperlink : [hyperlink];
    let result = '';

    for (const link of hyperlinks) {
      if (!link) continue;

      // Get attributes - handle preserveOrder structure
      const attrs = link[':@'] || link;
      const url = attrs['@_Uri'] || attrs['@_NavigateUri'] || '';

      // Extract content - process children
      let text = '';
      if (Array.isArray(link)) {
        text = this.processElement(link, paragraphElement);
      } else {
        // For object structure, process non-attribute keys
        for (const [childKey, childValue] of Object.entries(link)) {
          if (childKey !== ':@') {
            text += this.processElement(childValue, paragraphElement);
          }
        }
      }

      text = text.trim();
      if (!text) continue;

      // Check if this is in code context
      if (this.contentAnalyzer.isInCodeContext(link)) {
        // Preserve code context
        result += text;
      } else if (url) {
        // Check if this UriLink is part of existing markdown syntax
        if (this.contentAnalyzer.isPartOfExistingMarkdown(link, paragraphElement)) {
          // Just output the raw URL since it's already part of markdown syntax
          result += url;
        } else if (this.contentAnalyzer.hasMarkdownLinkSyntax(text)) {
          result += text;
        } else {
          result += `[${text}](${url})`;
        }
      } else {
        result += text;
      }
    }

    return result;
  }

  /**
   * Process UriMedia elements (images)
   */
  public processUriMedia(element: XamlElement | XamlElement[]): string {
    const elements = Array.isArray(element) ? element : [element];
    let result = '';

    for (const elem of elements) {
      if (!elem) continue;

      const attrs = this.textFormatter.getAttributes(elem);
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
   * Extract content from element
   */
  public extractElementContent(element: XamlElement, paragraphElement?: XamlElement): string {
    if (!element) return '';

    if (Array.isArray(element)) {
      let content = '';
      for (const item of element) {
        content += this.extractElementContent(item as XamlElement, paragraphElement);
      }
      return content;
    }

    let content = '';

    // Direct text - clean Unicode issues and convert leading tabs
    if (element['#text']) {
      const cleanText = this.textFormatter.decodeEntities(element['#text']);
      content += this.textFormatter.convertLeadingTabsToIndents(cleanText);
    }

    // Text attribute - clean Unicode issues and convert leading tabs
    if (element['@_Text']) {
      const cleanText = this.textFormatter.decodeEntities(element['@_Text']);
      content += this.textFormatter.convertLeadingTabsToIndents(cleanText);
    }

    // Process child elements
    for (const [key, value] of Object.entries(element)) {
      if (key.startsWith('@_') || key === '#text') continue;

      switch (key.toLowerCase()) {
        case 'run':
          content += this.processRun(value as XamlElement | XamlElement[], paragraphElement);
          break;
        case 'span':
          content += this.processSpan(value as XamlElement | XamlElement[], paragraphElement);
          break;
        case 'hyperlink':
          content += this.processHyperlink(value as XamlElement | XamlElement[], paragraphElement);
          break;
        case 'urilink':
          content += this.processHyperlink(value as XamlElement | XamlElement[], paragraphElement);
          break;
        case 'list':
          content += this.processList(value as XamlElement | XamlElement[]);
          break;
        case 'table':
          content += this.processTable(value as XamlElement | XamlElement[]);
          break;
        default:
          if (typeof value === 'object' && value) {
            content += this.extractElementContent(value as XamlElement, paragraphElement);
          }
          break;
      }
    }

    return content;
  }

  /**
   * Extract table rows from table element
   */
  public extractTableRows(table: XamlElement): XamlElement[] {
    const rows: XamlElement[] = [];

    for (const [key, value] of Object.entries(table)) {
      if (key.toLowerCase() === 'tablerowgroup') {
        const rowGroups = Array.isArray(value) ? value : [value];
        for (const rowGroup of rowGroups) {
          if (rowGroup) {
            for (const [rKey, rValue] of Object.entries(rowGroup)) {
              if (rKey.toLowerCase() === 'tablerow') {
                if (Array.isArray(rValue)) {
                  rows.push(...rValue as XamlElement[]);
                } else {
                  rows.push(rValue as XamlElement);
                }
              }
            }
          }
        }
      } else if (key.toLowerCase() === 'tablerow') {
        if (Array.isArray(value)) {
          rows.push(...value as XamlElement[]);
        } else {
          rows.push(value as XamlElement);
        }
      }
    }

    return rows;
  }

  /**
   * Extract table cells from table row
   */
  public extractTableCells(row: XamlElement): string[] {
    const cells: string[] = [];

    for (const [key, value] of Object.entries(row)) {
      if (key.toLowerCase() === 'tablecell') {
        const cellArray = Array.isArray(value) ? value : [value];
        for (const cell of cellArray) {
          if (cell && typeof cell === 'object') {
            const content = this.extractElementContent(cell as XamlElement).trim();
            cells.push(content || '');
          }
        }
      }
    }

    return cells;
  }

  /**
   * Get collected images for processing
   */
  public getPendingImages(): Map<string, string> {
    return this.pendingImages;
  }

  /**
   * Clear collected images
   */
  public clearPendingImages(): void {
    this.pendingImages.clear();
  }

  /**
   * Get image processor instance
   */
  public getImageProcessor(): XamlImageProcessor | undefined {
    return this.imageProcessor;
  }
}