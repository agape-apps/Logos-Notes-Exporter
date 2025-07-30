import type { XamlElement } from './xaml-text-formatter.js';

/**
 * Handles content analysis and validation for XAML elements
 */
export class XamlContentAnalyzer {

  /**
   * Type guard to check if a value is a XAML element
   */
  public isXamlElement(value: unknown): value is XamlElement {
    return value !== null && typeof value === 'object';
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
   * Check if a UriLink element is part of existing markdown syntax
   * by examining the paragraph context for patterns like '](' before the link
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
   * Check if element is in code context (monospace font)
   */
  public isInCodeContext(element: XamlElement): boolean {
    const attrs = this.getAttributes(element);
    const fontFamily = attrs['@_FontFamily'] || '';
    return this.isMonospaceFont(fontFamily);
  }

  /**
   * Check if element represents a paragraph
   */
  public isParagraph(item: unknown): boolean {
    return !!item && typeof item === 'object' && item !== null && 'Paragraph' in item;
  }

  /**
   * Check if paragraph is a code paragraph (all runs use monospace font)
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
   * Get element attributes, handling preserveOrder structure
   */
  private getAttributes(element: XamlElement): Record<string, string> {
    // Handle preserveOrder attribute structure
    if (element[':@']) {
      return element[':@'];
    }
    
    // Fallback to old structure for backward compatibility
    return element;
  }

  /**
   * Extract runs from paragraph element
   */
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

  /**
   * Check if font family is monospace
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
}