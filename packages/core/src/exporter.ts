import { join } from 'path';
import type { XamlConversionStats } from './markdown-converter.js';
import type { OrganizationStats, NotebookGroup } from './notebook-organizer.js';
import type { ValidationResult, ValidationIssue } from './validator.js';
import { 
  NotebookOrganizer, 
  FileOrganizer, 
  MarkdownConverter, 
  ExportValidator, 
  NotesToolDatabase, 
  CatalogDatabase,
  type FileStructureOptions,
  type MarkdownOptions
} from './index.js';

/**
 * Core export configuration options
 */
export interface CoreExportOptions {
  /** Database file path */
  database?: string;
  /** Output directory */
  output?: string;
  /** Organization options */
  organizeByNotebooks?: boolean;
  includeDateFolders?: boolean;
  createIndexFiles?: boolean;
  /** Markdown options */
  includeFrontmatter?: boolean;
  includeMetadata?: boolean;
  includeDates?: boolean;
  includeNotebook?: boolean;
  includeId?: boolean;
  dateFormat?: 'iso' | 'locale' | 'short';
  /** Processing options */
  skipHighlights?: boolean;
  htmlSubSuperscript?: boolean;
  indentsNotQuotes?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
}

/**
 * Export progress callback
 */
export type ProgressCallback = (progress: number, message: string) => void;

/**
 * Logging callback
 */
export type LogCallback = (message: string) => void;

/**
 * Export callbacks for UI integration
 */
export interface ExportCallbacks {
  onProgress?: ProgressCallback;
  onLog?: LogCallback;
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  stats?: {
    totalNotes: number;
    notesWithContent: number;
    notesWithReferences: number;
    notebooks: number;
    orphanedNotes: number;
    filesCreated: number;
    xamlStats: XamlConversionStats;
  };
}

/**
 * Core Logos Notes Exporter
 * Contains the main export logic that can be used by both CLI and Electron
 */
export class LogosNotesExporter {
  private database: NotesToolDatabase;
  private catalogDb?: CatalogDatabase;
  private organizer: NotebookOrganizer;
  private fileOrganizer: FileOrganizer;
  private markdownConverter: MarkdownConverter;
  private validator: ExportValidator;
  private options: CoreExportOptions;
  private callbacks: ExportCallbacks;

