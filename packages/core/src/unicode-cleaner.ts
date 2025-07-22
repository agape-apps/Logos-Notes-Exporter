/**
 * Unicode cleaning utilities for Logos notes export
 */

export interface UnicodeCleanerOptions {
  /** Remove zero-width characters */
  removeZeroWidth: boolean;
  /** Remove control characters (except tab, newline, carriage return) */
  removeControlChars: boolean;
  /** Apply additional cleanup patterns */
  enableAdvancedCleaning: boolean;
}

const DEFAULT_OPTIONS: UnicodeCleanerOptions = {
  removeZeroWidth: true,
  removeControlChars: true,
  enableAdvancedCleaning: false,
};

export class UnicodeCleaner {
  private options: UnicodeCleanerOptions;

  constructor(options: Partial<UnicodeCleanerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // Clean problematic Unicode characters
  public cleanText(text: string): string {
    if (!text) {
      return text;
    }

    let cleaned = text;

    // Remove zero-width characters and other problematic Unicode
    if (this.options.removeZeroWidth) {
      cleaned = this.removeZeroWidthCharacters(cleaned);
    }

    // Remove control characters except common ones
    if (this.options.removeControlChars) {
      cleaned = this.removeControlCharacters(cleaned);
    }

    // Apply advanced cleaning patterns if enabled
    if (this.options.enableAdvancedCleaning) {
      cleaned = this.applyAdvancedCleaning(cleaned);
    }

    return cleaned;
  }

  // Remove zero-width characters and other invisible Unicode
  private removeZeroWidthCharacters(text: string): string {
    // Common zero-width and invisible characters
    const zeroWidthChars = [
      '\ufeff', // Byte Order Mark
      '\u200b', // Zero Width Space
      '\u200c', // Zero Width Non-Joiner
      '\u200d', // Zero Width Joiner
      '\u200e', // Left-to-Right Mark
      '\u200f', // Right-to-Left Mark
      '\u2060', // Word Joiner
      '\u2061', // Function Application
      '\u2062', // Invisible Times
      '\u2063', // Invisible Separator
      '\u2064', // Invisible Plus
      '\u180e', // Mongolian Vowel Separator
      '\u17b4', // Khmer Vowel Inherent Aq
      '\u17b5', // Khmer Vowel Inherent Aa
    ];

    let cleaned = text;
    for (const char of zeroWidthChars) {
      cleaned = cleaned.replace(new RegExp(char, 'g'), '');
    }

    // Remove other problematic characters that show as question marks
    // eslint-disable-next-line no-control-regex
    cleaned = cleaned.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');

    return cleaned;
  }

  // Remove control characters except tab, newline, carriage return
  private removeControlCharacters(text: string): string {
    // Keep tabs, newlines, and carriage returns
    // eslint-disable-next-line no-control-regex
    return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  }

  // Apply additional cleaning patterns for specific Logos artifacts
  private applyAdvancedCleaning(text: string): string {
    let cleaned = text;

    // Remove sequences of zero-width chars around single characters
    cleaned = cleaned.replace(/[\ufeff\u200b-\u200f\u2060]+(.?)[\ufeff\u200b-\u200f\u2060]+/g, '$1');

    // Clean up malformed words that result from footnote removal
    // Pattern: letter followed immediately by capital letter (likely merged words)
    cleaned = cleaned.replace(/\b([a-z])([A-Z][a-z]+)\b/g, '$2');

    // Remove isolated single characters that are likely footnote remnants
    // but preserve meaningful single letters (I, a, A)
    cleaned = cleaned.replace(/\b(?![IiAa])[a-z]\b/g, '');
    
    // Clean up multiple spaces that result from removals
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    
    // Remove spaces before punctuation
    cleaned = cleaned.replace(/\s+([.,;:!?])/g, '$1');
    
    // Clean up leading/trailing whitespace
    cleaned = cleaned.trim();

    // Remove empty parentheses or brackets that might remain
    cleaned = cleaned.replace(/\(\s*\)/g, '');
    cleaned = cleaned.replace(/\[\s*\]/g, '');
    cleaned = cleaned.replace(/\{\s*\}/g, '');

    return cleaned;
  }

  // Clean Rich Text (XAML) text content
  public cleanXamlText(xamlText: string): string {
    if (!xamlText) return xamlText;

    // First decode HTML entities that might be hiding problematic characters
    let cleaned = xamlText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    // Apply standard cleaning
    cleaned = this.cleanText(cleaned);

    return cleaned;
  }

  // Clean text extracted from Text attributes in Rich Text (XAML)
  public cleanExtractedText(texts: string[]): string[] {
    return texts
      .map(text => this.cleanXamlText(text))
      .filter(text => text && text.trim() !== '');
  }
}

// Convenience function for quick text cleaning with default options
export function cleanUnicodeText(text: string): string {
  const cleaner = new UnicodeCleaner();
  return cleaner.cleanText(text);
}

// Convenience function for cleaning Rich Text (XAML) text content
export function cleanXamlText(xamlText: string): string {
  const cleaner = new UnicodeCleaner();
  return cleaner.cleanXamlText(xamlText);
} 