// XamlFormattingService - Handles text formatting and styling operations
// Applies inline formatting like bold, italic, underline, code formatting
// Manages font-based formatting decisions including heading levels and monospace detection

import type { XamlElement, XamlConverterOptions } from './xaml-converter.js';
import { UnicodeCleaner } from './unicode-cleaner.js';
import { XamlUtilities } from './xaml-utilities.js';

export class XamlFormattingService {
  private options: XamlConverterOptions;
  private unicodeCleaner: UnicodeCleaner;
  private utilities: XamlUtilities;

  constructor(options: XamlConverterOptions, utilities: XamlUtilities) {
    this.options = options;
    this.unicodeCleaner = new UnicodeCleaner();
    this.utilities = utilities;
  }

  /**
   * Apply inline formatting to text based on XAML element attributes
   */
  public applyInlineFormatting(text: string, element: XamlElement, paragraphElement?: XamlElement): string {
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
    const attrs = this.utilities.getAttributes(element);

    // Check for inline code (monospace font) - first check run level, then paragraph level
    let fontFamily = attrs['@_FontFamily'] || '';
    
    // If no run-level font family, check paragraph level
    if (!fontFamily && paragraphElement) {
      const paragraphAttrs = this.utilities.getAttributes(paragraphElement);
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
      const paragraphAttrs = this.utilities.getAttributes(paragraphElement);
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
        const paragraphAttrs = this.utilities.getAttributes(paragraphElement);
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

  /**
   * Check if font family represents a monospace font
   */
  public isMonospaceFont(fontFamily: string): boolean {
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
   * Get heading level from font size
   */
  public getHeadingLevel(fontSize: number | null): number {
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

  /**
   * Get heading level from paragraph element
   */
  public getHeadingLevelFromParagraph(paragraph: XamlElement): number {
    // First, check paragraph-level font size
    const paragraphAttrs = this.utilities.getAttributes(paragraph);
    const paragraphFontSize = paragraphAttrs['@_FontSize'] ? parseFloat(paragraphAttrs['@_FontSize']) : null;
    if (paragraphFontSize !== null) {
      const headingLevel = this.getHeadingLevel(paragraphFontSize);
      if (headingLevel > 0) return headingLevel;
    }

    // Then check runs using "first run dominance" approach
    const runs = this.utilities.extractRunsFromParagraph(paragraph);
    if (runs.length === 0) return 0;

    // Get font size from first run
    const firstRunAttrs = this.utilities.getAttributes(runs[0]);
    const firstRunFontSize = firstRunAttrs['@_FontSize'] ? parseFloat(firstRunAttrs['@_FontSize']) : null;

    if (firstRunFontSize !== null) {
      return this.getHeadingLevel(firstRunFontSize);
    }

    return 0;
  }
}