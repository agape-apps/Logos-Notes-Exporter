import { join } from 'path';
import { DEFAULT_CONFIG } from '@logos-notes-exporter/config';
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
import {
  ExportError,
  DatabaseError,
  ValidationError,
  Logger,
  ErrorHandler
} from './errors/index.js';

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
  /** Filtering options */
  notebook?: string;
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
  notebookNotFound?: boolean;
  requestedNotebook?: string;
  stats?: {
    totalNotes: number;
    notesWithContent: number;
    notesWithReferences: number;
    notebooks: number;
    orphanedNotes: number;
    filesCreated: number;
    xamlStats: XamlConversionStats;
  };
  /** Detailed error information for debugging */
  exportError?: ExportError;
  /** Export phases completed successfully */
  completedPhases: string[];
  /** Total processing time in milliseconds */
  processingTimeMs?: number;
  /** Recovery strategies applied during export */
  recoveryStrategies: string[];
}

export interface ExportPipelineStats {
  totalErrors: number;
  totalWarnings: number;
  criticalErrors: number;
  recoverableErrors: number;
  skippedNotes: number;
  partialConversions: number;
  recoveryStrategiesUsed: Record<string, number>;
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
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private pipelineStats: ExportPipelineStats;
  private completedPhases: string[] = [];
  private recoveryStrategies: string[] = [];
  private startTime: number = 0;

