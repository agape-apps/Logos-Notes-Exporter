// Interface definitions for processor components to avoid 'any' types
// Provides proper typing for inter-module communication in refactored XAML conversion

import type {
  ImageStats,
  ImageProcessingFailure,
} from "../xaml-image-processor.js";
import type { XamlElement } from './xaml-types.js';

export interface IXamlElementProcessor {
  processElement(element: string | XamlElement | XamlElement[], paragraphElement?: XamlElement): string;
  processParagraph(paragraph: XamlElement | XamlElement[], skipNewline?: boolean): string;
  processRun(run: XamlElement | XamlElement[], paragraphElement?: XamlElement): string;
  extractElementContent(element: XamlElement, paragraphElement?: XamlElement): string;
  getAttributes(element: XamlElement): Record<string, string>;
  processCollectedImages(markdown: string): Promise<string>;
  clearCollectedImages(): void;
  getImageStats(): ImageStats | null;
  getImageFailures(): ImageProcessingFailure[];
}