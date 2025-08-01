// XAML element processing and conversion operations
// Handles processing of different XAML element types (paragraphs, runs, spans, lists, tables, hyperlinks)
// Provides core element conversion logic with content extraction and structure handling

import { XamlListProcessor } from './xaml-lists-processor.js';
import { XamlImageProcessor, type ImageProcessingOptions } from './xaml-image-processor.js';
import type { XamlConverterOptions, XamlElement } from './types/xaml-types.js';
import type { IXamlElementProcessor } from './types/processor-interface.js';
import type { XamlUtils } from './xaml-utils.js';
import type { XamlFormatter } from './xaml-formatting.js';
import type { XamlParser } from './xaml-parser.js';

export class XamlElementProcessor implements IXamlElementProcessor {
  private options: XamlConverterOptions;
  private listProcessor: XamlListProcessor;
  private imageProcessor?: XamlImageProcessor;
  private pendingImages: Map<string, string> = new Map();
  private utils: XamlUtils;
  private formatter: XamlFormatter;
  private parser: XamlParser;

  constructor(
    options: XamlConverterOptions,
    utils: XamlUtils,
    formatter: XamlFormatter,
    parser: XamlParser
  ) {
    this.options = options;
    this.utils = utils;
    this.formatter = formatter;
    this.parser = parser;
    this.listProcessor = new XamlListProcessor(this);
    
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
        while (i < element.length && this.utils.isParagraph(current) && this.utils.isCodeParagraph(current)) {
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

    let result = '';

    for (const [tagName, content] of Object.entries(element)) {
      if (tagName === ':@') {
        continue;
      }

      switch (tagName.toLowerCase()) {
        case 'root':
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

      if (this.utils.isMonospaceFont(fontFamily)) {
        const language = sect['@_Tag'] || '';
        result += '```' + language + '\n' + content + '\n```\n\n';
        continue;
      }

      result += content + '\n\n';
    }

    return result;
  }

  public processParagraph(paragraph: XamlElement | XamlElement[], skipNewline = false): string {
    const paragraphs = Array.isArray(paragraph) ? paragraph : [paragraph];
    let result = '';

    for (const para of paragraphs) {
      if (!para) continue;

      const attrs = this.utils.getAttributes(para);
      const margin = attrs['@_Margin'] || '';

      const paragraphContent = para.Paragraph || para.paragraph || [];
      
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

        const indentLevel = this.formatter.parseIndentLevel(margin);
        const indentPrefix = this.formatter.formatIndent(indentLevel);

        const headingLevel = this.formatter.getHeadingLevelFromParagraph(para);
        if (headingLevel > 0) {
          result += indentPrefix + '#'.repeat(headingLevel) + ' ' + content.trim() + '\n';
        } else {
          result += indentPrefix + content.trimEnd() + '  \n';
        }
      }
    }

    return result;
  }

  public processRun(run: XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    const runs = Array.isArray(run) ? run : [run];
    let result = '';

    for (const r of runs) {
      if (!r) continue;

      const attrs = this.utils.getAttributes(r);
      
      let text = attrs['@_Text'] || '';
      
      if (!text) {
        text = r['#text'] || '';
      }
      
      if (!text) continue;

      text = this.parser.decodeEntities(text);
      text = this.formatter.convertLeadingTabsToIndents(text);

      let fontFamily = attrs['@_FontFamily'] || '';
      
      if (!fontFamily && paragraphElement) {
        const paragraphAttrs = this.utils.getAttributes(paragraphElement);
        fontFamily = paragraphAttrs['@_FontFamily'] || '';
      }
      
      if (this.utils.isMonospaceFont(fontFamily)) {
        result += '`' + text + '`';
        continue;
      }

      if (this.utils.hasMarkdownLinkSyntax(text)) {
        result += text;
        continue;
      }

      text = this.formatter.applyInlineFormatting(text, r, paragraphElement);
      result += text;
    }

    return result;
  }

  private processSpan(span: XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    const spans = Array.isArray(span) ? span : [span];
    let result = '';

    for (const s of spans) {
      if (!s) continue;

      let content = this.extractElementContent(s);
      content = this.parser.decodeEntities(content);
      content = this.formatter.convertLeadingTabsToIndents(content);
      const formatted = this.formatter.applyInlineFormatting(content, s, paragraphElement);
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

      if (rows.length > 0) {
        const headerCells = this.extractTableCells(rows[0] as XamlElement);
        const headerRow = '| ' + headerCells.join(' | ') + ' |';
        const separatorRow = '| ' + headerCells.map(() => '---').join(' | ') + ' |';
        
        result += headerRow + '\n' + separatorRow + '\n';

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

  private processHyperlink(hyperlink: XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    const hyperlinks = Array.isArray(hyperlink) ? hyperlink : [hyperlink];
    let result = '';

    for (const link of hyperlinks) {
      if (!link) continue;

      const attrs = link[':@'] || link;
      const url = attrs['@_Uri'] || attrs['@_NavigateUri'] || '';

      let text = '';
      if (Array.isArray(link)) {
        text = this.processElement(link, paragraphElement);
      } else {
        for (const [childKey, childValue] of Object.entries(link)) {
          if (childKey !== ':@') {
            text += this.processElement(childValue, paragraphElement);
          }
        }
      }

      text = text.trim();
      if (!text) continue;

      if (this.utils.isInCodeContext(link)) {
        result += text;
      } else if (url) {
        if (this.utils.isPartOfExistingMarkdown(link, paragraphElement)) {
          result += url;
        } else if (this.utils.hasMarkdownLinkSyntax(text)) {
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

  private processUriMedia(element: XamlElement | XamlElement[]): string {
    const elements = Array.isArray(element) ? element : [element];
    let result = '';

    for (const elem of elements) {
      if (!elem) continue;

      const attrs = this.utils.getAttributes(elem);
      const uri = attrs['@_Uri'] || '';

      if (!uri) continue;

      if (!this.imageProcessor) {
        result += '![image unavailable]()\n\n';
        continue;
      }

      const placeholderId = `IMAGE_PLACEHOLDER_${this.pendingImages.size + 1}`;
      this.pendingImages.set(placeholderId, uri);
      
      result += `![${placeholderId}]()\n\n`;
    }

    return result;
  }

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

    if (element['#text']) {
      const cleanText = element['#text'];
      content += this.formatter.convertLeadingTabsToIndents(cleanText);
    }

    if (element['@_Text']) {
      const cleanText = element['@_Text'];
      content += this.formatter.convertLeadingTabsToIndents(cleanText);
    }

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

  public async processCollectedImages(markdown: string): Promise<string> {
    if (!this.imageProcessor || this.pendingImages.size === 0) {
      return markdown;
    }

    let processedMarkdown = markdown;

    for (const [placeholderId, uri] of this.pendingImages) {
      try {
        const result = await this.imageProcessor.processUriMediaElement({
          '@_Uri': uri
        } as XamlElement);

        const placeholderPattern = `![${placeholderId}]()`;
        processedMarkdown = processedMarkdown.replace(placeholderPattern, result.trim());
      } catch {
        const placeholderPattern = `![${placeholderId}]()`;
        processedMarkdown = processedMarkdown.replace(placeholderPattern, '![image unavailable]()');
      }
    }

    return processedMarkdown;
  }

  public clearCollectedImages(): void {
    this.pendingImages.clear();
    if (this.imageProcessor) {
      this.imageProcessor.resetStats();
    }
  }

  public getImageStats() {
    return this.imageProcessor ? this.imageProcessor.getStats() : null;
  }

  public getImageFailures() {
    return this.imageProcessor ? this.imageProcessor.getFailures() : [];
  }

  public getAttributes(element: XamlElement): Record<string, string> {
    return this.utils.getAttributes(element);
  }
}