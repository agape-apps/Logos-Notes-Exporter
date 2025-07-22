import type { OrganizedNote } from './notebook-organizer.js';
import type { DecodedReference } from './reference-decoder.js';
import type { NoteStyle, NoteColor, NoteIndicator, DataType, ResourceId } from './notestool-database.js';
import { BibleReferenceDecoder } from './reference-decoder.js';
import type { CatalogDatabase } from './catalog-database.js';

export interface NoteMetadata {
  title: string;
  created?: string;
  modified?: string;
  tags: string[];
  noteType: 'text' | 'highlight' | 'annotation';
  references: string[];
  notebook?: string;
  logosBibleBook?: number;
  noteId: number;
  style?: string;
  color?: string;
  noteStyle?: string;
  noteColor?: string;
  noteIndicator?: string;
  dataType?: string;
  resourceId?: string;
  resourceTitle?: string;
  bibleVersion?: string;
  anchorLink?: string;
  filename?: string;
  [key: string]: unknown; // Allow custom metadata
}

export interface MetadataLookups {
  styles: Map<number, NoteStyle>;
  colors: Map<number, NoteColor>;
  indicators: Map<number, NoteIndicator>;
  dataTypes: Map<number, DataType>;
  resourceIds: Map<number, ResourceId>;
}

export interface MetadataOptions {
  /** Include creation and modification dates */
  includeDates: boolean;
  /** Include notebook information */
  includeNotebook: boolean;
  /** Include style and color information */
  includeStyle: boolean;
  /** Include enhanced metadata (note style, color, indicator, etc.) */
  includeEnhancedMetadata: boolean;
  /** Include tags derived from note content */
  includeTags: boolean;
  /** Include Logos-specific metadata */
  includeLogosData: boolean;
  /** Custom metadata extractors */
  customExtractors: MetadataExtractor[];
  /** Date format for timestamps */
  dateFormat: 'iso' | 'readable';
}

export type MetadataExtractor = (note: OrganizedNote) => Record<string, unknown>;

export const DEFAULT_METADATA_OPTIONS: MetadataOptions = {
  includeDates: true,
  includeNotebook: true,
  includeStyle: false,
  includeEnhancedMetadata: true,
  includeTags: true,
  includeLogosData: false,
  customExtractors: [],
  dateFormat: 'iso'
};

export class MetadataProcessor {
  private options: MetadataOptions;
  private lookups?: MetadataLookups;
  private bibleDecoder = new BibleReferenceDecoder();
  private catalogDb?: CatalogDatabase;

  constructor(options: Partial<MetadataOptions> = {}, lookups?: MetadataLookups, catalogDb?: CatalogDatabase) {
    this.options = { ...DEFAULT_METADATA_OPTIONS, ...options };
    this.lookups = lookups;
    this.catalogDb = catalogDb;
  }

