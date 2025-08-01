// XAML utility functions and validation routines
// Provides helper methods for element validation, attribute handling, and markdown syntax detection
// Contains common utility functions used across XAML processing modules

import type { XamlElement } from './types/xaml-types.js';

export class XamlUtils {
  public isXamlElement(value: unknown): value is XamlElement {
    return value !== null && typeof value === 'object';
  }

  public getAttributes(element: XamlElement): Record<string, string> {
    if (element[':@']) {
      return element[':@'];
    }
    
    return element;
  }

  public isParagraph(item: unknown): boolean {
    return !!item && typeof item === 'object' && item !== null && 'Paragraph' in item;
  }

  public isCodeParagraph(paragraph: XamlElement): boolean {
    const runs = this.extractRunsFromParagraph(paragraph);
    if (runs.length === 0) return false;

    return runs.every(run => {
      const attrs = this.getAttributes(run);
      const font = attrs['@_FontFamily'] || '';
      return this.isMonospaceFont(font);
    });
  }

  private extractRunsFromParagraph(paragraph: XamlElement): XamlElement[] {
    const runs: XamlElement[] = [];

    const paragraphContent = paragraph.Paragraph || paragraph.paragraph || [];
    
    if (Array.isArray(paragraphContent)) {
      for (const item of paragraphContent) {
        if (item && typeof item === 'object') {
          if (item.Run || item.run) {
            runs.push(item);
          }
        }
      }
    }

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

  public isMonospaceFont(fontFamily: string): boolean {
    if (!fontFamily) return false;
    
    const lowerFontFamily = fontFamily.toLowerCase();
    
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
    
    return monospaceFonts.some(monoFont => lowerFontFamily.includes(monoFont));
  }

  public hasMarkdownLinkSyntax(text: string): boolean {
    const linkPatterns = [
      /\[([^\]]*)\]\(([^)]+)\)/,  // [text](url)
      /\[([^\]]*)\]\[([^\]]*)\]/,  // [text][ref]
      /!\[([^\]]*)\]\(([^)]+)\)/,  // ![alt](url)
      /!\[([^\]]*)\]\[([^\]]*)\]/   // ![alt][ref]
    ];
    
    return linkPatterns.some(pattern => pattern.test(text));
  }

  public isPartOfExistingMarkdown(linkElement: XamlElement, paragraphElement?: XamlElement): boolean {
    if (!paragraphElement) return false;

    let paragraphText = '';
    try {
      paragraphText = this.extractParagraphPlainText(paragraphElement);
    } catch {
      return false;
    }

    const attrs = this.getAttributes(linkElement);
    const url = attrs['@_Uri'] || attrs['@_NavigateUri'] || '';
    if (!url) return false;

    const urlIndex = paragraphText.indexOf(url);
    if (urlIndex === -1) return false;

    const beforeUrl = paragraphText.substring(0, urlIndex);
    
    return /\]\(\s*$|]:\s*$/.test(beforeUrl);
  }

  private extractParagraphPlainText(paragraph: XamlElement): string {
    let text = '';
    
    const paragraphContent = paragraph.Paragraph || paragraph.paragraph || [];
    
    if (Array.isArray(paragraphContent)) {
      for (const item of paragraphContent) {
        text += this.extractPlainTextFromElement(item);
      }
    } else {
      text = this.extractPlainTextFromElement(paragraph);
    }
    
    return text;
  }

  private extractPlainTextFromElement(element: unknown): string {
    if (!element) return '';
    
    if (typeof element === 'string') return element;
    
    let text = '';
    
    // Type guard for objects with potential text properties
    if (typeof element === 'object' && element) {
      const elem = element as Record<string, unknown>;
      
      if (elem['@_Text'] && typeof elem['@_Text'] === 'string') {
        text += elem['@_Text'];
      }
      if (elem['#text'] && typeof elem['#text'] === 'string') {
        text += elem['#text'];
      }
      
      for (const [key, value] of Object.entries(elem)) {
        if (key.startsWith('@_') || key === '#text') continue;
        
        if (Array.isArray(value)) {
          for (const item of value) {
            text += this.extractPlainTextFromElement(item);
          }
        } else if (typeof value === 'object' && value) {
          text += this.extractPlainTextFromElement(value);
        }
      }
    }
    
    return text;
  }

  public hasMarkdownImageSyntax(text: string): boolean {
    const imagePatterns = [
      /!\[([^\]]*)\]\(([^)]+)\)/,  // ![alt](url)
      /!\[([^\]]*)\]\[([^\]]*)\]/   // ![alt][ref]
    ];
    
    return imagePatterns.some(pattern => pattern.test(text));
  }

  public isInCodeContext(element: XamlElement): boolean {
    const attrs = this.getAttributes(element);
    const fontFamily = attrs['@_FontFamily'] || '';
    return this.isMonospaceFont(fontFamily);
  }
}