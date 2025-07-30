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

export interface TextFormatterOptions {
  /** Font sizes that correspond to heading levels [H1, H2, H3, H4, H5, H6] */
  headingSizes: number[];
  /** Use HTML sub/superscript tags instead of Pandoc-style formatting */
  htmlSubSuperscript: boolean;
  /** Convert all indent levels to blockquotes instead of &nbsp; indentation */
  convertIndentsToQuotes: boolean;
}

/**
 * Handles text formatting, entity decoding, and indentation processing for XAML content
 */
export class XamlTextFormatter {
  private unicodeCleaner: UnicodeCleaner;
  private options: TextFormatterOptions;

  constructor(options: TextFormatterOptions) {
    this.options = options;
    this.unicodeCleaner = new UnicodeCleaner();
  }

  /**
   * Decode HTML entities in text content
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
   * Get element attributes, handling preserveOrder structure
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
   * Apply inline formatting (bold, italic, underline, etc.) to text
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

  /**
   * Get heading level based on font size
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
   * Parse margin string and calculate indent level based on left margin.
   * XAML margin format: "left,top,right,bottom" where left margin indicates indent level.
   * Each indent level is 36 units (36, 72, 108, etc.)
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
   * Format indent level as markdown using blockquotes or non-breaking spaces pattern.
   * Each level uses: one greater than sign '>' per level + space when convertIndentsToQuotes is enabled
   * Otherwise uses: &nbsp; followed by 4 regular spaces per level
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
   * Convert leading tabs in text content to appropriate indentation format.
   * Each consecutive tab at the beginning of a line becomes one indent level.
   * Maximum of 6 indent levels are supported.
   * Tabs in the middle of lines are preserved unchanged.
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
}