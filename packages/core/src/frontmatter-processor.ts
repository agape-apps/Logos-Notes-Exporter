// Handles YAML frontmatter generation and serialization for markdown notes
// Processes both basic and enhanced metadata with proper YAML formatting
// Manages frontmatter field ordering and custom field integration

import type { OrganizedNote, NotebookGroup, FilePathInfo } from './types.js';
import { MetadataProcessor } from './metadata-processor.js';

export interface FrontmatterProcessorOptions {
  includeFrontmatter: boolean;
  includeDates: boolean;
  includeKind: boolean;
  includeNotebook: boolean;
  includeId: boolean;
  customFields: Record<string, unknown>;
  dateFormat: 'iso' | 'locale' | 'short';
}

export class FrontmatterProcessor {
  private options: FrontmatterProcessorOptions;
  private metadataProcessor?: MetadataProcessor;

  constructor(options: FrontmatterProcessorOptions, metadataProcessor?: MetadataProcessor) {
    this.options = options;
    this.metadataProcessor = metadataProcessor;
  }

  /**
   * Generate YAML frontmatter for a note
   */
  public generateFrontmatter(note: OrganizedNote, group: NotebookGroup, fileInfo: FilePathInfo): Record<string, unknown> {
    if (this.metadataProcessor) {
      // Use enhanced metadata processor
      const metadata = this.metadataProcessor.generateMetadata(note);
      const frontmatter: Record<string, unknown> = { ...metadata };
      
      // Add file information
      if (fileInfo.filename) {
        frontmatter.filename = fileInfo.filename;
      }
      
      // Add custom fields
      Object.assign(frontmatter, this.options.customFields);
      
      return frontmatter;
    } else {
      // Fallback to basic frontmatter generation
      return this.generateBasicFrontmatter(note, group, fileInfo);
    }
  }

  /**
   * Generate basic frontmatter when enhanced metadata processor is not available
   */
  private generateBasicFrontmatter(note: OrganizedNote, group: NotebookGroup, fileInfo: FilePathInfo): Record<string, unknown> {
    const frontmatter: Record<string, unknown> = {};

    // Title
    frontmatter.title = note.formattedTitle || this.generateTitleFromReferences(note) || 'Untitled Note';

    // Dates
    if (this.options.includeDates) {
      frontmatter.created = this.formatDate(note.createdDate);
      if (note.modifiedDate) {
        frontmatter.modified = this.formatDate(note.modifiedDate);
      }
    }

    // Note kind/type
    if (this.options.includeKind) {
      frontmatter.noteType = this.getNoteTypeName(note.kind);
    }

    // Note ID
    if (this.options.includeId) {
      frontmatter.noteId = note.id;
    }

    // Notebook information
    if (this.options.includeNotebook && group.notebook) {
      frontmatter.notebook = group.notebook.title;
    }

    // References - always include when available
    if (note.references.length > 0) {
      frontmatter.references = note.references.map(ref => ref.formatted);
    }

    // Tags
    const tags = this.extractTags(note);
    if (tags.length > 0) {
      frontmatter.tags = tags;
    }

    // File information
    if (fileInfo.filename) {
      frontmatter.filename = fileInfo.filename;
    }

    // Custom fields
    Object.assign(frontmatter, this.options.customFields);

    return frontmatter;
  }

  /**
   * Serialize frontmatter to YAML
   */
  public serializeFrontmatter(frontmatter: Record<string, unknown>): string {
    const lines = ['---'];
    
    // Define the preferred field order for better readability
    const fieldOrder = [
      'title', 'created', 'modified', 'tags', 'noteType', 'references', 
      'noteId', 'notebook', 'logosBibleBook', 'bibleVersion', 'noteStyle', 
      'noteColor', 'noteIndicator', 'dataType', 'resourceId', 'resourceTitle', 'anchorLink', 'filename'
    ];
    
    // Add fields in the preferred order first
    for (const key of fieldOrder) {
      if (frontmatter[key] !== null && frontmatter[key] !== undefined) {
        lines.push(this.serializeYamlValue(key, frontmatter[key], 0));
      }
    }
    
    // Add any remaining fields that weren't in the preferred order
    for (const [key, value] of Object.entries(frontmatter)) {
      if (value === null || value === undefined || fieldOrder.includes(key)) {
        continue;
      }
      
      lines.push(this.serializeYamlValue(key, value, 0));
    }
    
    return lines.join('\n');
  }