  constructor(options: CoreExportOptions, callbacks: ExportCallbacks = {}) {
    this.options = options;
    this.callbacks = callbacks;
    
    // Initialize logging and error handling
    this.logger = new Logger({
      enableConsole: true,
      level: options.verbose ? 0 : 1,
      includeStackTrace: options.verbose || false
    });
    this.errorHandler = new ErrorHandler(this.logger);
    
    // Initialize pipeline statistics
    this.pipelineStats = {
      totalErrors: 0,
      totalWarnings: 0,
      criticalErrors: 0,
      recoverableErrors: 0,
      skippedNotes: 0,
      partialConversions: 0,
      recoveryStrategiesUsed: {}
    };
    
    // Initialize database with automatic location detection and error handling
    try {
      this.database = new NotesToolDatabase(options.database);
      this.logger.logInfo('Database connection established', {
        path: this.database.getDatabaseInfo().path
      }, 'LogosNotesExporter');
    } catch (error) {
      const dbError = new DatabaseError(
        `Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`,
        {
          component: 'LogosNotesExporter',
          operation: 'initialize',
          userMessage: 'Could not connect to the Logos database',
          suggestions: [
            'Verify the database file path is correct',
            'Ensure Logos is not currently running',
            'Check file permissions for the database',
            'Try using the database locator to find the correct path'
          ],
          metadata: {
            requestedPath: options.database,
            phase: 'initialization'
          }
        },
        error instanceof Error ? error : new Error(String(error))
      );
      
      this.logger.logFatal(dbError.message, dbError.getDetails(), 'LogosNotesExporter');
      throw dbError;
    }
    
    // Initialize catalog database for resource titles with error handling
    try {
      this.catalogDb = new CatalogDatabase(this.database.getDatabaseInfo().path);
      const catalogInfo = this.catalogDb.getCatalogInfo();
      this.logger.logInfo('Catalog database connected', {
        path: catalogInfo.path,
        sizeMB: catalogInfo.size ? (catalogInfo.size / 1024 / 1024).toFixed(1) : 'unknown'
      }, 'LogosNotesExporter');
      
      if (options.verbose) {
        this.log(`📖 Using catalog database: ${catalogInfo.path}`);
        if (catalogInfo.size) {
          this.log(`   Size: ${(catalogInfo.size / 1024 / 1024).toFixed(1)} MB`);
        }
      }
    } catch (error) {
      this.pipelineStats.totalWarnings++;
      this.logger.logWarn('Catalog database not available - resource titles will not be included', {
        error: error instanceof Error ? error.message : String(error),
        impact: 'reduced_metadata'
      }, 'LogosNotesExporter');
      
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
      baseDir: options.output || DEFAULT_CONFIG.export.outputDirectory,
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
    this.markdownConverter = new MarkdownConverter(markdownOptions, this.database, options.verbose || false, this.catalogDb, this.log.bind(this), this.logger);
    this.validator = new ExportValidator();
  }

  /**
   * Main export process with comprehensive error handling and recovery
   */
  public async export(): Promise<ExportResult> {
    this.startTime = Date.now();
    let currentPhase = 'initialization';
    
    try {
      this.logger.logInfo('Starting Logos Notes export', {
        options: this.options,
        timestamp: new Date().toISOString()
      }, 'LogosNotesExporter');
      
      this.log('🚀 Starting Logos Notes export...\n');
      this.progress(0, 'Initializing export...');
      
      // Phase 1: Initialization
      currentPhase = 'initialization';
      await this.executePhaseWithErrorHandling(currentPhase, async () => {
        // Validate export configuration
        this.validateExportConfiguration();
        this.completedPhases.push(currentPhase);
      });

      // Phase 2: Organize notes by notebooks
      currentPhase = 'organization';
      let notebookGroups: NotebookGroup[] = [];
      await this.executePhaseWithErrorHandling(currentPhase, async () => {
        this.log('📚 Organizing notes by notebooks...');
        this.progress(10, 'Organizing notes by notebooks...');
        notebookGroups = await this.organizer.organizeNotes();
        this.log(`Found ${notebookGroups.length} notebook groups`);
        this.completedPhases.push(currentPhase);
      });

      // Phase 3: Filter by specific notebook if requested
      if (this.options.notebook) {
        currentPhase = 'filtering';
        await this.executePhaseWithErrorHandling(currentPhase, async () => {
          const targetNotebook = this.options.notebook!;
          this.log(`🔍 Filtering for notebook: "${targetNotebook}"`);
          
          const filteredGroups = notebookGroups.filter(group => {
            const notebookTitle = group.notebook?.title || 'No Notebook';
            return notebookTitle.toLowerCase() === targetNotebook.toLowerCase();
          });

          if (filteredGroups.length === 0) {
            throw new ValidationError(
              `Notebook not found: "${targetNotebook}"`,
              'notebook',
              targetNotebook,
              {
                component: 'LogosNotesExporter',
                operation: 'filterNotebook',
                userMessage: 'The specified notebook was not found in the database',
                suggestions: [
                  'Check the notebook name spelling',
                  'Use the exact notebook name as it appears in Logos',
                  'Remove the notebook filter to export all notebooks'
                ],
                metadata: {
                  availableNotebooks: notebookGroups.map(g => g.notebook?.title || 'No Notebook').slice(0, 10)
                }
              }
            );
          }

          notebookGroups = filteredGroups;
          this.log(`✅ Found notebook "${filteredGroups[0].notebook?.title || 'No Notebook'}" with ${filteredGroups[0].notes.length} notes`);
          this.completedPhases.push(currentPhase);
        });
        
        // Handle notebook not found error specifically
        if (!this.completedPhases.includes('filtering')) {
          return {
            success: false,
            notebookNotFound: true,
            requestedNotebook: this.options.notebook,
            completedPhases: this.completedPhases,
            recoveryStrategies: this.recoveryStrategies
          };
        }
      }

      // Get organization statistics
      const stats = this.organizer.getOrganizationStats();
      this.logStats(stats);

      // Phase 4: Plan file structure
      currentPhase = 'file_planning';
      let summary: any;
      await this.executePhaseWithErrorHandling(currentPhase, async () => {
        this.log('\n📁 Planning file structure...');
        this.progress(25, 'Planning file structure...');
        await this.fileOrganizer.planDirectoryStructure(notebookGroups);
        summary = this.fileOrganizer.getFileOperationSummary(notebookGroups);
        this.logFileSummary(summary);
        this.completedPhases.push(currentPhase);
      });

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
          },
          completedPhases: this.completedPhases,
          recoveryStrategies: this.recoveryStrategies
        };
      }

