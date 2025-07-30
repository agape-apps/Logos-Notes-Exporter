// XamlElementProcessor - Handles processing of different XAML element types
// Converts XAML elements into their corresponding markdown representations
// Manages element-specific logic for sections, paragraphs, runs, spans, tables, and media

import type { XamlElement, XamlConverterOptions } from './xaml-converter.js';
import { XamlFormattingService } from './xaml-formatting-service.js';
import { XamlUtilities } from './xaml-utilities.js';
import { XamlListProcessor } from './xaml-lists-processor.js';
import { XamlImageProcessor } from './xaml-image-processor.js';

export class XamlElementProcessor {
  private options: XamlConverterOptions;
  private formattingService: XamlFormattingService;
  private utilities: XamlUtilities;
  private listProcessor: XamlListProcessor;
  private imageProcessor?: XamlImageProcessor;
  private pendingImages: Map<string, string> = new Map(); // placeholder -> URL

  constructor(
    options: XamlConverterOptions,
    formattingService: XamlFormattingService,
    utilities: XamlUtilities,
    listProcessor: XamlListProcessor,
    imageProcessor?: XamlImageProcessor
  ) {
    this.options = options;
    this.formattingService = formattingService;
    this.utilities = utilities;
    this.listProcessor = listProcessor;
    this.imageProcessor = imageProcessor;
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
        while (i < element.length && this.utilities.isParagraph(current) && this.utilities.isCodeParagraph(current)) {
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
   * Process Section elements
   */
  private processSection(section: XamlElement | XamlElement[]): string {
    const sections = Array.isArray(section) ? section : [section];
    let result = '';

    for (const sect of sections) {
      if (!sect) continue;

      const fontFamily = sect['@_FontFamily'] || '';
      const content = this.utilities.extractElementContent(sect);

      // Check for code block
      if (this.formattingService.isMonospaceFont(fontFamily)) {
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
   * Process Paragraph elements
   */
  private processParagraph(paragraph: XamlElement | XamlElement[], skipNewline = false): string {
    const paragraphs = Array.isArray(paragraph) ? paragraph : [paragraph];
    let result = '';

    for (const para of paragraphs) {
      if (!para) continue;

      // Get paragraph attributes for margin processing
      const attrs = this.utilities.getAttributes(para);
      const margin = attrs['@_Margin'] || '';

      // Handle preserveOrder structure - get Paragraph content array
      const paragraphContent = para.Paragraph || para.paragraph || [];
      
      // Process paragraph content (array of child elements)
      let content = '';
      if (Array.isArray(paragraphContent)) {
        content = this.processElement(paragraphContent, para);
      } else {
        content = this.utilities.extractElementContent(para, para);
      }

      if (skipNewline) {
        result += content;
      } else {
        if (!content.trim()) {
          result += '\n\n';
          continue;
        }

        // Calculate indent level from margin
        const indentLevel = this.utilities.parseIndentLevel(margin);
        const indentPrefix = this.utilities.formatIndent(indentLevel);

        const headingLevel = this.formattingService.getHeadingLevelFromParagraph(para);
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
   * Process Run elements
   */
  private processRun(run: XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    const runs = Array.isArray(run) ? run : [run];
    let result = '';

    for (const r of runs) {
      if (!r) continue;

      // Get attributes from the Run element
      const attrs = this.utilities.getAttributes(r);
      
      // Get text from attributes
      let text = attrs['@_Text'] || '';
      
      // Fallback to direct text content
      if (!text) {
        text = r['#text'] || '';
      }
      
      if (!text) continue;

      // Decode entities after parsing
      text = this.utilities.decodeEntities(text);

      // Convert leading tabs to indents before other processing
      text = this.utilities.convertLeadingTabsToIndents(text);

      // Check if this is monospace font (code) - preserve as-is without link conversion
      let fontFamily = attrs['@_FontFamily'] || '';
      
      // If no run-level font family, check paragraph level
      if (!fontFamily && paragraphElement) {
        const paragraphAttrs = this.utilities.getAttributes(paragraphElement);
        fontFamily = paragraphAttrs['@_FontFamily'] || '';
      }
      
      if (this.formattingService.isMonospaceFont(fontFamily)) {
        // For code context, preserve existing markdown syntax
        result += '`' + text + '`';
        continue;
      }

      // Check if text already contains markdown syntax - preserve it
      if (this.utilities.hasMarkdownLinkSyntax(text)) {
        result += text;
        continue;
      }

      // Apply inline formatting for non-code, non-markdown content
      text = this.formattingService.applyInlineFormatting(text, r, paragraphElement);
      result += text;
    }

    return result;
  }

  /**
   * Process Span elements
   */
  private processSpan(span: XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    const spans = Array.isArray(span) ? span : [span];
    let result = '';

    for (const s of spans) {
      if (!s) continue;

      let content = this.utilities.extractElementContent(s);
      // Decode entities after parsing
      content = this.utilities.decodeEntities(content);
      // Convert leading tabs to indents before formatting
      content = this.utilities.convertLeadingTabsToIndents(content);
      const formatted = this.formattingService.applyInlineFormatting(content, s, paragraphElement);
      result += formatted;
    }

    return result;
  }

  /**
   * Process List elements
   */
  private processList(list: XamlElement | XamlElement[]): string {
    return this.listProcessor.processListElement(list);
  }

  /**
   * Process Table elements
   */
  private processTable(table: XamlElement | XamlElement[]): string {
    const tables = Array.isArray(table) ? table : [table];
    let result = '';

    for (const t of tables) {
      if (!t) continue;

      const rows = this.utilities.extractTableRows(t);
      if (rows.length === 0) continue;

      // Process header row
      if (rows.length > 0) {
        const headerCells = this.utilities.extractTableCells(rows[0] as XamlElement);
        const headerRow = '| ' + headerCells.join(' | ') + ' |';
        const separatorRow = '| ' + headerCells.map(() => '---').join(' | ') + ' |';
        
        result += headerRow + '\n' + separatorRow + '\n';

        // Process data rows
        for (let i = 1; i < rows.length; i++) {
          const cells = this.utilities.extractTableCells(rows[i] as XamlElement);
          const dataRow = '| ' + cells.join(' | ') + ' |';
          result += dataRow + '\n';
        }
      }

      result += '\n';
    }

    return result;
  }

  /**
   * Process Hyperlink elements
   */
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
      if (this.utilities.isInCodeContext(link)) {
        // Preserve code context
        result += text;
      } else if (url) {
        // Check if this UriLink is part of existing markdown syntax
        if (this.utilities.isPartOfExistingMarkdown(link, paragraphElement)) {
          // Just output the raw URL since it's already part of markdown syntax
          result += url;
        } else if (this.utilities.hasMarkdownLinkSyntax(text)) {
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
  private processUriMedia(element: XamlElement | XamlElement[]): string {
    const elements = Array.isArray(element) ? element : [element];
    let result = '';

    for (const elem of elements) {
      if (!elem) continue;

      const attrs = this.utilities.getAttributes(elem);
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
   * Get pending images for processing
   */
  public getPendingImages(): Map<string, string> {
    return this.pendingImages;
  }

  /**
   * Clear pending images
   */
  public clearPendingImages(): void {
    this.pendingImages.clear();
  }
}