// Main XAML converter orchestrator class
// Coordinates parsing, element processing, formatting, and utilities for XAML to Markdown conversion
// Provides the main public API while delegating specialized operations to focused modules

import { getDefaults } from '@logos-notes-exporter/config';
import { XamlParser } from './xaml-parser.js';
import { XamlElementProcessor } from './xaml-element-processor.js';
import { XamlFormatter } from './xaml-formatting.js';
import { XamlUtils } from './xaml-utils.js';
import type { XamlConverterOptions, XamlElement } from './types/xaml-types.js';
import type { ImageStats, ImageProcessingFailure } from './xaml-image-processor.js';

// Re-export types for backward compatibility
export type { XamlConverterOptions, XamlElement };

// TODO: Add support for other monospace Font Names
export const DEFAULT_OPTIONS: XamlConverterOptions = getDefaults.xaml();

export class XamlToMarkdownConverter {
  private options: XamlConverterOptions;
  private parser: XamlParser;
  private utils: XamlUtils;
  private formatter: XamlFormatter;
  private processor: XamlElementProcessor;

  constructor(options: Partial<XamlConverterOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.parser = new XamlParser(this.options);
    this.utils = new XamlUtils();
    this.formatter = new XamlFormatter(this.options, this.utils);
    this.processor = new XamlElementProcessor(this.options, this.utils, this.formatter, this.parser);
  }

  public convertToMarkdown(xamlContent: string): string {
    try {
      if (!xamlContent || xamlContent.trim() === '') {
        return '';
      }

      const parsed = this.parser.parseXamlContent(xamlContent);
      if (!parsed) {
        return '';
      }
      
      const markdown = this.processor.processElement(parsed);
      
      return this.parser.normalizeMarkdown(markdown);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`XAML parsing failed: ${errorMessage}`);
      if (this.options.ignoreUnknownElements) {
        const fallbackResult = this.parser.extractPlainText(xamlContent);
        console.warn(`Falling back to plain text extraction. Result length: ${fallbackResult.length} chars`);
        return '*[Warning: Some formatting lost due to complex content]*\n\n' + fallbackResult;
      }
      throw new Error(`Rich Text (XAML) conversion failed: ${error}`);
    }
  }

  public processElement(element: string | XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    return this.processor.processElement(element, paragraphElement);
  }


  public processParagraph(paragraph: XamlElement | XamlElement[], skipNewline = false): string {
    return this.processor.processParagraph(paragraph, skipNewline);
  }

  public processRun(run: XamlElement | XamlElement[], paragraphElement?: XamlElement): string {
    return this.processor.processRun(run, paragraphElement);
  }














  public getAttributes(element: XamlElement): Record<string, string> {
    return this.utils.getAttributes(element);
  }


  public extractElementContent(element: XamlElement, paragraphElement?: XamlElement): string {
    return this.processor.extractElementContent(element, paragraphElement);
  }










  










  public async processCollectedImages(markdown: string): Promise<string> {
    return this.processor.processCollectedImages(markdown);
  }

  public clearCollectedImages(): void {
    this.processor.clearCollectedImages();
  }

  public getImageStats(): ImageStats | null {
    return this.processor.getImageStats();
  }

  public getImageFailures(): ImageProcessingFailure[] {
    return this.processor.getImageFailures();
  }
} 