  /**
   * Generate complete metadata for a note
   */
  public generateMetadata(note: OrganizedNote): NoteMetadata {
    const metadata: NoteMetadata = {
      title: note.formattedTitle,
      tags: [],
      noteType: this.getNoteType(note.kind),
      references: [],
      noteId: note.id
    };

    // Add creation and modification dates
    if (this.options.includeDates) {
      metadata.created = this.formatDate(note.createdDate);
      if (note.modifiedDate) {
        metadata.modified = this.formatDate(note.modifiedDate);
      }
    }

    // Add notebook information
    if (this.options.includeNotebook && note.notebook) {
      metadata.notebook = note.notebook.title || 'Untitled Notebook';
    }

    // Add Bible references - always include when available
    if (note.references.length > 0) {
      metadata.references = note.references.map(ref => ref.formatted);
      // Set primary Bible book if available
      if (note.references[0]) {
        metadata.logosBibleBook = note.references[0].anchorBookId;
      }
      
      // Extract Bible version from first reference
      const bibleVersion = this.extractBibleVersionFromReferences(note.references);
      if (bibleVersion) {
        metadata.bibleVersion = bibleVersion;
      }
    }

    // Add anchor Bible book from note
    if (note.anchorBibleBook) {
      metadata.logosBibleBook = note.anchorBibleBook;
    }

    // Add style and color information (legacy format)
    if (this.options.includeStyle) {
      if (note.noteStyleId) {
        metadata.style = `style-${note.noteStyleId}`;
      }
      if (note.noteColorId) {
        metadata.color = `color-${note.noteColorId}`;
      }
    }

    // Add enhanced metadata with meaningful names
    if (this.options.includeEnhancedMetadata && this.lookups) {
      if (note.noteStyleId) {
        const style = this.lookups.styles.get(note.noteStyleId);
        metadata.noteStyle = style ? this.cleanStyleName(style.name) : `style-${note.noteStyleId}`;
      }
      if (note.noteColorId) {
        const color = this.lookups.colors.get(note.noteColorId);
        metadata.noteColor = color ? color.name : `color-${note.noteColorId}`;
      }
      if (note.noteIndicatorId) {
        const indicator = this.lookups.indicators.get(note.noteIndicatorId);
        metadata.noteIndicator = indicator ? indicator.name : `indicator-${note.noteIndicatorId}`;
      }
      if (note.anchorDataTypeId) {
        const dataType = this.lookups.dataTypes.get(note.anchorDataTypeId);
        metadata.dataType = dataType ? dataType.name : `datatype-${note.anchorDataTypeId}`;
      }
      if (note.anchorResourceIdId) {
        const resourceId = this.lookups.resourceIds.get(note.anchorResourceIdId);
        metadata.resourceId = resourceId ? resourceId.resourceId : `resource-${note.anchorResourceIdId}`;
        
        // Get resource title from catalog database
        if (metadata.resourceId && this.catalogDb) {
          const title = this.catalogDb.getTitleByResourceId(metadata.resourceId);
          if (title) {
            metadata.resourceTitle = title;
          }
        }
      }
    }

    // Generate anchor link URL
    metadata.anchorLink = this.generateAnchorLink(note, metadata.resourceId);

    // Add tags
    if (this.options.includeTags) {
      metadata.tags = this.extractTags(note);
    }

    // Add Logos-specific data
    if (this.options.includeLogosData) {
      metadata.logosExternalId = note.externalId;
      if (note.noteStyleId) metadata.logosStyleId = note.noteStyleId;
      if (note.noteColorId) metadata.logosColorId = note.noteColorId;
    }

    // Generate simple filename for frontmatter
    // TODO: this may not be needed.
    if (note.references.length > 0 && note.references[0]) {
      const firstRef = note.references[0];
      if (firstRef.anchorBookId && firstRef.bookName && firstRef.chapter) {
        metadata.filename = this.bibleDecoder.generateSimpleFilename(
          firstRef.bookName, 
          firstRef.chapter, 
          firstRef.verse
        );
      }
    }

    // Apply custom extractors
    for (const extractor of this.options.customExtractors) {
      const customData = extractor(note);
      Object.assign(metadata, customData);
    }

    return metadata;
  }

