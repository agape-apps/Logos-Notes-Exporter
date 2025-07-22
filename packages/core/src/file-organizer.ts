import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { OrganizedNote, NotebookGroup, OrganizationStats } from './types.js';
import { BibleReferenceDecoder } from './reference-decoder.js';
import type { ResourceId } from './notestool-database.js';

export interface FilePathInfo {
  /** Full file path */
  fullPath: string;
  /** Directory path */
  directory: string;
  /** Filename without extension */
  filename: string;
  /** Relative path from base directory */
  relativePath: string;
  /** Whether file already exists */
  exists: boolean;
}

export interface FileStructureOptions {
  /** Base output directory */
  baseDir: string;
  /** Whether to organize by notebooks */
  organizeByNotebooks: boolean;
  /** Whether to create date-based subdirectories */
  includeDateFolders: boolean;
  /** Whether to flatten structure for single notebooks */
  flattenSingleNotebook: boolean;
  /** Maximum filename length */
  maxFilenameLength: number;
  /** File extension */
  fileExtension: string;
  /** Whether to create index files */
  createIndexFiles: boolean;
}

export interface DirectoryStructure {
  /** Base directory path */
  baseDir: string;
  /** Notebook directories created */
  notebookDirs: string[];
  /** Total files that will be created */
  totalFiles: number;
  /** Index files that will be created */
  indexFiles: string[];
}

export const DEFAULT_FILE_OPTIONS: FileStructureOptions = {
  baseDir: './Logos-Exported-Notes',
  organizeByNotebooks: true,
  includeDateFolders: false,
  flattenSingleNotebook: false,
  maxFilenameLength: 100,
  fileExtension: '.md',
  createIndexFiles: true
};

export class FileOrganizer {
  private options: FileStructureOptions;
  private createdDirs = new Set<string>();
  private bibleDecoder = new BibleReferenceDecoder();
  private resourceIdMap?: Map<number, ResourceId>;

  constructor(options: Partial<FileStructureOptions> = {}, resourceIds?: ResourceId[]) {
    this.options = { ...DEFAULT_FILE_OPTIONS, ...options };
    
    // Create resourceId lookup map if provided
    if (resourceIds) {
      this.resourceIdMap = new Map(resourceIds.map(r => [r.resourceIdId, r]));
    }
  }

  /**
   * Plan the directory structure for notebook groups
   */
  public async planDirectoryStructure(notebookGroups: NotebookGroup[]): Promise<DirectoryStructure> {
    const structure: DirectoryStructure = {
      baseDir: this.options.baseDir,
      notebookDirs: [],
      totalFiles: 0,
      indexFiles: []
    };

    // Plan main index
    if (this.options.createIndexFiles) {
      structure.indexFiles.push(join(this.options.baseDir, 'README.md'));
    }

    // Plan notebook directories and files
    for (const group of notebookGroups) {
      const notebookDir = this.getNotebookDirectory(group);
      structure.notebookDirs.push(notebookDir);
      structure.totalFiles += group.notes.length;

      // Plan notebook index
      if (this.options.createIndexFiles) {
        structure.indexFiles.push(join(notebookDir, 'README.md'));
      }
    }

    return structure;
  }

  /**
   * Get the directory path for a notebook group
   */
  public getNotebookDirectory(group: NotebookGroup): string {
    if (!this.options.organizeByNotebooks) {
      return this.options.baseDir;
    }

    const notebookName = group.sanitizedFolderName;
    return join(this.options.baseDir, notebookName);
  }

