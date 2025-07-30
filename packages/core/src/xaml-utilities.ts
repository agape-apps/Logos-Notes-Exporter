// XamlUtilities - Utility functions for XAML processing
// Handles validation, text manipulation, element parsing, and markdown detection
// Provides helper functions for attribute handling and content extraction

import type { XamlElement, XamlConverterOptions } from './xaml-converter.js';
import { UnicodeCleaner } from './unicode-cleaner.js';

export class XamlUtilities {
  private options: XamlConverterOptions;
  private unicodeCleaner: UnicodeCleaner;

  constructor(options: XamlConverterOptions) {
    this.options = options;
    this.unicodeCleaner = new UnicodeCleaner();
  }

  /**
   * Get attributes from XAML element (handles preserveOrder format)
   */
  public getAttributes(element: XamlElement): Record<string, string> {
    // Handle preserveOrder attribute structure
    if (element[':@']) {
      return element[':@'];
    }
    
    // Fallback to old structure for backward compatibility
    return element;
  }

  /**
   * Extract content from XAML element
   */
  public extractElementContent(element: XamlElement, paragraphElement?: XamlElement): string {
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
        case 'span':
        case 'hyperlink':
        case 'urilink':
        case 'list':
        case 'table':
          // These will be handled by the element processor
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
   * Decode HTML entities in text
   */
  public decodeEntities(text: string): string {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  }

  /**
   * Check if text contains markdown link syntax
   */
  public hasMarkdownLinkSyntax(text: string): boolean {
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
   * Check if text contains markdown image syntax
   */
  public hasMarkdownImageSyntax(text: string): boolean {
    // Check for markdown image patterns: ![alt](url) or ![alt][ref]
    const imagePatterns = [
      /!\[([^\]]*)\]\(([^)]+)\)/,  // ![alt](url)
      /!\[([^\]]*)\]\[([^\]]*)\]/   // ![alt][ref]
    ];
    
    return imagePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if element is in code context
   */
  public isInCodeContext(element: XamlElement): boolean {
    const attrs = this.getAttributes(element);
    const fontFamily = attrs['@_FontFamily'] || '';
    return this.isMonospaceFont(fontFamily);
  }

  /**
   * Check if font family represents monospace
   */
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

  /**
   * Check if UriLink element is part of existing markdown syntax
   */
  public isPartOfExistingMarkdown(linkElement: XamlElement, paragraphElement?: XamlElement): boolean {
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
  public extractParagraphPlainText(paragraph: XamlElement): string {
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
  public extractPlainTextFromElement(element: any): string {
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

  /**
   * Check if item is a paragraph element
   */
  public isParagraph(item: unknown): boolean {
    return !!item && typeof item === 'object' && item !== null && 'Paragraph' in item;
  }

  /**
   * Check if paragraph is a code paragraph
   */
  public isCodeParagraph(paragraph: XamlElement): boolean {
    const runs = this.extractRunsFromParagraph(paragraph);
    if (runs.length === 0) return false;

    return runs.every(run => {
      const attrs = this.getAttributes(run);
      const font = attrs['@_FontFamily'] || '';
      return this.isMonospaceFont(font);
    });
  }

  /**
   * Extract runs from paragraph element
   */
  public extractRunsFromParagraph(paragraph: XamlElement): XamlElement[] {
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
   * Parse margin string and calculate indent level
   */
  public parseIndentLevel(margin: string): number {
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
   * Format indent level as markdown
   */
  public formatIndent(level: number): string {
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
   * Convert leading tabs in text to indentation format
   */
  public convertLeadingTabsToIndents(text: string): string {
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
   * Normalize markdown output
   */
  public normalizeMarkdown(markdown: string): string {
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
   * Extract plain text from XAML content (fallback method)
   */
  public extractPlainText(xamlContent: string): string {
    const textMatches = xamlContent.match(/Text="([^"]*?)"/g) || [];
    const plainTexts = textMatches.map((match) => {
      let text = match.replace(/Text="([^"]*?)"/, "$1");
      text = this.decodeEntities(text);
      return this.unicodeCleaner.cleanXamlText(text);
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
}