  constructor(options: CoreExportOptions, callbacks: ExportCallbacks = {}) {
    this.options = options;
    this.callbacks = callbacks;
    
    // Initialize database with automatic location detection
    this.database = new NotesToolDatabase(options.database);
    
    // Initialize catalog database for resource titles
    try {
      this.catalogDb = new CatalogDatabase(this.database.getDatabaseInfo().path);
      if (options.verbose) {
        const catalogInfo = this.catalogDb.getCatalogInfo();
        this.log(`📖 Using catalog database: ${catalogInfo.path}`);
        if (catalogInfo.size) {
          this.log(`   Size: ${(catalogInfo.size / 1024 / 1024).toFixed(1)} MB`);
        }
      }
    } catch (error) {
      if (options.verbose) {
        this.log('⚠️  Catalog database not found or accessible. Resource titles will not be included.');
        this.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    this.organizer = new NotebookOrganizer(this.database, { skipHighlights: options.skipHighlights || false });
    
    // Show database info in verbose mode
    if (options.verbose) {
      const dbInfo = this.database.getDatabaseInfo();
      this.log(`📁 Using database: ${dbInfo.description}`);
      this.log(`   Path: ${dbInfo.path}`);
      if (dbInfo.size) {
        this.log(`   Size: ${(dbInfo.size / 1024 / 1024).toFixed(1)} MB`);
      }
      this.log('');
    }
    
    // Configure file organizer
    const fileOptions: Partial<FileStructureOptions> = {
      baseDir: options.output || './Logos-Exported-Notes',
      organizeByNotebooks: options.organizeByNotebooks !== false,
      includeDateFolders: options.includeDateFolders || false,
      createIndexFiles: options.createIndexFiles !== false,
    };
    
    // Get resourceIds for filename generation
    const resourceIds = this.database.getResourceIds();
    this.fileOrganizer = new FileOrganizer(fileOptions, resourceIds);
    
    // Configure markdown converter
    const markdownOptions: Partial<MarkdownOptions> = {
      includeFrontmatter: options.includeFrontmatter !== false,
      includeMetadata: options.includeMetadata || false,
      includeDates: options.includeDates !== false,
      includeNotebook: options.includeNotebook !== false,
      includeId: options.includeId || false,
      dateFormat: options.dateFormat || 'iso',
      htmlSubSuperscript: options.htmlSubSuperscript || false,
      indentsNotQuotes: options.indentsNotQuotes || false,
    };
    this.markdownConverter = new MarkdownConverter(markdownOptions, this.database, options.verbose || false, this.catalogDb, this.log.bind(this));
    this.validator = new ExportValidator();
  }

  /**
   * Main export process
   */
  public async export(): Promise<ExportResult> {
    try {
      this.log('🚀 Starting Logos Notes export...\n');
      this.progress(0, 'Initializing export...');

      // Organize notes by notebooks
      this.log('📚 Organizing notes by notebooks...');
      this.progress(10, 'Organizing notes by notebooks...');
      const notebookGroups = await this.organizer.organizeNotes();
      this.log(`Found ${notebookGroups.length} notebook groups`);

      // Get organization statistics
      const stats = this.organizer.getOrganizationStats();
      this.logStats(stats);

      // Plan file structure
      this.log('\n📁 Planning file structure...');
      this.progress(25, 'Planning file structure...');
      await this.fileOrganizer.planDirectoryStructure(notebookGroups);
      const summary = this.fileOrganizer.getFileOperationSummary(notebookGroups);
      this.logFileSummary(summary);

      if (this.options.dryRun) {
        this.log('\n🔍 DRY RUN - No files will be written');
        this.logDryRunSummary(notebookGroups);
        return {
          success: true,
          outputPath: this.fileOrganizer.getOptions().baseDir,
          stats: {
            totalNotes: stats.totalNotes,
            notesWithContent: stats.notesWithContent,
            notesWithReferences: stats.notesWithReferences,
            notebooks: stats.notebooks,
            orphanedNotes: stats.orphanedNotes,
            filesCreated: 0,
            xamlStats: this.markdownConverter.getXamlConversionStats()
          }
        };
      }

      // Process each notebook group
      this.log('\n📝 Converting notes to markdown and processing images...');
      this.progress(40, 'Converting notes to markdown and processing images...');
      let totalProcessed = 0;
      const totalNotes = notebookGroups.reduce((sum, group) => sum + group.notes.length, 0);

      for (let i = 0; i < notebookGroups.length; i++) {
        const group = notebookGroups[i];
        const notebookName = group.notebook?.title || 'No Notebook';
        const baseProgress = 40 + (i / notebookGroups.length) * 40;
        
        this.progress(baseProgress, `Processing: ${notebookName} (converting & downloading images)...`);
        this.log(`Processing: ${notebookName} (${group.notes.length} notes)`);

        // Resolve filename conflicts
        const fileMap = this.fileOrganizer.resolveFilenameConflicts(group.notes, group);
        
        // Convert notes to markdown with image processing
        const markdownResults = await this.markdownConverter.convertNotebookWithImages(
          group, 
          fileMap, 
          this.fileOrganizer.getOptions().baseDir
        );

        // Write notes to files
        for (const [note, result] of markdownResults) {
          const fileInfo = fileMap.get(note);
          if (fileInfo) {
            await this.fileOrganizer.writeFile(fileInfo, result.content);
            totalProcessed++;
            
            const progressPercent = 40 + (totalProcessed / totalNotes) * 40;
            this.progress(progressPercent, `Processed ${totalProcessed}/${totalNotes} notes (with images)`);
            
            if (this.options.verbose) {
              this.log(`  ✓ ${fileInfo.filename}`);
            }
          }
        }

        // Create notebook index
        if (this.fileOrganizer.getOptions().createIndexFiles) {
          const indexContent = this.fileOrganizer.generateNotebookIndex(group);
          const indexPath = join(this.fileOrganizer.getNotebookDirectory(group), 'README.md');
          await this.fileOrganizer.ensureDirectory(this.fileOrganizer.getNotebookDirectory(group));
          await this.fileOrganizer.writeFile({
            fullPath: indexPath,
            directory: this.fileOrganizer.getNotebookDirectory(group),
            filename: 'README',
            relativePath: indexPath.replace(this.fileOrganizer.getOptions().baseDir + '/', ''),
            exists: false
          }, indexContent);
        }
      }

      // Create main index
      if (this.fileOrganizer.getOptions().createIndexFiles) {
        this.log('\n📋 Creating main index...');
        this.progress(90, 'Creating index files...');
        const mainIndexContent = this.fileOrganizer.generateMainIndex(notebookGroups, stats);
        const mainIndexPath = join(this.fileOrganizer.getOptions().baseDir, 'README.md');
        await this.fileOrganizer.writeFile({
          fullPath: mainIndexPath,
          directory: this.fileOrganizer.getOptions().baseDir,
          filename: 'README',
          relativePath: 'README.md',
          exists: false
        }, mainIndexContent);
      }

      // Display Rich Text (XAML) conversion statistics
      this.log('\n📊 Rich Text (XAML) Conversion Statistics:');
      this.progress(95, 'Finalizing export...');
      const xamlStats = this.markdownConverter.getXamlConversionStats();
      this.displayXamlStats(xamlStats);

      // Show detailed XAML conversion failures in verbose mode
      if (this.options.verbose && xamlStats.xamlConversionsFailed > 0) {
        this.displayXamlFailures();
      }

      // Show detailed image processing failures in verbose mode
      if (this.options.verbose && xamlStats.imageDownloadsFailed > 0) {
        this.displayImageFailures();
      }

      // Validate export (if enabled)
      if (!this.options.dryRun) {
        this.log('\n🔍 Validating export...');
        const allNotes = notebookGroups.flatMap(group => group.notes);
        const validationResult = await this.validator.validateExport(
          this.fileOrganizer.getOptions().baseDir,
          allNotes,
          notebookGroups
        );

        // Display validation results
        this.displayValidationResults(validationResult);
        
        if (!validationResult.isValid) {
          this.log('\n⚠️  Export completed with validation issues. See details above.');
        }
      }

      // Show completion summary
      this.progress(100, 'Export completed successfully!');
      this.log('\n✅ Export completed successfully!');
      this.log(`📁 Output directory: ${this.fileOrganizer.getOptions().baseDir}`);
      this.log(`📄 Total files created: ${totalProcessed}`);
      this.log(`📚 Notebooks processed: ${notebookGroups.length}`);
      
      return {
        success: true,
        outputPath: this.fileOrganizer.getOptions().baseDir,
        stats: {
          totalNotes: stats.totalNotes,
          notesWithContent: stats.notesWithContent,
          notesWithReferences: stats.notesWithReferences,
          notebooks: stats.notebooks,
          orphanedNotes: stats.orphanedNotes,
          filesCreated: totalProcessed,
          xamlStats: xamlStats
        }
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`\n❌ Export failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      this.close();
    }
  }

  /**
   * Close database connections
   */
  public close(): void {
    this.organizer.close();
    if (this.catalogDb) {
      this.catalogDb.close();
    }
  }

  /**
   * Log message using callback or console
   */
  private log(message: string): void {
    if (this.callbacks.onLog) {
      this.callbacks.onLog(message);
    } else {
      console.log(message);
    }
  }

  /**
   * Report progress using callback
   */
  private progress(progress: number, message: string): void {
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress(progress, message);
    }
  }

  /**
   * Log organization statistics
   */
  private logStats(stats: OrganizationStats): void {
    this.log(`\n📊 Statistics:`);
    this.log(`  Total Notes: ${stats.totalNotes}`);
    this.log(`  Notes with Content: ${stats.notesWithContent}`);
    this.log(`  Notes with References: ${stats.notesWithReferences}`);
    this.log(`  Notebooks: ${stats.notebooks}`);
    this.log(`  Notes with No Notebook: ${stats.orphanedNotes}`);
  }

  /**
   * Log file operation summary
   */
  private logFileSummary(summary: {
    totalDirectories: number;
    totalFiles: number;
    totalIndexFiles: number;
    estimatedSize: string;
  }): void {
    this.log(`  Directories to create: ${summary.totalDirectories}`);
    this.log(`  Notes to export: ${summary.totalFiles}`);
    this.log(`  Index files to create: ${summary.totalIndexFiles}`);
    this.log(`  Estimated size: ${summary.estimatedSize}`);
  }

  /**
   * Log dry run summary
   */
  private logDryRunSummary(notebookGroups: NotebookGroup[]): void {
    for (const group of notebookGroups) {
      const notebookName = group.notebook?.title || 'No Notebook';
      this.log(`\n📚 ${notebookName}:`);
      this.log(`  📄 ${group.notes.length} notes would be exported`);
      
      if (this.options.verbose) {
        for (const note of group.notes.slice(0, 5)) {
          this.log(`    - ${note.formattedTitle || 'Untitled'}`);
        }
        if (group.notes.length > 5) {
          this.log(`    ... and ${group.notes.length - 5} more`);
        }
      }
    }
  }

  /**
   * Display Rich Text (XAML) conversion statistics
   */
  private displayXamlStats(stats: XamlConversionStats): void {
    this.log(`  Total notes processed: ${stats.totalNotes}`);
    this.log(`  Notes with Rich Text content: ${stats.notesWithXaml}`);
    this.log(`  Conversions succeeded: ${stats.xamlConversionsSucceeded}`);
    this.log(`  Conversion issues: ${stats.xamlConversionsFailed}`);
    this.log(`  Plain text notes: ${stats.plainTextNotes}`);
    this.log(`  Empty notes: ${stats.emptyNotes}`);

    // Display image processing statistics
    if (stats.imagesFound > 0 || stats.imagesDownloaded > 0 || stats.imageDownloadsFailed > 0) {
      this.log(`\n📸 Image Processing Statistics:`);
      this.log(`  Images found: ${stats.imagesFound}`);
      this.log(`  Images downloaded: ${stats.imagesDownloaded}`);
      this.log(`  Download failures: ${stats.imageDownloadsFailed}`);
      this.log(`  Total image size: ${stats.totalImageSizeMB.toFixed(2)} MB`);
      
      if (stats.imageDownloadsFailed > 0) {
        this.log(`\n⚠️  Image Download Issues: ${stats.imageDownloadsFailed} out of ${stats.imagesFound} images failed to download`);
      } else if (stats.imagesDownloaded > 0) {
        this.log(`\n✅ Image Processing: All ${stats.imagesDownloaded} images downloaded successfully`);
      }
    }
    
    if (stats.notesWithXaml > 0) {
      if (stats.xamlConversionsFailed > 0) {
        this.log(`\n⚠️  Rich Text (XAML) Conversion Issues:\n   ${stats.xamlConversionsFailed} out of ${stats.notesWithXaml} conversions had issues`);
      } else {
        this.log(`\n✅ Rich Text (XAML) Conversion: All ${stats.notesWithXaml} Rich Text Notes converted successfully`);
      }
    }
  }

  /**
   * Display detailed Rich Text (XAML) conversion failures in verbose mode
   */
  private displayXamlFailures(): void {
    const failures = this.markdownConverter.getXamlConversionFailures();
    
    if (failures.length === 0) {
      return;
    }

    this.log('\n🔍 Detailed Rich Text (XAML) Conversion Issues:');
    
    for (const failure of failures) {
      this.log(`\n❌ Note ID ${failure.noteId}: ${failure.noteTitle}`);
      
      if (failure.failureType === 'empty_content') {
        this.log(`   Issue: Rich Text (XAML) conversion succeeded but produced empty content`);
      } else {
        this.log(`   Issue: Exception during Rich Text (XAML) conversion`);
        if (failure.errorMessage) {
          this.log(`   Error: ${failure.errorMessage}`);
        }
      }
      
      this.log(`   XAML preview: ${failure.xamlContentPreview}${failure.xamlContentPreview.length >= 150 ? '...' : ''}`);
    }
  }

  /**
   * Display detailed image processing failures in verbose mode
   */
  private displayImageFailures(): void {
    const failures = this.markdownConverter.getImageFailures();

    if (failures.length === 0) {
      return;
    }

    this.log('\n🔍 Detailed Image Processing Issues:');

    for (const failure of failures) {
      this.log(`\n❌ ${failure.failureType.toUpperCase()} FAILURE:`);
      this.log(`   URL: ${failure.urlPreview}`);
      this.log(`   Note: ${failure.noteFilename}`);
      this.log(`   Error: ${failure.errorMessage}`);
    }
  }

  /**
   * Display validation results to the user
   */
  private displayValidationResults(result: ValidationResult): void {
    this.log(`\n📋 ${result.summary}`);
    
    if (result.issues.length > 0) {
      const errors = result.issues.filter((i: ValidationIssue) => i.severity === 'error');
      const warnings = result.issues.filter((i: ValidationIssue) => i.severity === 'warning');
      const info = result.issues.filter((i: ValidationIssue) => i.severity === 'info');
      
      if (errors.length > 0) {
        this.log('\n❌ Errors found:');
        for (const error of errors.slice(0, 5)) { // Show first 5 errors
          this.log(`  • ${error.message}`);
          if (error.filePath && this.options.verbose) {
            this.log(`    File: ${error.filePath}`);
          }
        }
        if (errors.length > 5) {
          this.log(`  ... and ${errors.length - 5} more errors`);
        }
      }
      
      if (warnings.length > 0 && this.options.verbose) {
        this.log('\n⚠️  Warnings found:');
        for (const warning of warnings.slice(0, 3)) { // Show first 3 warnings
          this.log(`  • ${warning.message}`);
        }
        if (warnings.length > 3) {
          this.log(`  ... and ${warnings.length - 3} more warnings`);
        }
      }
      
      if (info.length > 0 && this.options.verbose) {
        this.log('\n💡 Info:');
        for (const infoItem of info.slice(0, 3)) { // Show first 3 info items
          this.log(`  • ${infoItem.message}`);
        }
        if (info.length > 3) {
          this.log(`  ... and ${info.length - 3} more info items`);
        }
      }
    }
  }
} 