      // Phase 5: Process each notebook group
      currentPhase = 'conversion';
      let totalProcessed = 0;
      const totalNotes = notebookGroups.reduce((sum, group) => sum + group.notes.length, 0);
      
      await this.executePhaseWithErrorHandling(currentPhase, async () => {
        this.log('\n📝 Converting notes to markdown and processing images...');
        this.progress(40, 'Converting notes to markdown and processing images...');

        for (let i = 0; i < notebookGroups.length; i++) {
          const group = notebookGroups[i];
          const notebookName = group.notebook?.title || 'No Notebook';
          const baseProgress = 40 + (i / notebookGroups.length) * 40;
          
          try {
            this.progress(baseProgress, `Processing: ${notebookName} (converting & downloading images)...`);
            this.log(`Processing: ${notebookName} (${group.notes.length} notes)`);

            // Process notebook with error recovery
            const processed = await this.processNotebookWithRecovery(group, totalNotes, baseProgress);
            totalProcessed += processed;

          } catch (error) {
            this.pipelineStats.criticalErrors++;
            this.handleNotebookProcessingError(group, error);
            
            // Apply recovery strategy - skip this notebook but continue with others
            this.pipelineStats.skippedNotes += group.notes.length;
            this.recoveryStrategies.push(`Skipped notebook: ${notebookName} due to processing error`);
            
            this.logger.logError(new ExportError(
              `Failed to process notebook: ${notebookName}`,
              'conversion',
              (i / notebookGroups.length) * 100,
              {
                component: 'LogosNotesExporter',
                operation: 'processNotebook',
                userMessage: 'Some notes could not be processed and were skipped',
                suggestions: [
                  'Check the error details below',
                  'Try processing individual notebooks',
                  'Review database integrity'
                ],
                metadata: {
                  notebookName,
                  noteCount: group.notes.length,
                  recoveryApplied: 'skip_notebook'
                }
              },
              error instanceof Error ? error : new Error(String(error))
            ));
          }
        }
        
        this.completedPhases.push(currentPhase);
      });

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
        },
        completedPhases: this.completedPhases,
        processingTimeMs: Date.now() - this.startTime,
        recoveryStrategies: this.recoveryStrategies
      };
      
    } catch (error) {
      this.pipelineStats.criticalErrors++;
      const processingTime = Date.now() - this.startTime;
      
      let exportError: ExportError;
      if (error instanceof ExportError) {
        exportError = error;
      } else {
        exportError = new ExportError(
          `Export failed during ${currentPhase} phase: ${error instanceof Error ? error.message : String(error)}`,
          currentPhase,
          this.calculateProgress(),
          {
            component: 'LogosNotesExporter',
            operation: 'export',
            userMessage: 'The export process encountered a critical error and could not continue',
            suggestions: [
              'Check the error details for specific issues',
              'Verify database integrity and permissions',
              'Try exporting a smaller subset of notes',
              'Check available disk space and permissions'
            ],
            metadata: {
              failedPhase: currentPhase,
              completedPhases: this.completedPhases,
              processingTimeMs: processingTime,
              pipelineStats: this.pipelineStats
            }
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
      
      this.logger.logError(exportError);
      this.errorHandler.handleError(exportError);
      
      const errorMessage = exportError.getUserMessage();
      this.log(`\n❌ Export failed: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        exportError,
        completedPhases: this.completedPhases,
        processingTimeMs: processingTime,
        recoveryStrategies: this.recoveryStrategies
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
      this.log(`  Images downloaded size: ${stats.totalImageSizeMB.toFixed(2)} MB`);
      
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

  /**
   * Execute a phase with comprehensive error handling
   */
  private async executePhaseWithErrorHandling(
    phaseName: string,
    phaseFunction: () => Promise<void>
  ): Promise<void> {
        try {
          this.logger.logDebug(`Starting phase: ${phaseName}`, {
            phase: phaseName,
            timestamp: Date.now() - this.startTime
          }, 'LogosNotesExporter');
    
          await phaseFunction();
          
          this.logger.logInfo(`Phase completed: ${phaseName}`, {
            phase: phaseName,
            completionTime: Date.now() - this.startTime
          }, 'LogosNotesExporter');
    
        } catch (error) {
          this.pipelineStats.totalErrors++;
          
          const phaseError = new ExportError(
            `Phase ${phaseName} failed: ${error instanceof Error ? error.message : String(error)}`,
            phaseName,
            this.calculateProgress(),
            {
              component: 'LogosNotesExporter',
              operation: phaseName,
              userMessage: `Export failed during ${phaseName} phase`,
              suggestions: [
                'Check the specific error details',
                'Verify input parameters and permissions',
                'Try again with different settings'
              ],
              metadata: {
                phase: phaseName,
                completedPhases: this.completedPhases,
                processingTime: Date.now() - this.startTime
              }
            },
            error instanceof Error ? error : new Error(String(error))
          );
          
          this.logger.logError(phaseError);
          throw phaseError;
        }
      }
    
      /**
       * Validate export configuration before starting
       */
      private validateExportConfiguration(): void {
        try {
          // Validate database connection
          const dbInfo = this.database.getDatabaseInfo();
          if (!dbInfo.path) {
            throw new ValidationError(
              'Database path is not available',
              'database',
              this.options.database,
              {
                component: 'LogosNotesExporter',
                operation: 'validateConfiguration',
                userMessage: 'Cannot access the database file'
              }
            );
          }
    
          // Validate output directory
          if (!this.options.output) {
            throw new ValidationError(
              'Output directory is not specified',
              'output',
              this.options.output,
              {
                component: 'LogosNotesExporter',
                operation: 'validateConfiguration',
                userMessage: 'Output directory must be specified'
              }
            );
          }
    
          this.logger.logInfo('Export configuration validated', {
            database: dbInfo.path,
            output: this.options.output,
            organizeByNotebooks: this.options.organizeByNotebooks
          }, 'LogosNotesExporter');
    
        } catch (error) {
          if (error instanceof ValidationError) {
            throw error;
          }
          
          throw new ValidationError(
            `Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`,
            'configuration',
            this.options,
            {
              component: 'LogosNotesExporter',
              operation: 'validateConfiguration',
              userMessage: 'Export configuration contains invalid settings'
            },
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    
      /**
       * Process a notebook with error recovery strategies
       */
      private async processNotebookWithRecovery(
        group: NotebookGroup,
        totalNotes: number,
        baseProgress: number
      ): Promise<number> {
        let processedCount = 0;
        const notebookName = group.notebook?.title || 'No Notebook';
        
        try {
          // Resolve filename conflicts
          const fileMap = this.fileOrganizer.resolveFilenameConflicts(group.notes, group);
          
          // Convert notes to markdown with image processing
          const markdownResults = await this.markdownConverter.convertNotebookWithImages(
            group,
            fileMap,
            this.fileOrganizer.getOptions().baseDir
          );
    
          // Write notes to files with individual error handling
          for (const [note, result] of markdownResults) {
            try {
              const fileInfo = fileMap.get(note);
              if (fileInfo) {
                await this.fileOrganizer.writeFile(fileInfo, result.content);
                processedCount++;
                
                const progressPercent = baseProgress + (processedCount / totalNotes) * 40;
                this.progress(progressPercent, `Processed ${processedCount}/${totalNotes} notes (with images)`);
                
                if (this.options.verbose) {
                  this.log(`  ✓ ${fileInfo.filename}`);
                }
              }
            } catch (error) {
              this.pipelineStats.recoverableErrors++;
              this.recoveryStrategies.push(`Skipped note: ${note.formattedTitle} due to write error`);
              
              this.logger.logWarn(`Failed to write note file, skipping`, {
                noteId: note.id,
                noteTitle: note.formattedTitle,
                error: error instanceof Error ? error.message : String(error)
              }, 'LogosNotesExporter');
            }
          }
    
          // Create notebook index with error handling
          if (this.fileOrganizer.getOptions().createIndexFiles) {
            try {
              const notebookDir = this.fileOrganizer.getNotebookDirectory(group);
              const indexContent = await this.fileOrganizer.generateNotebookIndex(group, notebookDir);
              const indexPath = join(notebookDir, 'INDEX.md');
              await this.fileOrganizer.ensureDirectory(notebookDir);
              await this.fileOrganizer.writeFile({
                fullPath: indexPath,
                directory: notebookDir,
                filename: 'INDEX',
                relativePath: indexPath.replace(this.fileOrganizer.getOptions().baseDir + '/', ''),
                exists: false
              }, indexContent);
            } catch (error) {
              this.pipelineStats.recoverableErrors++;
              this.recoveryStrategies.push(`Failed to create index for notebook: ${notebookName}`);
              
              this.logger.logWarn(`Failed to create notebook index, continuing without it`, {
                notebookName,
                error: error instanceof Error ? error.message : String(error)
              }, 'LogosNotesExporter');
            }
          }
    
          return processedCount;
    
        } catch (error) {
          this.logger.logError(new ExportError(
            `Failed to process notebook: ${notebookName}`,
            'notebook_processing',
            baseProgress,
            {
              component: 'LogosNotesExporter',
              operation: 'processNotebookWithRecovery',
              userMessage: 'Error processing notebook content',
              metadata: {
                notebookName,
                noteCount: group.notes.length
              }
            },
            error instanceof Error ? error : new Error(String(error))
          ));
          
          throw error;
        }
      }
    
      /**
       * Handle notebook processing errors with appropriate logging
       */
      private handleNotebookProcessingError(group: NotebookGroup, error: unknown): void {
        const notebookName = group.notebook?.title || 'No Notebook';
        
        this.logger.logError(new ExportError(
          `Notebook processing failed: ${notebookName}`,
          'notebook_error',
          undefined,
          {
            component: 'LogosNotesExporter',
            operation: 'handleNotebookProcessingError',
            userMessage: 'A notebook could not be processed and was skipped',
            suggestions: [
              'Check if the notebook contains corrupted data',
              'Try processing other notebooks separately',
              'Review the detailed error information'
            ],
            metadata: {
              notebookName,
              noteCount: group.notes.length,
              recoveryStrategy: 'skip_notebook'
            }
          },
          error instanceof Error ? error : new Error(String(error))
        ));
      }
    
      /**
       * Calculate current progress percentage
       */
      private calculateProgress(): number {
        const phaseWeights = {
          'initialization': 10,
          'organization': 20,
          'filtering': 5,
          'file_planning': 15,
          'conversion': 40,
          'indexing': 10
        };
        
        let totalProgress = 0;
        for (const phase of this.completedPhases) {
          totalProgress += phaseWeights[phase as keyof typeof phaseWeights] || 0;
        }
        
        return Math.min(totalProgress, 100);
      }
    
      /**
       * Get comprehensive pipeline statistics
       */
      public getPipelineStats(): ExportPipelineStats {
        return { ...this.pipelineStats };
      }
    
      /**
       * Reset pipeline statistics
       */
      public resetStats(): void {
        this.pipelineStats = {
          totalErrors: 0,
          totalWarnings: 0,
          criticalErrors: 0,
          recoverableErrors: 0,
          skippedNotes: 0,
          partialConversions: 0,
          recoveryStrategiesUsed: {}
        };
        this.completedPhases = [];
        this.recoveryStrategies = [];
    }
}