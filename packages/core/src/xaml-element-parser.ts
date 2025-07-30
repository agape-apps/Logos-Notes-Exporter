// XML parsing utilities and element validation for XAML conversion
// Handles XML parsing configuration, element type checking, and content extraction
// Part of the modular XAML to Markdown conversion system

import { XMLParser } from 'fast-xml-parser';
import { UnicodeCleaner } from './unicode-cleaner.js';

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

export class XamlElementParser {
  private parser: XMLParser;
  private unicodeCleaner: UnicodeCleaner;

  constructor() {
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
  }

  /**
   * Clean XAML content by removing XML declarations and namespaces
   */
  public cleanXamlContent(xaml: string): string {
    // Remove XML declarations and namespaces
    let cleaned = xaml.replace(/<\?xml[^>]*\?>/gi, '');
    cleaned = cleaned.replace(/xmlns[^=]*="[^"]*"/gi, '');
   
    return cleaned.trim();
  }

  /**
   * Parse XAML content into a structured object
   */
  public parseXaml(xamlContent: string): any {
    const cleanedXaml = this.cleanXamlContent(xamlContent);
    if (!cleanedXaml.trim()) {
      return null;
    }

    // Wrap in Root to handle multiple roots
    const wrappedXaml = `<Root>${cleanedXaml}</Root>`;
    return this.parser.parse(wrappedXaml);
  }

  /**
   * Check if a value is a valid XAML element
   */
  public isXamlElement(value: unknown): value is XamlElement {
    return value !== null && typeof value === 'object';
  }

  /**
   * Check if an item is a paragraph element
   */
  public isParagraph(item: unknown): boolean {
    return !!item && typeof item === 'object' && item !== null && 'Paragraph' in item;
  }

  /**
   * Get attributes from a XAML element, handling preserveOrder structure
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
   * Extract plain text content from XAML element
   */
  public extractElementContent(element: XamlElement): string {
    if (!element) return '';

    if (Array.isArray(element)) {
      let content = '';
      for (const item of element) {
        content += this.extractElementContent(item as XamlElement);
      }
      return content;
    }

    let content = '';

    // Direct text - clean Unicode issues
    if (element['#text']) {
      const cleanText = this.unicodeCleaner.cleanXamlText(element['#text']);
      content += cleanText;
    }

    // Text attribute - clean Unicode issues
    if (element['@_Text']) {
      const cleanText = this.unicodeCleaner.cleanXamlText(element['@_Text']);
      content += cleanText;
    }

    return content;
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
   * Extract plain text from XAML content using regex (fallback method)
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
}