  /**
   * Generate file path information for a note
   */
  public generateFilePath(note: OrganizedNote, group: NotebookGroup, index: number = 1): FilePathInfo {
    const directory = this.getNotebookDirectory(group);
    
    // Generate base filename
    let filename = this.generateSafeFilename(note, index);
    
    // Add date folder if enabled
    let finalDirectory = directory;
    if (this.options.includeDateFolders) {
      const date = new Date(note.createdDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      finalDirectory = join(directory, `${year}-${month}`);
    }

    const fullPath = join(finalDirectory, filename);
    const relativePath = fullPath.replace(this.options.baseDir + '/', '');

    return {
      fullPath,
      directory: finalDirectory,
      filename: filename.replace(this.options.fileExtension, ''),
      relativePath,
      exists: existsSync(fullPath)
    };
  }

  /**
   * Ensure directory exists
   */
  public async ensureDirectory(dirPath: string): Promise<void> {
    if (!this.createdDirs.has(dirPath) && !existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
      this.createdDirs.add(dirPath);
    }
  }

  /**
   * Write file with content
   */
  public async writeFile(fileInfo: FilePathInfo, content: string): Promise<void> {
    await this.ensureDirectory(fileInfo.directory);
    await writeFile(fileInfo.fullPath, content, 'utf-8');
  }

  /**
   * Generate a main README.md file
   */
  public generateMainIndex(notebookGroups: NotebookGroup[], stats: OrganizationStats): string {
    const lines = [
      '# Exported Logos Notes',
      '',
      `**Exported on:** ${new Date().toISOString()}  `,
      `**Total Notes:** ${stats.totalNotes}  `,
      `**Total Notebooks:** ${notebookGroups.length}  `,
      '',
      '## 📚 Notebooks',
      ''
    ];

    // Add notebook links
    for (const group of notebookGroups) {
      const notebookName = group.notebook?.title || 'No Notebook';
      const noteCount = group.notes.length;
      const relativePath = group.sanitizedFolderName;
      
      lines.push(`- [**${notebookName}**](./${relativePath}/README.md) (${noteCount} notes)`);
    }

    lines.push('');
    lines.push('## 📊 Statistics');
    lines.push('');
    lines.push(`- **Notes with Content:** ${stats.notesWithContent}`);
    lines.push(`- **Notes with References:** ${stats.notesWithReferences}`);
    lines.push(`- **No Notebook:** ${stats.orphanedNotes}`);
    lines.push('');
    lines.push('---');
    lines.push('*Generated by Logos Notes Exporter*');

    return lines.join('\n');
  }

  /**
   * Generate a notebook README.md file
   */
  public generateNotebookIndex(group: NotebookGroup): string {
    const notebookTitle = group.notebook?.title || 'No Notebook';
    const lines = [
      `# ${notebookTitle}`,
      '',
      `**Notes:** ${group.notes.length}  `,
      ''
    ];

    if (group.notebook) {
      lines.push(`**Created:** ${new Date(group.notebook.createdDate).toLocaleDateString()}  `);
      lines.push('');
    }

    lines.push('## 📝 Notes');
    lines.push('');

    // Group notes by type
    const textNotes = group.notes.filter(n => n.kind === 0);
    const highlights = group.notes.filter(n => n.kind === 1);
    const annotations = group.notes.filter(n => n.kind === 2);

    if (textNotes.length > 0) {
      lines.push('### ✍️ Text Notes');
      lines.push('');
      textNotes.forEach(note => {
        const filename = this.generateSafeFilename(note, 1);
        const title = note.formattedTitle;
        const references = note.references.map(r => r.formatted).join(', ');
        lines.push(`- [**${title}**](./${filename})${references ? ` - ${references}` : ''}`);
      });
      lines.push('');
    }

    if (highlights.length > 0) {
      lines.push('### 🎨 Highlights');
      lines.push('');
      highlights.forEach(note => {
        const filename = this.generateSafeFilename(note, 1);
        const title = note.formattedTitle;
        const references = note.references.map(r => r.formatted).join(', ');
        lines.push(`- [**${title}**](./${filename})${references ? ` - ${references}` : ''}`);
      });
      lines.push('');
    }

    if (annotations.length > 0) {
      lines.push('### 📋 Annotations');
      lines.push('');
      annotations.forEach(note => {
        const filename = this.generateSafeFilename(note, 1);
        const title = note.formattedTitle;
        const references = note.references.map(r => r.formatted).join(', ');
        lines.push(`- [**${title}**](./${filename})${references ? ` - ${references}` : ''}`);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push(`*${group.notes.length} notes in this notebook*`);

    return lines.join('\n');
  }

  /**
   * Generate a safe filename for a note
   */
  private generateSafeFilename(note: OrganizedNote, index: number): string {
    // Check if this is a Bible reference note
    if (note.references.length > 0 && note.references[0]) {
      const firstRef = note.references[0];
      
      // Try to generate Bible filename format for Bible references
      if (firstRef.anchorBookId && firstRef.chapter) {
        try {
          let filename = this.bibleDecoder.generateBibleFilename(
            firstRef.anchorBookId, 
            firstRef.chapter, 
            firstRef.verse,
            firstRef.endChapter,
            firstRef.endVerse
          );
          
          // Add index if greater than 1
          if (index > 1) {
            // Insert index before .md extension
            filename = filename.replace('.md', `(${index}).md`);
          }
          
          return filename;
        } catch (error) {
          // Fall back to regular filename if Bible format fails
          console.warn(`Failed to generate Bible filename for note ${note.id}:`, error);
        }
      }
    }

    // Check if this note has a resourceId but no Bible references
    if (note.anchorResourceIdId && note.references.length === 0) {
      try {
        // We need to access the database to get the actual resourceId string
        // For now, we'll use a placeholder and implement this properly
        const resourceIdString = this.getResourceIdString(note.anchorResourceIdId);
        
        if (resourceIdString) {
          const filename = this.generateResourceIdFilename(resourceIdString, note.id, index);
          return filename;
        }
      } catch (error) {
        console.warn(`Failed to generate resourceId filename for note ${note.id}:`, error);
      }
    }

    // Fallback to traditional filename generation
    let filename = '';

    // Check if formattedTitle is just a generic "Note XXX" pattern
    const isGenericNoteTitle = note.formattedTitle && /^(Note|Highlight|Annotation)\s+\d+$/.test(note.formattedTitle.trim());

    // Use formatted title or generate from references
    if (note.formattedTitle && note.formattedTitle.trim() && !isGenericNoteTitle) {
      filename = note.formattedTitle;
    } else if (note.references.length > 0 && note.references[0]) {
      filename = note.references[0].formatted;
    } else {
      const noteType = note.kind === 0 ? 'Note' : note.kind === 1 ? 'Highlight' : 'Annotation';
      const paddedNoteId = note.id.toString().padStart(4, '0');
      filename = `${noteType}-${paddedNoteId}`;
    }

    // Add index if greater than 1
    if (index > 1) {
      filename += `(${index})`;
    }

    // Sanitize filename
    filename = this.sanitizeFilename(filename);
    
    // Add extension
    return filename + this.options.fileExtension;
  }

  /**
   * Generate filename from resourceId for notes without Bible references
   * Pattern: resourceIdPart1-resourceIdPart2-noteId
   * For UUIDs in PBB resources, use only last 4 characters
   */
  private generateResourceIdFilename(resourceIdString: string, noteId: number, index: number): string {
    const parts = resourceIdString.split(':');
    if (parts.length !== 2 || !parts[1]) {
      throw new Error(`Invalid resourceId format: ${resourceIdString}`);
    }

    const part1 = parts[0];
    const part2 = parts[1];
    let processedPart2 = part2;

    // Check if part2 looks like a UUID (32 hex chars)
    if (part2.length === 32 && /^[0-9a-f]{32}$/i.test(part2)) {
      // Use last 4 characters for UUID
      processedPart2 = part2.slice(-4);
    }

    // Build filename with 4-digit padded noteId
    const paddedNoteId = noteId.toString().padStart(4, '0');
    let filename = `${part1}-${processedPart2}-${paddedNoteId}`;

    // Add index if greater than 1
    if (index > 1) {
      filename += `(${index})`;
    }

    return filename + this.options.fileExtension;
  }

  /**
   * Get resourceId string by resourceIdId
   */
  private getResourceIdString(resourceIdId: number): string | null {
    if (!this.resourceIdMap) {
      return null;
    }
    
    const resourceId = this.resourceIdMap.get(resourceIdId);
    return resourceId ? resourceId.resourceId : null;
  }

  /**
   * Sanitize filename for filesystem
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\\\|?*]/g, '-') // Replace invalid characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, this.options.maxFilenameLength) // Limit length
      || 'untitled';
  }

  /**
   * Check for filename conflicts and resolve them
   */
  public resolveFilenameConflicts(notes: OrganizedNote[], group: NotebookGroup): Map<OrganizedNote, FilePathInfo> {
    const fileMap = new Map<OrganizedNote, FilePathInfo>();
    const usedFilenames = new Set<string>();

    for (const note of notes) {
      let index = 1;
      let fileInfo: FilePathInfo;
      
      do {
        fileInfo = this.generateFilePath(note, group, index);
        index++;
      } while (usedFilenames.has(fileInfo.fullPath) && index <= 100);

      usedFilenames.add(fileInfo.fullPath);
      fileMap.set(note, fileInfo);
    }

    return fileMap;
  }

  /**
   * Get summary of planned file operations
   */
  public getFileOperationSummary(notebookGroups: NotebookGroup[]): {
    totalDirectories: number;
    totalFiles: number;
    totalIndexFiles: number;
    estimatedSize: string;
  } {
    let totalDirectories = 1; // Base directory
    let totalFiles = 0;
    let totalIndexFiles = 0;

    // Count main index
    if (this.options.createIndexFiles) {
      totalIndexFiles++;
    }

    for (const group of notebookGroups) {
      // Only count notebook directories if organizing by notebooks
      if (this.options.organizeByNotebooks) {
        totalDirectories++; // Notebook directory
      }
      totalFiles += group.notes.length;
      
      // Only count notebook indexes if organizing by notebooks
      if (this.options.createIndexFiles && this.options.organizeByNotebooks) {
        totalIndexFiles++;
      }

      // Add date directories if enabled
      if (this.options.includeDateFolders) {
        const uniqueDates = new Set(
          group.notes.map(note => {
            const date = new Date(note.createdDate);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          })
        );
        totalDirectories += uniqueDates.size;
      }
    }

    // Rough size estimation (very approximate)
    const avgNoteSize = 2048; // 2KB average
    const avgIndexSize = 1024; // 1KB average
    const estimatedBytes = (totalFiles * avgNoteSize) + (totalIndexFiles * avgIndexSize);
    const estimatedSize = this.formatBytes(estimatedBytes);

    return {
      totalDirectories,
      totalFiles,
      totalIndexFiles,
      estimatedSize
    };
  }

  /**
   * Format bytes into human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Update options
   */
  public updateOptions(newOptions: Partial<FileStructureOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current options
   */
  public getOptions(): FileStructureOptions {
    return { ...this.options };
  }
} 