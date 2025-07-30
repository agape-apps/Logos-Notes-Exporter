// XAML content parsing and normalization operations
// Handles XML parsing, content cleaning, and markdown normalization for XAML conversion
// Provides core parsing functionality with entity decoding and plain text extraction

import { XMLParser } from 'fast-xml-parser';
import { UnicodeCleaner } from './unicode-cleaner.js';
import type { XamlConverterOptions } from './types/xaml-types.js';

export class XamlParser {
  private parser: XMLParser;
  private unicodeCleaner: UnicodeCleaner;
  private options: XamlConverterOptions;

  constructor(options: XamlConverterOptions) {
    this.options = options;
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

  public parseXamlContent(xamlContent: string): unknown {
    if (!xamlContent || xamlContent.trim() === '') {
      return null;
    }

    const cleanedXaml = this.cleanXamlContent(xamlContent);
    if (!cleanedXaml.trim()) {
      return null;
    }

    const wrappedXaml = `<Root>${cleanedXaml}</Root>`;
    return this.parser.parse(wrappedXaml);
  }

  private cleanXamlContent(xaml: string): string {
    let cleaned = xaml.replace(/<\?xml[^>]*\?>/gi, '');
    cleaned = cleaned.replace(/xmlns[^=]*="[^"]*"/gi, '');
    return cleaned.trim();
  }

  public normalizeMarkdown(markdown: string): string {
    let result = markdown;
    
    if (this.options.convertIndentsToQuotes) {
      result = result.replace(/(^>+\s.*\n)(^(?!>)(?!\s*$).*)/gm, '$1\n$2');
    }
    
    return result
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .replace(/[ \t]{3,}$/gm, '  ')
      .replace(/[ \t]+$/gm, (match) => match === '  ' ? '  ' : '');
  }

  public extractPlainText(xamlContent: string): string {
    const textMatches = xamlContent.match(/Text="([^"]*?)"/g) || [];
    const plainTexts = textMatches.map((match) => {
      let text = match.replace(/Text="([^"]*?)"/, "$1");
      text = this.decodeEntities(text);
      return this.unicodeCleaner.cleanXamlText(text);
    });

    let result = plainTexts.join("\n").trim();

    result = result.replace(/### (.+)/g, "\n\n### $1\n\n");
    result = result.replace(/\b[0-9]+\. /g, "\n$0");
    result = result.replace(/\b\* /g, "\n$0");
    result = result.replace(/\b- /g, "\n$0");

    return result;
  }

  public decodeEntities(text: string): string {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  }
}