  /**
   * Serialize a YAML value with proper formatting
   */
  private serializeYamlValue(key: string, value: unknown, indent: number = 0): string {
    const prefix = '  '.repeat(indent);
    
    if (value === null || value === undefined) {
      return `${prefix}${key}: null`;
    }
    
    if (typeof value === 'string') {
      // Escape quotes and handle multiline strings
      if (value.includes('\n') || value.includes('"') || value.includes('\'')) {
        const escapedValue = value.replace(/"/g, '\\"');
        return `${prefix}${key}: "${escapedValue}"`;
      }
      return `${prefix}${key}: "${value}"`;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return `${prefix}${key}: ${value}`;
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `${prefix}${key}: []`;
      }
      
      const lines = [`${prefix}${key}:`];
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          lines.push(`${prefix}  -`);
          for (const [subKey, subValue] of Object.entries(item)) {
            lines.push(this.serializeYamlValue(subKey, subValue, indent + 2));
          }
        } else {
          lines.push(`${prefix}  - ${this.formatYamlScalar(item)}`);
        }
      }
      return lines.join('\n');
    }
    
    if (typeof value === 'object') {
      const lines = [`${prefix}${key}:`];
      for (const [subKey, subValue] of Object.entries(value)) {
        lines.push(this.serializeYamlValue(subKey, subValue, indent + 1));
      }
      return lines.join('\n');
    }
    
    return `${prefix}${key}: ${String(value)}`;
  }

  /**
   * Format a scalar value for YAML
   */
  private formatYamlScalar(value: unknown): string {
    if (typeof value === 'string') {
      if (value.includes('"') || value.includes('\'') || value.includes('\n')) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return `"${value}"`;
    }
    return String(value);
  }

  /**
   * Get human-readable note type name
   */
  private getNoteTypeName(kind: number): string {
    switch (kind) {
      case 0: return 'note';
      case 1: return 'highlight';
      case 2: return 'annotation';
      default: return 'unknown';
    }
  }

  /**
   * Format date according to options
   */
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    
    switch (this.options.dateFormat) {
      case 'locale':
        return date.toLocaleDateString();
      case 'short': {
        const isoString = date.toISOString();
        return isoString.split('T')[0] || isoString; // YYYY-MM-DD
      }
      case 'iso':
      default:
        return date.toISOString();
    }
  }

  /**
   * Generate a title from references if no title exists
   */
  private generateTitleFromReferences(note: OrganizedNote): string | null {
    if (note.references.length === 0) return null;
    
    // Use the first reference as title
    const firstRef = note.references[0];
    if (firstRef && firstRef.formatted) {
      return String(firstRef.formatted);
    }
    return null;
  }

  /**
   * Extract tags from a note (placeholder for future implementation)
   */
  private extractTags(note: OrganizedNote): string[] {
    // For now, return basic tags based on note type and content
    const tags: string[] = [];

    // Add note type tag
    switch (note.kind) {
      case 0:
        tags.push('note');
        break;
      case 1:
        tags.push('highlight');
        break;
      case 2:
        tags.push('annotation');
        break;
      default:
        tags.push('note');
    }

    // Add reference-based tags
    if (note.references.length > 0) {
      tags.push('scripture');
      
      // Add book tags for unique books
      const books = [...new Set(note.references.map(ref => ref.bookName).filter(Boolean))];
      for (const book of books.slice(0, 3)) { // Limit to 3 book tags
        if (book && typeof book === 'string') {
          tags.push(book.toLowerCase().replace(/\s+/g, '-'));
        }
      }
    }

    return tags;
  }
}