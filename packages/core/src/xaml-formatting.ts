// XAML text formatting and styling operations
// Handles inline formatting, heading detection, indentation, and font styling for XAML conversion
// Provides comprehensive text formatting with font-based styling and markdown output

import { UnicodeCleaner } from './unicode-cleaner.js';
import type { XamlConverterOptions, XamlElement } from './types/xaml-types.js';
import type { XamlUtils } from './xaml-utils.js';

export class XamlFormatter {
  private options: XamlConverterOptions;
  private unicodeCleaner: UnicodeCleaner;
  private utils: XamlUtils;

  constructor(options: XamlConverterOptions, utils: XamlUtils) {
    this.options = options;
    this.utils = utils;
    this.unicodeCleaner = new UnicodeCleaner();
  }

  public applyInlineFormatting(text: string, element: XamlElement, paragraphElement?: XamlElement): string {
    if (!text) return '';

    const cleanedText = this.unicodeCleaner.cleanXamlText(text);

    const leadingSpace = cleanedText.match(/^\s*/)?.[0] || '';
    const trailingSpace = cleanedText.match(/\s*$/)?.[0] || '';
    let formatted = cleanedText.trim();

    if (formatted === '') {
      return cleanedText;
    }

    const attrs = this.utils.getAttributes(element);

    let fontFamily = attrs['@_FontFamily'] || '';
    
    if (!fontFamily && paragraphElement) {
      const paragraphAttrs = this.utils.getAttributes(paragraphElement);
      fontFamily = paragraphAttrs['@_FontFamily'] || '';
    }
    
    if (this.utils.isMonospaceFont(fontFamily)) {
      formatted = '`' + formatted + '`';
      return leadingSpace + formatted + trailingSpace;
    }

    let fontSize = attrs['@_FontSize'] ? parseFloat(attrs['@_FontSize']) : null;
    
    if (fontSize === null && paragraphElement) {
      const paragraphAttrs = this.utils.getAttributes(paragraphElement);
      fontSize = paragraphAttrs['@_FontSize'] ? parseFloat(paragraphAttrs['@_FontSize']) : null;
    }
    
    if (fontSize !== null) {
      if (fontSize <= 9) {
        formatted = '<small>' + formatted + '</small> ';
        return leadingSpace + formatted + trailingSpace;
      } else if (fontSize >= 11 && fontSize <= 12) {
        // Normal font sizes - continue with regular formatting
      }
    }

    let needsBold = false;
    let needsItalic = false;
    let needsUnderline = false;
    let needsStrikethrough = false;
    let needsSmallCaps = false;
    let needsSubscript = false;
    let needsSuperscript = false;
    let needsHighlight = false;

    const fontBold = attrs['@_FontBold'] || '';
    if (fontBold.toLowerCase() === 'true') {
      needsBold = true;
    }

    const fontItalic = attrs['@_FontItalic'] || '';
    if (fontItalic.toLowerCase() === 'true') {
      needsItalic = true;
    }

    const hasUnderline = attrs['@_HasUnderline'] || '';
    if (hasUnderline.toLowerCase() === 'true') {
      needsUnderline = true;
    }

    const hasStrikethrough = attrs['@_HasStrikethrough'] || '';
    if (hasStrikethrough.toLowerCase() === 'true') {
      needsStrikethrough = true;
    }

    const fontCapitals = attrs['@_FontCapitals'] || '';
    if (fontCapitals.toLowerCase() === 'smallcaps') {
      needsSmallCaps = true;
    }

    let fontVariant = attrs['@_FontVariant'] || '';
    
    if (!fontVariant) {
      if (paragraphElement) {
        const paragraphAttrs = this.utils.getAttributes(paragraphElement);
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

    const backgroundColor = attrs['@_BackgroundColor'] || '';
    if (backgroundColor.trim() !== '') {
      needsHighlight = true;
    }

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

  public getHeadingLevel(fontSize: number | null): number {
    if (fontSize === null) return 0;
    
    if (fontSize >= 23) return 1;
    if (fontSize >= 21) return 2;
    if (fontSize >= 19) return 3;
    if (fontSize >= 17) return 4;
    if (fontSize >= 15) return 5;
    if (fontSize >= 13) return 6;
    
    return 0;
  }

  public getHeadingLevelFromParagraph(paragraph: XamlElement): number {
    const paragraphAttrs = this.utils.getAttributes(paragraph);
    const paragraphFontSize = paragraphAttrs['@_FontSize'] ? parseFloat(paragraphAttrs['@_FontSize']) : null;
    if (paragraphFontSize !== null) {
      const headingLevel = this.getHeadingLevel(paragraphFontSize);
      if (headingLevel > 0) return headingLevel;
    }

    const runs = this.extractRunsFromParagraph(paragraph);
    if (runs.length === 0) return 0;

    const firstRunAttrs = this.utils.getAttributes(runs[0]);
    const firstRunFontSize = firstRunAttrs['@_FontSize'] ? parseFloat(firstRunAttrs['@_FontSize']) : null;

    if (firstRunFontSize !== null) {
      return this.getHeadingLevel(firstRunFontSize);
    }

    return 0;
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

  public parseIndentLevel(margin: string): number {
    if (!margin) return 0;
    
    const parts = margin.split(',').map(s => parseFloat(s.trim()));
    if (parts.length !== 4 || isNaN(parts[0])) return 0;
    
    const leftMargin = parts[0];
    if (leftMargin <= 0) return 0;
    
    const indentLevel = Math.round(leftMargin / 36);
    
    return Math.min(indentLevel, 6);
  }

  public formatIndent(level: number): string {
    if (level <= 0) return '';
    
    if (this.options.convertIndentsToQuotes) {
      return '>'.repeat(level) + ' ';
    }
    
    const singleIndent = '&nbsp;    ';
    return singleIndent.repeat(level);
  }

  public convertLeadingTabsToIndents(text: string): string {
    if (!text) return text;

    const lines = text.split('\n');
    const processedLines = lines.map(line => {
      const leadingTabsMatch = line.match(/^(\t+)/);
      if (!leadingTabsMatch) {
        return line;
      }

      const leadingTabs = leadingTabsMatch[1];
      const remainingContent = line.substring(leadingTabs.length);
      
      const indentLevel = Math.min(leadingTabs.length, 6);
      
      const indentPrefix = this.formatIndent(indentLevel);
      
      return indentPrefix + remainingContent;
    });

    return processedLines.join('\n');
  }
}