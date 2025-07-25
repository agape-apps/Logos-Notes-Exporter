import { XMLParser } from 'fast-xml-parser';
import { getDefaults } from '@logos-notes-exporter/config';
import { UnicodeCleaner } from './unicode-cleaner.js';
import { XamlListProcessor } from './xaml-lists-processor.js';
import { XamlImageProcessor, type ImageProcessingOptions, type ImageStats, type ImageProcessingFailure } from './xaml-image-processor.js';

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

interface XamlElement {
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
  private pendingImages: Map<string, string> = new Map(); // placeholder -> URL

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
      const markdown = this.processElement(parsed);
      
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
        while (i < element.length && this.isParagraph(current) && this.isCodeParagraph(current)) {
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

  private processSection(section: XamlElement | XamlElement[]): string {
    const sections = Array.isArray(section) ? section : [section];
    let result = '';

    for (const sect of sections) {
      if (!sect) continue;

      const fontFamily = sect['@_FontFamily'] || '';
      const content = this.extractElementContent(sect);

      // Check for code block
      if (this.isMonospaceFont(fontFamily)) {
        const language = sect['@_Tag'] || '';
        result += '```' + language + '\n' + content + '\n```\n\n';
        continue;
      }

      // Regular section content
      result += content + '\n\n';
    }

    return result;
  }

  private processParagraph(paragraph: XamlElement | XamlElement[], skipNewline = false): string {
    const paragraphs = Array.isArray(paragraph) ? paragraph : [paragraph];
    let result = '';

    for (const para of paragraphs) {
      if (!para) continue;

      // Get paragraph attributes for margin processing
      const attrs = this.getAttributes(para);
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
        const indentLevel = this.parseIndentLevel(margin);
        const indentPrefix = this.formatIndent(indentLevel);

        const headingLevel = this.getHeadingLevelFromParagraph(para);
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

  private processRun(run: XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    const runs = Array.isArray(run) ? run : [run];
    let result = '';

    for (const r of runs) {
      if (!r) continue;

      // Get attributes from the Run element
      const attrs = this.getAttributes(r);
      
      // Get text from attributes
      let text = attrs['@_Text'] || '';
      
      // Fallback to direct text content
      if (!text) {
        text = r['#text'] || '';
      }
      
      if (!text) continue;

      // Decode entities after parsing
      text = this.decodeEntities(text);

      // Convert leading tabs to indents before other processing
      text = this.convertLeadingTabsToIndents(text);

      // Check if this is monospace font (code) - preserve as-is without link conversion
      let fontFamily = attrs['@_FontFamily'] || '';
      
      // If no run-level font family, check paragraph level
      if (!fontFamily && paragraphElement) {
        const paragraphAttrs = this.getAttributes(paragraphElement);
        fontFamily = paragraphAttrs['@_FontFamily'] || '';
      }
      
      if (this.isMonospaceFont(fontFamily)) {
        // For code context, preserve existing markdown syntax
        result += '`' + text + '`';
        continue;
      }

      // Check if text already contains markdown syntax - preserve it
      if (this.hasMarkdownLinkSyntax(text)) {
        result += text;
        continue;
      }

      // Apply inline formatting for non-code, non-markdown content
      text = this.applyInlineFormatting(text, r, paragraphElement);
      result += text;
    }

    return result;
  }

  // New helper method to decode entities
  private decodeEntities(text: string): string {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  }

  private processSpan(span: XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    const spans = Array.isArray(span) ? span : [span];
    let result = '';

    for (const s of spans) {
      if (!s) continue;

      let content = this.extractElementContent(s);
      // Decode entities after parsing
      content = this.decodeEntities(content);
      // Convert leading tabs to indents before formatting
      content = this.convertLeadingTabsToIndents(content);
      const formatted = this.applyInlineFormatting(content, s, paragraphElement);
      result += formatted;
    }

    return result;
  }

  private processList(list: XamlElement | XamlElement[]): string {
    return this.listProcessor.processListElement(list);
  }



  private processTable(table: XamlElement | XamlElement[]): string {
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

  // New helper methods to detect existing markdown syntax
  private hasMarkdownLinkSyntax(text: string): boolean {
    // Check for markdown link patterns: [text](url) or [text][ref] or ![alt](url)
    const linkPatterns = [
      /\[([^\]]*)\]\(([^)]+)\)/,  // [text](url)
      /\[([^\]]*)\]\[([^\]]*)\]/,  // [text][ref]
      /!\[([^\]]*)\]\(([^)]+)\)/,  // ![alt](url)
      /!\[([^\]]*)\]\[([^\]]*)\]/   // ![alt][ref]
    ];
    
    return linkPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if a UriLink element is part of existing markdown syntax
   * by examining the paragraph context for patterns like '](' before the link
   */
  private isPartOfExistingMarkdown(linkElement: XamlElement, paragraphElement?: XamlElement): boolean {
    if (!paragraphElement) return false;

    // Extract all text content from the paragraph to analyze context
    let paragraphText = '';
    try {
      paragraphText = this.extractParagraphPlainText(paragraphElement);
    } catch {
      return false;
    }

    // Get the URL from the link element to find its position
    const attrs = this.getAttributes(linkElement);
    const url = attrs['@_Uri'] || attrs['@_NavigateUri'] || '';
    if (!url) return false;

    // Look for the URL in the paragraph text
    const urlIndex = paragraphText.indexOf(url);
    if (urlIndex === -1) return false;

    // Check if there's '](' or ']: ' immediately before the URL position
    const beforeUrl = paragraphText.substring(0, urlIndex);
    
    // Look for markdown link/image patterns ending with '](' or ']: ' right before our URL
    // This covers: [text](URL and [text]: URL patterns
    return /\]\(\s*$|]:\s*$/.test(beforeUrl);
  }

  /**
   * Extract plain text from paragraph for context analysis
   */
  private extractParagraphPlainText(paragraph: XamlElement): string {
    let text = '';
    
    // Handle preserveOrder structure
    const paragraphContent = paragraph.Paragraph || paragraph.paragraph || [];
    
    if (Array.isArray(paragraphContent)) {
      for (const item of paragraphContent) {
        text += this.extractPlainTextFromElement(item);
      }
    } else {
      // Fallback to extracting from the paragraph directly
      text = this.extractPlainTextFromElement(paragraph);
    }
    
    return text;
  }

  /**
   * Recursively extract plain text from any element
   */
  private extractPlainTextFromElement(element: any): string {
    if (!element) return '';
    
    if (typeof element === 'string') return element;
    
    let text = '';
    
    // Get direct text content
    if (element['@_Text']) {
      text += element['@_Text'];
    }
    if (element['#text']) {
      text += element['#text'];
    }
    
    // Process child elements
    for (const [key, value] of Object.entries(element)) {
      if (key.startsWith('@_') || key === '#text') continue;
      
      if (Array.isArray(value)) {
        for (const item of value) {
          text += this.extractPlainTextFromElement(item);
        }
      } else if (typeof value === 'object' && value) {
        text += this.extractPlainTextFromElement(value);
      }
    }
    
    return text;
  }

  private hasMarkdownImageSyntax(text: string): boolean {
    // Check for markdown image patterns: ![alt](url) or ![alt][ref]
    const imagePatterns = [
      /!\[([^\]]*)\]\(([^)]+)\)/,  // ![alt](url)
      /!\[([^\]]*)\]\[([^\]]*)\]/   // ![alt][ref]
    ];
    
    return imagePatterns.some(pattern => pattern.test(text));
  }

  private isInCodeContext(element: XamlElement): boolean {
    const attrs = this.getAttributes(element);
    const fontFamily = attrs['@_FontFamily'] || '';
    return this.isMonospaceFont(fontFamily);
  }

  private processHyperlink(hyperlink: XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
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
      if (this.isInCodeContext(link)) {
        // Preserve code context
        result += text;
      } else if (url) {
        // Check if this UriLink is part of existing markdown syntax
        if (this.isPartOfExistingMarkdown(link, paragraphElement)) {
          // Just output the raw URL since it's already part of markdown syntax
          result += url;
        } else if (this.hasMarkdownLinkSyntax(text)) {
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

  public getAttributes(element: XamlElement): Record<string, string> {
    // Handle preserveOrder attribute structure
    if (element[':@']) {
      return element[':@'];
    }
    
    // Fallback to old structure for backward compatibility
    return element;
  }

  private applyInlineFormatting(text: string, element: XamlElement, paragraphElement?: XamlElement): string {
    if (!text) return '';

    // Clean Unicode issues first
    const cleanedText = this.unicodeCleaner.cleanXamlText(text);

    // Handle whitespace around formatting
    const leadingSpace = cleanedText.match(/^\s*/)?.[0] || '';
    const trailingSpace = cleanedText.match(/\s*$/)?.[0] || '';
    let formatted = cleanedText.trim();

    // If the text is only whitespace, return it as is.
    if (formatted === '') {
      return cleanedText;
    }

    // Get attributes using helper method
    const attrs = this.getAttributes(element);

    // Check for inline code (monospace font) - first check run level, then paragraph level
    let fontFamily = attrs['@_FontFamily'] || '';
    
    // If no run-level font family, check paragraph level
    if (!fontFamily && paragraphElement) {
      const paragraphAttrs = this.getAttributes(paragraphElement);
      fontFamily = paragraphAttrs['@_FontFamily'] || '';
    }
    
    if (this.isMonospaceFont(fontFamily)) {
      formatted = '`' + formatted + '`';
      return leadingSpace + formatted + trailingSpace; // Code formatting takes precedence
    }

    // Check for special font sizes - first check run level, then paragraph level
    let fontSize = attrs['@_FontSize'] ? parseFloat(attrs['@_FontSize']) : null;
    
    // If no run-level font size, check paragraph level
    if (fontSize === null && paragraphElement) {
      const paragraphAttrs = this.getAttributes(paragraphElement);
      fontSize = paragraphAttrs['@_FontSize'] ? parseFloat(paragraphAttrs['@_FontSize']) : null;
    }
    
    if (fontSize !== null) {
      if (fontSize <= 9) {
        // Small font sizes (≤9) use <small> tag
        formatted = '<small>' + formatted + '</small> ';
        return leadingSpace + formatted + trailingSpace;
      } else if (fontSize >= 11 && fontSize <= 12) {
        // Normal font sizes (11-12) - no special formatting needed
        // Continue with regular formatting checks
      }
    }

    // Apply text formatting in order: bold, italic, underline, strikethrough, small caps, sub/superscript, highlight
    let needsBold = false;
    let needsItalic = false;
    let needsUnderline = false;
    let needsStrikethrough = false;
    let needsSmallCaps = false;
    let needsSubscript = false;
    let needsSuperscript = false;
    let needsHighlight = false;

    // Check for bold
    const fontBold = attrs['@_FontBold'] || '';
    if (fontBold.toLowerCase() === 'true') {
      needsBold = true;
    }

    // Check for italic
    const fontItalic = attrs['@_FontItalic'] || '';
    if (fontItalic.toLowerCase() === 'true') {
      needsItalic = true;
    }

    // Check for underline
    const hasUnderline = attrs['@_HasUnderline'] || '';
    if (hasUnderline.toLowerCase() === 'true') {
      needsUnderline = true;
    }

    // Check for strikethrough
    const hasStrikethrough = attrs['@_HasStrikethrough'] || '';
    if (hasStrikethrough.toLowerCase() === 'true') {
      needsStrikethrough = true;
    }

    // Check for small caps
    const fontCapitals = attrs['@_FontCapitals'] || '';
    if (fontCapitals.toLowerCase() === 'smallcaps') {
      needsSmallCaps = true;
    }

    // Check for subscript/superscript - first check run level, then paragraph level
    let fontVariant = attrs['@_FontVariant'] || '';
    
    // Only inherit from paragraph if run has NO explicit FontVariant
    if (!fontVariant) {
      if (paragraphElement) {
        const paragraphAttrs = this.getAttributes(paragraphElement);
        const paragraphFontVariant = paragraphAttrs['@_FontVariant'] || '';
        if (paragraphFontVariant && paragraphFontVariant.toLowerCase() !== 'normal') {
          fontVariant = paragraphFontVariant;
        }
      }
    }
    
    if (fontVariant.toLowerCase() === 'subscript') {
      needsSubscript = true;
    } else if (fontVariant.toLowerCase() === 'superscript') {
      needsSuperscript = true;
    }

    // Check for background color highlight
    const backgroundColor = attrs['@_BackgroundColor'] || '';
    if (backgroundColor.trim() !== '') {
      needsHighlight = true;
    }

    // Apply formatting in the correct order (innermost to outermost)
    if (needsSubscript) {
      formatted = this.options.htmlSubSuperscript ? '<sub>' + formatted + '</sub>' : '~' + formatted + '~';
    } else if (needsSuperscript) {
      formatted = this.options.htmlSubSuperscript ? '<sup>' + formatted + '</sup>' : '^' + formatted + '^';
    }

    if (needsSmallCaps) {
      formatted = formatted.toUpperCase();
    }

    if (needsStrikethrough) {
      formatted = '~~' + formatted + '~~';
    }

    if (needsUnderline) {
      formatted = '<u>' + formatted + '</u>';
    }

    if (needsItalic) {
      formatted = '*' + formatted + '*';
    }

    if (needsBold) {
      formatted = '**' + formatted + '**';
    }

    if (needsHighlight) {
      formatted = '==' + formatted + '==';
    }

    return leadingSpace + formatted + trailingSpace;
  }

  private extractElementContent(element: XamlElement, paragraphElement?: XamlElement): string {
    if (!element) return '';

    if (Array.isArray(element)) {  // Added explicit array handling
      let content = '';
      for (const item of element) {
        content += this.extractElementContent(item as XamlElement, paragraphElement);
      }
      return content;
    }

    let content = '';

    // Direct text - clean Unicode issues and convert leading tabs
    if (element['#text']) {
      const cleanText = this.unicodeCleaner.cleanXamlText(element['#text']);
      content += this.convertLeadingTabsToIndents(cleanText);
    }

    // Text attribute - clean Unicode issues and convert leading tabs
    if (element['@_Text']) {
      const cleanText = this.unicodeCleaner.cleanXamlText(element['@_Text']);
      content += this.convertLeadingTabsToIndents(cleanText);
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
        case 'urilink':  // Add this case
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

  private getHeadingLevel(fontSize: number | null): number {
    if (fontSize === null) return 0;
    
    // Use font size ranges to determine heading levels
    if (fontSize >= 23) return 1;      // H1: >= 23
    if (fontSize >= 21) return 2;      // H2: 21-22
    if (fontSize >= 19) return 3;      // H3: 19-20
    if (fontSize >= 17) return 4;      // H4: 17-18
    if (fontSize >= 15) return 5;      // H5: 15-16
    if (fontSize >= 13) return 6;      // H6: 13-14
    
    return 0; // Not a heading size
  }

  private getHeadingLevelFromParagraph(paragraph: XamlElement): number {
    // First, check paragraph-level font size
    const paragraphAttrs = this.getAttributes(paragraph);
    const paragraphFontSize = paragraphAttrs['@_FontSize'] ? parseFloat(paragraphAttrs['@_FontSize']) : null;
    if (paragraphFontSize !== null) {
      const headingLevel = this.getHeadingLevel(paragraphFontSize);
      if (headingLevel > 0) return headingLevel;
    }

    // Then check runs using "first run dominance" approach
    const runs = this.extractRunsFromParagraph(paragraph);
    if (runs.length === 0) return 0;

    // Get font size from first run
    const firstRunAttrs = this.getAttributes(runs[0]);
    const firstRunFontSize = firstRunAttrs['@_FontSize'] ? parseFloat(firstRunAttrs['@_FontSize']) : null;

    if (firstRunFontSize !== null) {
      return this.getHeadingLevel(firstRunFontSize);
    }

    return 0;
  }

  private extractRunsFromParagraph(paragraph: XamlElement): XamlElement[] {
    const runs: XamlElement[] = [];

    // Handle preserveOrder structure - paragraph content is an array
    const paragraphContent = paragraph.Paragraph || paragraph.paragraph || [];
    
    if (Array.isArray(paragraphContent)) {
      for (const item of paragraphContent) {
        if (item && typeof item === 'object') {
          // Check if this item is a Run element
          if (item.Run || item.run) {
            runs.push(item);
          }
        }
      }
    }

    // Fallback to old structure
    for (const [key, value] of Object.entries(paragraph)) {
      if (key.toLowerCase() === 'run') {
        if (Array.isArray(value)) {
          runs.push(...value.filter(v => v && typeof v === 'object'));
        } else if (value && typeof value === 'object') {
          runs.push(value as XamlElement);
        }
      }
    }

    return runs;
  }



  private isMonospaceFont(fontFamily: string): boolean {
    if (!fontFamily) return false;
    
    const lowerFontFamily = fontFamily.toLowerCase();
    
    // Common monospace font families
    const monospaceFonts = [
      'courier new',
      'courier',
      'andale mono',
      'monaco',
      'consolas',
      'lucida console',
      'sf mono',
      'menlo',
      'cascadia code'
    ];
    
    // Check if font family contains any monospace font name
    return monospaceFonts.some(monoFont => lowerFontFamily.includes(monoFont));
  }



  private extractTableRows(table: XamlElement): XamlElement[] {
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

  private extractTableCells(row: XamlElement): string[] {
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

  private extractPlainText(xamlContent: string): string {
    const textMatches = xamlContent.match(/Text="([^"]*?)"/g) || [];
    const plainTexts = textMatches.map(match => {
      let text = match.replace(/Text="([^"]*?)"/, '$1');
      text = this.decodeEntities(text);
      return this.unicodeCleaner.cleanXamlText(text);
    });

    let result = plainTexts.join('\n').trim();

    // Detect and format simple structures
    result = result.replace(/### (.+)/g, '\n\n### $1\n\n');
    result = result.replace(/\b[0-9]+\. /g, '\n$0');
    result = result.replace(/\b\* /g, '\n$0');
    result = result.replace(/\b- /g, '\n$0');

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

  private isParagraph(item: unknown): boolean {
    return !!item && typeof item === 'object' && item !== null && 'Paragraph' in item;
  }



  private isCodeParagraph(paragraph: XamlElement): boolean {
    const runs = this.extractRunsFromParagraph(paragraph);
    if (runs.length === 0) return false;

    return runs.every(run => {
      const attrs = this.getAttributes(run);
      const font = attrs['@_FontFamily'] || '';
      return this.isMonospaceFont(font);
    });
  }

  /**
   * Parse margin string and calculate indent level based on left margin.
   * XAML margin format: "left,top,right,bottom" where left margin indicates indent level.
   * Each indent level is 36 units (36, 72, 108, etc.)
   */
  private parseIndentLevel(margin: string): number {
    if (!margin) return 0;
    
    const parts = margin.split(',').map(s => parseFloat(s.trim()));
    if (parts.length !== 4 || isNaN(parts[0])) return 0;
    
    const leftMargin = parts[0];
    if (leftMargin <= 0) return 0;
    
    // Calculate indent level: each level is 36 units
    const indentLevel = Math.round(leftMargin / 36);
    
    // Cap at maximum 6 levels
    return Math.min(indentLevel, 6);
  }

  /**
   * Format indent level as markdown using blockquotes or non-breaking spaces pattern.
   * Each level uses: one greater than sign '>' per level + space when convertIndentsToQuotes is enabled
   * Otherwise uses: &nbsp; followed by 4 regular spaces per level
   */
  private formatIndent(level: number): string {
    if (level <= 0) return '';
    
    // Use blockquotes for all indent levels when option is enabled (default)
    if (this.options.convertIndentsToQuotes) {
      return '>'.repeat(level) + ' ';
    }
    
    // Each indent level: &nbsp; + 4 spaces
    const singleIndent = '&nbsp;    ';
    return singleIndent.repeat(level);
  }

  /**
   * Convert leading tabs in text content to appropriate indentation format.
   * Each consecutive tab at the beginning of a line becomes one indent level.
   * Maximum of 6 indent levels are supported.
   * Tabs in the middle of lines are preserved unchanged.
   */
  private convertLeadingTabsToIndents(text: string): string {
    if (!text) return text;

    // Split into lines to process each line individually
    const lines = text.split('\n');
    const processedLines = lines.map(line => {
      // Only process lines that start with tabs
      const leadingTabsMatch = line.match(/^(\t+)/);
      if (!leadingTabsMatch) {
        return line; // No leading tabs, return unchanged
      }

      const leadingTabs = leadingTabsMatch[1];
      const remainingContent = line.substring(leadingTabs.length);
      
      // Calculate indent level (max 6)
      const indentLevel = Math.min(leadingTabs.length, 6);
      
      // Generate indent prefix using existing formatIndent logic
      const indentPrefix = this.formatIndent(indentLevel);
      
      // Return line with tabs converted to indents
      return indentPrefix + remainingContent;
    });

    return processedLines.join('\n');
  }

  /**
   * Process UriMedia elements (images) from XAML
   */
  private processUriMedia(element: XamlElement | XamlElement[]): string {
    const elements = Array.isArray(element) ? element : [element];
    let result = '';

    for (const elem of elements) {
      if (!elem) continue;

      const attrs = this.getAttributes(elem);
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