  // Convert metadata to YAML frontmatter string
  public toYamlFrontmatter(metadata: NoteMetadata): string {
    const yamlLines = ['---'];

    // Title (always first)
    yamlLines.push(`title: ${this.escapeYamlValue(metadata.title)}`);

    // Dates
    if (metadata.created) {
      yamlLines.push(`created: ${metadata.created}`);
    }
    if (metadata.modified) {
      yamlLines.push(`modified: ${metadata.modified}`);
    }

    // Note type
    yamlLines.push(`noteType: ${metadata.noteType}`);

    // Notebook
    if (metadata.notebook) {
      yamlLines.push(`notebook: ${this.escapeYamlValue(metadata.notebook)}`);
    }

    // Bible references
    if (metadata.references.length > 0) {
      yamlLines.push('references:');
      metadata.references.forEach(ref => {
        yamlLines.push(`  - ${this.escapeYamlValue(ref)}`);
      });
    }

    // Tags
    if (metadata.tags.length > 0) {
      yamlLines.push('tags:');
      metadata.tags.forEach(tag => {
        yamlLines.push(`  - ${this.escapeYamlValue(tag)}`);
      });
    }

    // Bible book
    if (metadata.logosBibleBook) {
      yamlLines.push(`logosBibleBook: ${metadata.logosBibleBook}`);
    }

    // Enhanced metadata fields
    if (metadata.noteStyle) {
      yamlLines.push(`noteStyle: ${this.escapeYamlValue(metadata.noteStyle)}`);
    }
    if (metadata.noteColor) {
      yamlLines.push(`noteColor: ${this.escapeYamlValue(metadata.noteColor)}`);
    }
    if (metadata.noteIndicator) {
      yamlLines.push(`noteIndicator: ${this.escapeYamlValue(metadata.noteIndicator)}`);
    }
    if (metadata.dataType) {
      yamlLines.push(`dataType: ${this.escapeYamlValue(metadata.dataType)}`);
    }
    if (metadata.resourceId) {
      yamlLines.push(`resourceId: ${this.escapeYamlValue(metadata.resourceId)}`);
    }
    if (metadata.resourceTitle) {
      yamlLines.push(`resourceTitle: ${this.escapeYamlValue(metadata.resourceTitle)}`);
    }
    if (metadata.anchorLink) {
      yamlLines.push(`anchorLink: ${this.escapeYamlValue(metadata.anchorLink)}`);
    }
    if (metadata.bibleVersion) {
      yamlLines.push(`bibleVersion: ${this.escapeYamlValue(metadata.bibleVersion)}`);
    }

    // Filename
    if (metadata.filename) {
      yamlLines.push(`filename: ${this.escapeYamlValue(metadata.filename)}`);
    }

    // Note ID
    yamlLines.push(`noteId: ${metadata.noteId}`);

    // Additional metadata (excluding standard fields)
    // Field order is determined in markdown-converter.ts in fieldOrder (not here)
    // TODO: consider combining the code both here and in markdown-converter.ts
    const standardFields = new Set([
      'title', 'created', 'modified', 'noteType', 'notebook',
      'references', 'tags', 'logosBibleBook', 'noteStyle', 'noteColor', 
      'noteIndicator', 'dataType', 'resourceId', 'resourceTitle', 'anchorLink', 'bibleVersion', 'filename', 'noteId'
    ]);

    for (const [key, value] of Object.entries(metadata)) {
      if (!standardFields.has(key) && value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          yamlLines.push(`${key}:`);
          value.forEach((item: unknown) => {
            yamlLines.push(`  - ${this.escapeYamlValue(String(item))}`);
          });
        } else if (typeof value === 'object') {
          yamlLines.push(`${key}:`);
          for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
            yamlLines.push(`  ${subKey}: ${this.escapeYamlValue(String(subValue))}`);
          }
        } else {
          yamlLines.push(`${key}: ${this.escapeYamlValue(String(value))}`);
        }
      }
    }

    yamlLines.push('---');
    yamlLines.push(''); // Empty line after frontmatter

    return yamlLines.join('\\n');
  }

  /**
   * Extract tags from note content and metadata
   */
  private extractTags(note: OrganizedNote): string[] {
    const tags = new Set<string>();

    // Add note type as tag
    tags.add(this.getNoteType(note.kind));

    // Add notebook as tag
    if (note.notebook?.title) {
      const notebookTag = this.sanitizeTag(note.notebook.title);
      if (notebookTag) tags.add(notebookTag);
    }

    // Add Bible book tags
    if (note.references.length > 0) {
      const uniqueBooks = new Set(note.references.map(ref => ref.bookName));
      uniqueBooks.forEach(bookName => {
        const bookTag = this.sanitizeTag(bookName);
        if (bookTag) tags.add(bookTag);
      });
    }

    // Extract tags from TagsJson field in database
    if (note.tagsJson) {
      const dbTags = this.extractTagsFromJson(note.tagsJson);
      dbTags.forEach(tag => tags.add(tag));
    }

    // Extract potential tags from content
    if (note.contentRichText) {
      const contentTags = this.extractTagsFromContent(note.contentRichText);
      contentTags.forEach(tag => tags.add(tag));
    }

    return Array.from(tags).sort();
  }

  /**
   * Extract tags from TagsJson field (format: [{"plain":{"text":"tag_name"}}])
   */
  private extractTagsFromJson(tagsJson: string): string[] {
    const tags: string[] = [];
    
    try {
      const parsedTags = JSON.parse(tagsJson);
      if (Array.isArray(parsedTags)) {
        parsedTags.forEach(tagObj => {
          if (tagObj?.plain?.text && typeof tagObj.plain.text === 'string') {
            const cleanTag = this.sanitizeTag(tagObj.plain.text);
            if (cleanTag) {
              tags.push(cleanTag);
            }
          }
        });
      }
    } catch (error) {
      // Silently ignore JSON parsing errors
      console.warn(`Failed to parse TagsJson: ${tagsJson}`, error);
    }
    
    return tags;
  }

  // Extract potential tags from note content
  private extractTagsFromContent(content: string): string[] {
    const tags: string[] = [];

    // Clean content for analysis
    const cleanContent = content
      .replace(/<[^>]+>/g, ' ') // Remove XAML tags
      .replace(/\\s+/g, ' ')
      .toLowerCase()
      .trim();

    // Common theological and study terms
    const theologicalTerms = [
      'prayer', 'worship', 'faith', 'grace', 'mercy', 'love', 'hope',
      'salvation', 'gospel', 'cross', 'resurrection', 'trinity',
      'discipleship', 'ministry', 'mission', 'evangelism', 'prophecy',
      'covenant', 'blessing', 'forgiveness', 'righteousness', 'holiness'
    ];

    // Look for theological terms
    theologicalTerms.forEach(term => {
      if (cleanContent.includes(term)) {
        tags.push(term);
      }
    });

    // Look for hashtag-style tags (#tag)
    const hashtagMatches = content.match(/#\\w+/g);
    if (hashtagMatches) {
      hashtagMatches.forEach(match => {
        const tag = match.substring(1).toLowerCase();
        if (tag.length > 2) tags.push(tag);
      });
    }

    return tags;
  }

  // Get human-readable note type
  private getNoteType(kind: number): 'text' | 'highlight' | 'annotation' {
    switch (kind) {
      case 0: return 'text';
      case 1: return 'highlight';
      default: return 'annotation';
    }
  }

  // Format date according to options
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    
    if (this.options.dateFormat === 'readable') {
      return date.toLocaleString();
    } else {
      return date.toISOString();
    }
  }

  /**
   * Sanitize a string for use as a tag
   */
  private sanitizeTag(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9\\s-]/g, '') // Keep only alphanumeric, spaces, and hyphens
      .replace(/\\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 30); // Limit length
  }

  /**
   * Escape YAML values to prevent syntax errors
   */
  private escapeYamlValue(value: string): string {
    if (!value) return '""';

    // Check if value needs quoting
    const needsQuoting = /^[\s]*$|[:[\]{},"|'>]|^[&*!|>%@`]/.test(value) ||
                        /^(true|false|null|yes|no|on|off)$/i.test(value) ||
                        /^[0-9]/.test(value);

    if (needsQuoting) {
      // Escape double quotes and backslashes
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `"${escaped}"`;
    }

    return value;
  }

  /**
   * Update options
   */
  public updateOptions(newOptions: Partial<MetadataOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Add custom metadata extractor
   */
  public addCustomExtractor(extractor: MetadataExtractor): void {
    this.options.customExtractors.push(extractor);
  }

  /**
   * Clean up style name to be more readable
   * TODO: where did "cu-tom:" come from? Consider removing this.
   */
  private cleanStyleName(name: string): string {
    return name
      .replace(/^(custom:|cu-tom:)/i, '') // Remove "custom:" or "cu-tom:" prefixes
      .replace(/^[\\s]+/g, '') // Remove leading spaces
      .replace(/[\\s]+$/g, '') // Remove trailing spaces
      .replace(/[\\s]+/g, '-') // Replace internal spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 30); // Limit length
  }

  /**
   * Extract Bible version from references
   * Looks for patterns like "bible+esv.19.86.9" and extracts "ESV"
   */
  private extractBibleVersionFromReferences(references: DecodedReference[]): string | undefined {
    for (const ref of references) {
      // Look for "bible+version." pattern in the original reference
      const versionMatch = ref.reference.match(/^bible\+([^.]+)\./);
      if (versionMatch && versionMatch[1]) {
        // Capitalize the version (esv -> ESV, nkjv -> NKJV)
        return versionMatch[1].toUpperCase();
      }
    }
    return undefined;
  }

  /**
   * Generate anchor link URL for Logos app
   */
  private generateAnchorLink(note: OrganizedNote, resourceId?: string): string | undefined {
    if (!resourceId) return undefined;

    // URL encode the resourceId (replace : with %3A)
    const encodedResourceId = resourceId.replace(':', '%3A');

    // For Bible references, use references format
    if (note.references.length > 0) {
      const firstRef = note.references[0];
      if (firstRef && firstRef.reference) {
        return `https://app.logos.com/books/${encodedResourceId}/references/${firstRef.reference}`;
      }
    }

    // For resource notes with offset data, use offsets format
    if (note.anchorTextRange?.offset !== undefined) {
      // A valid offset must be a positive integer.
      if (note.anchorTextRange.offset >= 0) {
        return `https://app.logos.com/books/${encodedResourceId}/offsets/${note.anchorTextRange.offset}`;
      }
      // For invalid offsets like -1, link to the book without offset
      return `https://app.logos.com/books/${encodedResourceId}`;
    }

    return undefined;
  }
} 