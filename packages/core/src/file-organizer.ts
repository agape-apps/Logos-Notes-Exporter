import { mkdir, writeFile, readFile, access, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync, constants } from 'fs';
import { DEFAULT_CONFIG } from '@logos-notes-exporter/config';
import type { OrganizedNote, NotebookGroup, OrganizationStats } from './types.js';
import { BibleReferenceDecoder } from './reference-decoder.js';
import type { ResourceId } from './notestool-database.js';
import { FileSystemError, Logger, ErrorSeverity } from './errors/index.js';

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
  baseDir: DEFAULT_CONFIG.export.outputDirectory,
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
  private logger: Logger;

  constructor(
    options: Partial<FileStructureOptions> = {},
    resourceIds?: ResourceId[],
    logger?: Logger
  ) {
    this.logger = logger || new Logger({ enableConsole: true, level: 1 });
    this.options = { ...DEFAULT_FILE_OPTIONS, ...options };

    // Create resourceId lookup map if provided
    if (resourceIds) {
      this.resourceIdMap = new Map(resourceIds.map((r) => [r.resourceIdId, r]));
    }
  }

  /**
   * Plan the directory structure for notebook groups
   */
  public async planDirectoryStructure(
    notebookGroups: NotebookGroup[]
  ): Promise<DirectoryStructure> {
    const structure: DirectoryStructure = {
      baseDir: this.options.baseDir,
      notebookDirs: [],
      totalFiles: 0,
      indexFiles: [],
    };

    // Plan main index
    if (this.options.createIndexFiles) {
      structure.indexFiles.push(join(this.options.baseDir, "README.md"));
    }

    // Plan notebook directories and files
    for (const group of notebookGroups) {
      const notebookDir = this.getNotebookDirectory(group);
      structure.notebookDirs.push(notebookDir);
      structure.totalFiles += group.notes.length;

      // Plan notebook index
      if (this.options.createIndexFiles) {
        structure.indexFiles.push(join(notebookDir, "INDEX.md"));
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
  public generateFilePath(
    note: OrganizedNote,
    group: NotebookGroup,
    index: number = 1
  ): FilePathInfo {
    const directory = this.getNotebookDirectory(group);

    // Generate base filename
    let filename = this.generateSafeFilename(note, index);

    // Add date folder if enabled
    let finalDirectory = directory;
    if (this.options.includeDateFolders) {
      const date = new Date(note.createdDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      finalDirectory = join(directory, `${year}-${month}`);
    }

    const fullPath = join(finalDirectory, filename);
    const relativePath = fullPath.replace(this.options.baseDir + "/", "");

    return {
      fullPath,
      directory: finalDirectory,
      filename: filename.replace(this.options.fileExtension, ""),
      relativePath,
      exists: existsSync(fullPath),
    };
  }

  /**
   * Ensure directory exists with comprehensive error handling
   */
  public async ensureDirectory(dirPath: string): Promise<void> {
    try {
      // Check if we've already created this directory
      if (this.createdDirs.has(dirPath)) {
        return;
      }

      // Check if directory already exists
      if (existsSync(dirPath)) {
        // Verify it's actually a directory and we can write to it
        await this.validateDirectoryAccess(dirPath);
        this.createdDirs.add(dirPath);
        return;
      }

      // Validate parent directory exists and is writable
      await this.validateParentDirectory(dirPath);

      // Create directory with proper error handling
      this.logger.logDebug('Creating directory', { path: dirPath }, 'FileOrganizer');
      await mkdir(dirPath, { recursive: true });
      
      // Verify creation was successful
      await this.validateDirectoryAccess(dirPath);
      
      this.createdDirs.add(dirPath);
      this.logger.logInfo('Directory created successfully', { path: dirPath }, 'FileOrganizer');
      
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      
      const fsError = new FileSystemError(
        `Failed to create directory: ${dirPath}`,
        dirPath,
        'ensureDirectory',
        {
          component: 'FileOrganizer',
          operation: 'ensureDirectory',
          metadata: { dirPath }
        },
        error instanceof Error ? error : new Error(String(error))
      );
      
      this.logger.logError(fsError);
      throw fsError;
    }
  }

  /**
   * Write file with content and comprehensive error handling
   */
  public async writeFile(
    fileInfo: FilePathInfo,
    content: string
  ): Promise<void> {
    try {
      // Ensure directory exists first
      await this.ensureDirectory(fileInfo.directory);
      
      // Validate file path
      this.validateFilePath(fileInfo.fullPath);
      
      // Check if file already exists and handle accordingly
      if (fileInfo.exists) {
        this.logger.logWarn('Overwriting existing file', {
          path: fileInfo.fullPath,
          relativePath: fileInfo.relativePath
        }, 'FileOrganizer');
      }
      
      // Validate content
      if (typeof content !== 'string') {
        throw new FileSystemError(
          'Content must be a string',
          fileInfo.fullPath,
          'writeFile',
          {
            component: 'FileOrganizer',
            operation: 'writeFile',
            metadata: { contentType: typeof content }
          }
        );
      }
      
      // Check available disk space (rough estimate)
      await this.checkDiskSpace(fileInfo.directory, content.length);
      
      this.logger.logDebug('Writing file', {
        path: fileInfo.fullPath,
        size: content.length
      }, 'FileOrganizer');
      
      // Write file with error handling
      await writeFile(fileInfo.fullPath, content, 'utf-8');
      
      // Verify file was written successfully
      await this.validateFileWritten(fileInfo.fullPath, content.length);
      
      this.logger.logInfo('File written successfully', {
        path: fileInfo.fullPath,
        size: content.length
      }, 'FileOrganizer');
      
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      
      const fsError = new FileSystemError(
        `Failed to write file: ${fileInfo.fullPath}`,
        fileInfo.fullPath,
        'writeFile',
        {
          component: 'FileOrganizer',
          operation: 'writeFile',
          metadata: {
            fullPath: fileInfo.fullPath,
            relativePath: fileInfo.relativePath,
            contentSize: content.length
          }
        },
        error instanceof Error ? error : new Error(String(error))
      );
      
      this.logger.logError(fsError);
      throw fsError;
    }
  }

  /**
   * Generate a main README.md file
   */
  public generateMainIndex(
    notebookGroups: NotebookGroup[],
    stats: OrganizationStats
  ): string {
    const lines = [
      "# Exported Logos Notes",
      "",
      `**Exported on:** ${new Date().toISOString()}  `,
      `**Total Notes:** ${stats.totalNotes}  `,
      `**Total Notebooks:** ${notebookGroups.length}  `,
      "",
      "## 📚 Notebooks",
      "",
    ];

    // Add notebook links
    for (const group of notebookGroups) {
      const notebookName = group.notebook?.title || "No Notebook";
      const noteCount = group.notes.length;
      const relativePath = group.sanitizedFolderName;

      lines.push(
        `- [**${notebookName}**](./${relativePath}/INDEX.md) (${noteCount} notes)`
      );
    }

    lines.push("");
    lines.push("## 📊 Statistics");
    lines.push("");
    lines.push(`- **Notes with Content:** ${stats.notesWithContent}`);
    lines.push(`- **Notes with References:** ${stats.notesWithReferences}`);
    lines.push(`- **No Notebook:** ${stats.orphanedNotes}`);
    lines.push("");
    lines.push("---");
    lines.push("*Generated by Logos Notes Exporter*");

    return lines.join("\n");
  }

  /**
   * Generate a notebook INDEX.md file
   */
  public async generateNotebookIndex(
    group: NotebookGroup,
    notebookDir?: string
  ): Promise<string> {
    const notebookTitle = group.notebook?.title || "No Notebook";
    const lines = [`# ${notebookTitle}`, ""];

    // Group notes by type
    const textNotes = group.notes.filter((n) => n.kind === 0);
    const highlights = group.notes.filter((n) => n.kind === 1);
    const annotations = group.notes.filter((n) => n.kind === 2);

    // Sort notes alphabetically by filename
    const sortByFilename = (a: OrganizedNote, b: OrganizedNote) => {
      const filenameA = this.generateSafeFilename(a, 1);
      const filenameB = this.generateSafeFilename(b, 1);
      return filenameA.localeCompare(filenameB);
    };

    lines.push("## 📝 Notes");
    lines.push("");

    // Add Text Notes links section
    if (textNotes.length > 0) {
      lines.push("### ✍️ Text Notes");
      lines.push("");
      const sortedTextNotes = textNotes.sort(sortByFilename);
      sortedTextNotes.forEach((note) => {
        const filename = this.generateSafeFilename(note, 1);
        const title = note.formattedTitle;
        const references = note.references.map((r) => r.formatted).join(", ");
        lines.push(
          `- [**${title}**](./${filename})${
            references ? ` - ${references}` : ""
          }`
        );
      });
      lines.push("");
    }

    // Add Highlights links section
    if (highlights.length > 0) {
      lines.push("### 🎨 Highlights");
      lines.push("");
      const sortedHighlights = highlights.sort(sortByFilename);
      sortedHighlights.forEach((note) => {
        const filename = this.generateSafeFilename(note, 1);
        const title = note.formattedTitle;
        const references = note.references.map((r) => r.formatted).join(", ");
        lines.push(
          `- [**${title}**](./${filename})${
            references ? ` - ${references}` : ""
          }`
        );
      });
      lines.push("");
    }

    // Add Annotations links section if any
    if (annotations.length > 0) {
      lines.push("### 📋 Annotations");
      lines.push("");
      const sortedAnnotations = annotations.sort(sortByFilename);
      sortedAnnotations.forEach((note) => {
        const filename = this.generateSafeFilename(note, 1);
        const title = note.formattedTitle;
        const references = note.references.map((r) => r.formatted).join(", ");
        lines.push(
          `- [**${title}**](./${filename})${
            references ? ` - ${references}` : ""
          }`
        );
      });
      lines.push("");
    }

    // Add notes count and created date
    lines.push(
      `**Notes:** ${group.notes.length}  **Created:** ${
        group.notebook
          ? new Date(group.notebook.createdDate).toLocaleDateString()
          : "Unknown"
      }  `
    );
    lines.push("");
    lines.push("---");
    lines.push("");

    // Add inline content sections
    if (textNotes.length > 0) {
      lines.push("## ✍️ Text Notes");
      lines.push("");

      // Sort and process text notes
      const sortedTextNotes = textNotes.sort(sortByFilename);
      for (const note of sortedTextNotes) {
        await this.addNoteContentToIndex(lines, note, notebookDir || "");
      }

      lines.push("---");
      lines.push("");
    }

    if (highlights.length > 0) {
      lines.push("## 🎨 Highlights");
      lines.push("");

      // Sort and process highlights
      const sortedHighlights = highlights.sort(sortByFilename);
      for (const note of sortedHighlights) {
        await this.addNoteContentToIndex(lines, note, notebookDir || "");
      }

      lines.push("---");
      lines.push("");
    }

    // Remove the last extra divider and empty line if present
    if (lines[lines.length - 1] === "" && lines[lines.length - 2] === "---") {
      lines.pop();
    }

    return lines.join("\n");
  }

  /**
   * Add note content inline to the index
   */
  private async addNoteContentToIndex(
    lines: string[],
    note: OrganizedNote,
    notebookDir: string
  ): Promise<void> {
    // Extract title and bible version from note
    const title = note.formattedTitle;
    const bibleVersion = this.extractBibleVersion(note);

    // Add note heading
    lines.push(`### ${title}${bibleVersion ? ` (${bibleVersion})` : ""}`);
    lines.push("");

    // Add note content from the markdown file
    const content = await this.extractNoteContent(note, notebookDir);
    if (content) {
      lines.push(content);
    } else {
      lines.push("*No content available*");
    }

    lines.push("");
    lines.push("---");
    lines.push("");
  }

  /**
   * Extract bible version from note references
   */
  private extractBibleVersion(note: OrganizedNote): string | null {
    if (note.references.length > 0) {
      // For now, default to NKJV - this could be enhanced to extract from the original reference
      return "NKJV";
    }
    return null;
  }

  /**
   * Extract note content by reading the generated markdown file
   */
  // TODO: this is quite a hack. Instead the generated note content should be
  // copied into each note file and the Notebook index file in the same loop.
  private async extractNoteContent(
    note: OrganizedNote,
    notebookDir: string
  ): Promise<string | null> {
    try {
      const filename = this.generateSafeFilename(note, 1);
      const filePath = join(notebookDir, filename);

      if (existsSync(filePath)) {
        const content = await readFile(filePath, "utf-8");

        // Extract content after the front matter
        const frontMatterEnd = content.indexOf("---", 4); // Find second occurrence of ---
        if (frontMatterEnd !== -1) {
          const markdownContent = content.substring(frontMatterEnd + 4).trim();
          return markdownContent || null;
        }
      }

      // Fallback to content from note data if file doesn't exist
      if (note.contentRichText) {
        const content = note.contentRichText
          .replace(/<[^>]*>/g, "") // Remove XML tags
          .trim();
        return content ? `*${content}*` : null;
      }
    } catch (error) {
      this.logger.logWarn('Failed to read content for note', {
        noteId: note.id,
        notebookDir,
        error: error instanceof Error ? error.message : String(error)
      }, 'FileOrganizer');
    }

    return null;
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
            filename = filename.replace(".md", `(${index}).md`);
          }

          return filename;
        } catch (error) {
          // Fall back to regular filename if Bible format fails
          this.logger.logWarn('Failed to generate Bible filename', {
            noteId: note.id,
            error: error instanceof Error ? error.message : String(error)
          }, 'FileOrganizer');
        }
      }
    }

    // Check if this note has a resourceId but no Bible references
    if (note.anchorResourceIdId && note.references.length === 0) {
      try {
        // We need to access the database to get the actual resourceId string
        // For now, we'll use a placeholder and implement this properly
        const resourceIdString = this.getResourceIdString(
          note.anchorResourceIdId
        );

        if (resourceIdString) {
          const filename = this.generateResourceIdFilename(
            resourceIdString,
            note.id,
            index
          );
          return filename;
        }
      } catch (error) {
        this.logger.logWarn('Failed to generate resourceId filename', {
          noteId: note.id,
          error: error instanceof Error ? error.message : String(error)
        }, 'FileOrganizer');
      }
    }

    // Fallback to traditional filename generation
    let filename = "";

    // Check if formattedTitle is just a generic "Note XXX" pattern
    const isGenericNoteTitle =
      note.formattedTitle &&
      /^(Note|Highlight|Annotation)\s+\d+$/.test(note.formattedTitle.trim());

    // Use formatted title or generate from references
    if (
      note.formattedTitle &&
      note.formattedTitle.trim() &&
      !isGenericNoteTitle
    ) {
      filename = note.formattedTitle;
    } else if (note.references.length > 0 && note.references[0]) {
      filename = note.references[0].formatted;
    } else {
      const noteType =
        note.kind === 0 ? "Note" : note.kind === 1 ? "Highlight" : "Annotation";
      const paddedNoteId = note.id.toString().padStart(4, "0");
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
  private generateResourceIdFilename(
    resourceIdString: string,
    noteId: number,
    index: number
  ): string {
    const parts = resourceIdString.split(":");
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
    const paddedNoteId = noteId.toString().padStart(4, "0");
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
    return (
      name
        .replace(/[<>:"/\\\\|?*]/g, "-") // Replace invalid characters
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/-+/g, "-") // Collapse multiple hyphens
        .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
        .substring(0, this.options.maxFilenameLength) || // Limit length
      "untitled"
    );
  }

  /**
   * Check for filename conflicts and resolve them
   */
  public resolveFilenameConflicts(
    notes: OrganizedNote[],
    group: NotebookGroup
  ): Map<OrganizedNote, FilePathInfo> {
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
          group.notes.map((note) => {
            const date = new Date(note.createdDate);
            return `${date.getFullYear()}-${String(
              date.getMonth() + 1
            ).padStart(2, "0")}`;
          })
        );
        totalDirectories += uniqueDates.size;
      }
    }

    // Rough size estimation (very approximate)
    const avgNoteSize = 2048; // 2KB average
    const avgIndexSize = 1024; // 1KB average
    const estimatedBytes =
      totalFiles * avgNoteSize + totalIndexFiles * avgIndexSize;
    const estimatedSize = this.formatBytes(estimatedBytes);

    return {
      totalDirectories,
      totalFiles,
      totalIndexFiles,
      estimatedSize,
    };
  }

  /**
   * Format bytes into human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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

  /**
   * Validate directory access permissions
   */
  private async validateDirectoryAccess(dirPath: string): Promise<void> {
    try {
      await access(dirPath, constants.F_OK | constants.W_OK);
      
      const stats = await stat(dirPath);
      if (!stats.isDirectory()) {
        throw new FileSystemError(
          `Path exists but is not a directory: ${dirPath}`,
          dirPath,
          'validateDirectoryAccess',
          {
            component: 'FileOrganizer',
            operation: 'validateDirectoryAccess',
            userMessage: 'A file exists where a directory is needed.',
            suggestions: [
              'Choose a different output location',
              'Remove the conflicting file',
              'Rename the existing file'
            ],
            metadata: { dirPath, isDirectory: stats.isDirectory() }
          }
        );
      }
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      
      // Check specific error types
      if (error instanceof Error) {
        if (error.message.includes('ENOENT')) {
          throw new FileSystemError(
            `Directory does not exist: ${dirPath}`,
            dirPath,
            'validateDirectoryAccess',
            {
              component: 'FileOrganizer',
              operation: 'validateDirectoryAccess',
              userMessage: 'Directory not found.',
              suggestions: ['Create the directory first', 'Check the path is correct'],
              metadata: { dirPath }
            },
            error
          );
        } else if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
          throw new FileSystemError(
            `Permission denied accessing directory: ${dirPath}`,
            dirPath,
            'validateDirectoryAccess',
            {
              component: 'FileOrganizer',
              operation: 'validateDirectoryAccess',
              userMessage: 'Permission denied. Cannot write to this directory.',
              suggestions: [
                'Choose a different output location',
                'Check folder permissions',
                'Run with appropriate privileges'
              ],
              metadata: { dirPath }
            },
            error
          );
        }
      }
      
      throw new FileSystemError(
        `Failed to validate directory access: ${dirPath}`,
        dirPath,
        'validateDirectoryAccess',
        {
          component: 'FileOrganizer',
          operation: 'validateDirectoryAccess',
          metadata: { dirPath }
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Validate parent directory exists and is writable
   */
  private async validateParentDirectory(dirPath: string): Promise<void> {
    const parentDir = join(dirPath, '..');
    
    try {
      await this.validateDirectoryAccess(parentDir);
    } catch (error) {
      throw new FileSystemError(
        `Parent directory is not accessible: ${parentDir}`,
        dirPath,
        'validateParentDirectory',
        {
          component: 'FileOrganizer',
          operation: 'validateParentDirectory',
          userMessage: 'Cannot create directory because parent directory is not accessible.',
          suggestions: [
            'Check if parent directories exist',
            'Verify parent directory permissions',
            'Choose a different output location'
          ],
          metadata: { dirPath, parentDir }
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Validate file path for potential issues
   */
  private validateFilePath(filePath: string): void {
    // Check path length (Windows has 260 char limit, Unix typically 4096)
    const maxPathLength = process.platform === 'win32' ? 260 : 4096;
    if (filePath.length > maxPathLength) {
      throw new FileSystemError(
        `File path too long: ${filePath.length} characters (max: ${maxPathLength})`,
        filePath,
        'validateFilePath',
        {
          component: 'FileOrganizer',
          operation: 'validateFilePath',
          userMessage: 'File path is too long for this system.',
          suggestions: [
            'Use a shorter base directory path',
            'Reduce maximum filename length setting',
            'Enable flattened directory structure'
          ],
          metadata: { filePath, length: filePath.length, maxLength: maxPathLength }
        }
      );
    }

    // Check for invalid characters (additional platform-specific checks)
    const invalidChars = process.platform === 'win32' 
      ? /[<>:"|?*\x00-\x1f]/
      : /[\x00]/;
      
    if (invalidChars.test(filePath)) {
      throw new FileSystemError(
        `File path contains invalid characters: ${filePath}`,
        filePath,
        'validateFilePath',
        {
          component: 'FileOrganizer',
          operation: 'validateFilePath',
          userMessage: 'File path contains characters not allowed by the file system.',
          suggestions: [
            'File paths are automatically sanitized',
            'Check for null characters or control characters'
          ],
          metadata: { filePath, platform: process.platform }
        }
      );
    }
  }

  /**
   * Check available disk space (rough estimate)
   */
  private async checkDiskSpace(dirPath: string, contentSize: number): Promise<void> {
    try {
      // This is a basic check - in production you might use statvfs or similar
      const stats = await stat(dirPath);
      
      // If we can stat the directory, assume we have some space
      // A more robust implementation would check actual available space
      const estimatedMinSpace = contentSize * 2; // Double the content size for safety
      
      if (estimatedMinSpace > 100 * 1024 * 1024) { // If > 100MB, warn
        this.logger.logWarn('Large file being written', {
          path: dirPath,
          contentSize,
          estimatedMinSpace
        }, 'FileOrganizer');
      }
      
    } catch (error) {
      // If we can't check disk space, log but don't fail
      this.logger.logDebug('Could not check disk space', {
        dirPath,
        error: error instanceof Error ? error.message : String(error)
      }, 'FileOrganizer');
    }
  }

  /**
   * Verify file was written successfully
   */
  private async validateFileWritten(filePath: string, expectedSize: number): Promise<void> {
    try {
      const stats = await stat(filePath);
      
      if (!stats.isFile()) {
        throw new FileSystemError(
          `Written path is not a file: ${filePath}`,
          filePath,
          'validateFileWritten',
          {
            component: 'FileOrganizer',
            operation: 'validateFileWritten',
            metadata: { filePath, expectedSize }
          }
        );
      }
      
      // Check if file size is reasonable (within 10% of expected)
      const actualSize = stats.size;
      const sizeDifference = Math.abs(actualSize - expectedSize);
      const allowedDifference = expectedSize * 0.1; // 10% tolerance
      
      if (sizeDifference > allowedDifference && expectedSize > 1000) {
        this.logger.logWarn('File size differs from expected', {
          filePath,
          expectedSize,
          actualSize,
          difference: sizeDifference
        }, 'FileOrganizer');
      }
      
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      
      throw new FileSystemError(
        `Failed to verify written file: ${filePath}`,
        filePath,
        'validateFileWritten',
        {
          component: 'FileOrganizer',
          operation: 'validateFileWritten',
          metadata: { filePath, expectedSize }
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
} 