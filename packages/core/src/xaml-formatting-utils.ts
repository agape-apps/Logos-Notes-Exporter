// Text formatting utilities and helper functions for XAML conversion
// Handles inline formatting, indentation, markdown syntax detection, and text processing
// Part of the modular XAML to Markdown conversion system

import { UnicodeCleaner } from './unicode-cleaner.js';
import type { XamlElement } from './xaml-element-parser.js';

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

export class XamlFormattingUtils {
  private unicodeCleaner: UnicodeCleaner;
  private options: XamlConverterOptions;

  constructor(options: XamlConverterOptions) {
    this.options = options;
    this.unicodeCleaner = new UnicodeCleaner();
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
   * Parse margin string and calculate indent level based on left margin
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
   * Format indent level as markdown using blockquotes or non-breaking spaces
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
   * Convert leading tabs in text content to appropriate indentation format
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
   * Check if text has markdown link syntax
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
   * Check if text has markdown image syntax
   */
  public hasMarkdownImageSyntax(text: string): boolean {
    // Check for markdown image patterns: ![alt](url) or ![alt][ref]
    const imagePatterns = [
      /!\[([^\]]*)\]\(([^)]+)\)/,  // ![alt](url)
      /!\[([^\]]*)\]\[([^\]]*)\]/   // ![alt][ref]
    ];
    
    return imagePatterns.some(pattern => pattern.test(text));
  }
}