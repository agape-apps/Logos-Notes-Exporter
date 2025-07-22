import { existsSync, statSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parseDocument } from 'yaml';
import type { OrganizedNote, NotebookGroup } from './types.js';

export interface ValidationOptions {
  /** Check that all notes were exported */
  checkNoteCount: boolean;
  /** Check file structure integrity */
  checkFileStructure: boolean;
  /** Verify frontmatter format */
  checkFrontmatter: boolean;
  /** Check Bible reference accuracy */
  checkReferences: boolean;
  /** Sample size for content validation (0 = all files) */
  sampleSize: number;
}

export interface ValidationResult {
  /** Overall validation status */
  isValid: boolean;
  /** List of issues found */
  issues: ValidationIssue[];
  /** Validation statistics */
  stats: ValidationStats;
  /** Summary message */
  summary: string;
}

export interface ValidationIssue {
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** Issue type */
  type: 'file' | 'content' | 'structure' | 'format';
  /** Issue description */
  message: string;
  /** Related file path */
  filePath?: string;
  /** Additional context */
  details?: string;
}

export interface ValidationStats {
  /** Total files checked */
  filesChecked: number;
  /** Files with issues */
  filesWithIssues: number;
  /** Total issues found */
  totalIssues: number;
  /** Issues by severity */
  issuesBySeverity: Record<string, number>;
  /** Average file size */
  averageFileSize: number;
}

const DEFAULT_VALIDATION_OPTIONS: ValidationOptions = {
  checkNoteCount: true,
  checkFileStructure: true,
  checkFrontmatter: true,
  checkReferences: true,
  sampleSize: 50
};

export class ExportValidator {
  private options: ValidationOptions;

  constructor(options: Partial<ValidationOptions> = {}) {
    this.options = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
  }

  /**
   * Validate the exported notes
   */
  public async validateExport(
    exportDir: string,
    originalNotes: OrganizedNote[],
    notebookGroups: NotebookGroup[]
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const stats: ValidationStats = {
      filesChecked: 0,
      filesWithIssues: 0,
      totalIssues: 0,
      issuesBySeverity: { error: 0, warning: 0, info: 0 },
      averageFileSize: 0
    };

    // Check if export directory exists
    if (!existsSync(exportDir)) {
      issues.push({
        severity: 'error',
        type: 'structure',
        message: 'Export directory does not exist',
        filePath: exportDir
      });
      return this.buildResult(false, issues, stats);
    }

    // Validate file structure
    if (this.options.checkFileStructure) {
      this.validateFileStructure(exportDir, notebookGroups, issues, stats);
    }

    // Validate note count
    if (this.options.checkNoteCount) {
      await this.validateNoteCount(exportDir, originalNotes, issues, stats);
    }

    // Validate content quality
    if (this.options.checkFrontmatter || this.options.checkReferences) {
      await this.validateContent(exportDir, originalNotes, issues, stats);
    }

    // Calculate final statistics
    stats.totalIssues = issues.length;
    stats.filesWithIssues = stats.filesChecked - (stats.filesChecked - issues.filter(i => i.filePath).length);

    const isValid = stats.issuesBySeverity.error === 0;
    return this.buildResult(isValid, issues, stats);
  }

  /**
   * Validate the overall file structure
   */
  private validateFileStructure(exportDir: string, notebookGroups: NotebookGroup[], issues: ValidationIssue[], stats: ValidationStats): void {
    // Check main README exists
    const mainReadme = join(exportDir, 'README.md');
    if (!existsSync(mainReadme)) {
      issues.push({
        severity: 'warning',
        type: 'structure',
        message: 'Main README.md not found',
        filePath: mainReadme
      });
    }

    // Check notebook directories exist
    for (const group of notebookGroups) {
      const notebookName = group.notebook?.title || 'No Notebook';
      const notebookDir = join(exportDir, group.sanitizedFolderName);
      
      if (!existsSync(notebookDir)) {
        issues.push({
          severity: 'error',
          type: 'structure',
          message: `Notebook directory missing: ${notebookName}`,
          filePath: notebookDir
        });
        continue;
      }

      // Check notebook README
      const notebookReadme = join(notebookDir, 'README.md');
      if (!existsSync(notebookReadme)) {
        issues.push({
          severity: 'warning',
          type: 'structure',
          message: `Notebook README missing: ${notebookName}`,
          filePath: notebookReadme
        });
      }
         }

     stats.issuesBySeverity.error = (stats.issuesBySeverity.error || 0) + issues.filter(i => i.severity === 'error').length;
     stats.issuesBySeverity.warning = (stats.issuesBySeverity.warning || 0) + issues.filter(i => i.severity === 'warning').length;
   }

  /**
   * Validate that all notes were exported
   */
  private async validateNoteCount(exportDir: string, originalNotes: OrganizedNote[], issues: ValidationIssue[], stats: ValidationStats): Promise<void> {
    const markdownFiles = this.findMarkdownFiles(exportDir);
    const expectedCount = originalNotes.length;
    const actualCount = markdownFiles.filter(f => !f.endsWith('README.md')).length;

    if (actualCount !== expectedCount) {
      issues.push({
        severity: 'error',
        type: 'file',
        message: `Note count mismatch: expected ${expectedCount}, found ${actualCount}`,
        details: `Missing ${expectedCount - actualCount} notes`
      });
    } else {
      issues.push({
        severity: 'info',
        type: 'file',
        message: `All ${expectedCount} notes successfully exported`
      });
    }

         stats.filesChecked = actualCount;
     stats.issuesBySeverity.error = (stats.issuesBySeverity.error || 0) + issues.filter(i => i.severity === 'error').length;
     stats.issuesBySeverity.info = (stats.issuesBySeverity.info || 0) + issues.filter(i => i.severity === 'info').length;
  }

  /**
   * Validate content quality
   */
  private async validateContent(exportDir: string, originalNotes: OrganizedNote[], issues: ValidationIssue[], stats: ValidationStats): Promise<void> {
    const markdownFiles = this.findMarkdownFiles(exportDir).filter(f => !f.endsWith('README.md'));
    const sampleFiles = this.options.sampleSize > 0 
      ? markdownFiles.slice(0, this.options.sampleSize)
      : markdownFiles;

    let totalSize = 0;

    for (const filePath of sampleFiles) {
      try {
        const content = readFileSync(filePath, 'utf8');
        const fileSize = statSync(filePath).size;
        totalSize += fileSize;

        // Check frontmatter format
        if (this.options.checkFrontmatter) {
          this.validateFrontmatter(filePath, content, issues);
        }

        // Check references
        if (this.options.checkReferences) {
          this.validateReferences(filePath, content, issues);
        }

      } catch (error) {
        issues.push({
          severity: 'error',
          type: 'file',
          message: `Failed to read file: ${error}`,
          filePath
        });
      }
    }

         stats.averageFileSize = sampleFiles.length > 0 ? Math.round(totalSize / sampleFiles.length) : 0;
     stats.issuesBySeverity.error = (stats.issuesBySeverity.error || 0) + issues.filter(i => i.severity === 'error').length;
     stats.issuesBySeverity.warning = (stats.issuesBySeverity.warning || 0) + issues.filter(i => i.severity === 'warning').length;
  }

  /**
   * Lint YAML content for syntax validity
   */
  private lintYaml(yamlContent: string): { valid: boolean; error?: string; data?: unknown; warnings?: string[] } {
    try {
      const doc = parseDocument(yamlContent);
      
      // Check for errors
      if (doc.errors.length > 0) {
        return {
          valid: false,
          error: doc.errors.map(e => e.message).join('; ')
        };
      }
      
      // Check for warnings (optional)
      const warnings = doc.warnings.length > 0 
        ? doc.warnings.map(w => w.message) 
        : undefined;
      
      return { 
        valid: true, 
        data: doc.toJS(),
        warnings
      };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown YAML error'
      };
    }
  }

  /**
   * Validate YAML frontmatter format
   */
  private validateFrontmatter(filePath: string, content: string, issues: ValidationIssue[]): void {
    if (!content.startsWith('---\n')) {
      issues.push({
        severity: 'warning',
        type: 'format',
        message: 'Missing YAML frontmatter',
        filePath
      });
      return;
    }

    const frontmatterEnd = content.indexOf('\n---\n', 4);
    if (frontmatterEnd === -1) {
      issues.push({
        severity: 'warning',
        type: 'format',
        message: 'Malformed YAML frontmatter (missing end marker)',
        filePath
      });
      return;
    }

    const frontmatter = content.substring(4, frontmatterEnd);
    
    // Validate YAML syntax using yaml package
    const yamlResult = this.lintYaml(frontmatter);
    if (!yamlResult.valid) {
      issues.push({
        severity: 'warning',
        type: 'format',
        message: `Invalid YAML syntax: ${yamlResult.error}`,
        filePath
      });
      return; // Don't continue with field validation if YAML is invalid
    }

    // Add warnings for YAML parser warnings
    if (yamlResult.warnings && yamlResult.warnings.length > 0) {
      issues.push({
        severity: 'warning',
        type: 'format',
        message: `YAML warnings: ${yamlResult.warnings.join('; ')}`,
        filePath
      });
    }

    // Check for required fields (only if YAML is valid)
    const requiredFields = ['title', 'created', 'noteType'];
    for (const field of requiredFields) {
      if (!frontmatter.includes(`${field}:`)) {
        issues.push({
          severity: 'warning',
          type: 'format',
          message: `Missing required frontmatter field: ${field}`,
          filePath
        });
      }
    }
  }

  /**
   * Validate Bible references
   */
  private validateReferences(filePath: string, content: string, issues: ValidationIssue[]): void {
    // Check for reference section in frontmatter
    if (content.includes('references:')) {
      const referenceMatches = content.match(/- reference: "([^"]+)"/g);
      if (referenceMatches) {
        for (const match of referenceMatches) {
          const reference = match.match(/- reference: "([^"]+)"/)?.[1];
          if (reference && !this.isValidReference(reference)) {
            issues.push({
              severity: 'warning',
              type: 'content',
              message: `Potentially invalid Bible reference: ${reference}`,
              filePath
            });
          }
        }
      }
    }
  }

  /**
   * Find all markdown files in the export directory
   */
  private findMarkdownFiles(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const entries = readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...this.findMarkdownFiles(fullPath));
        } else if (entry.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore directory read errors
    }
    
    return files;
  }

  /**
   * Basic Bible reference validation
   */
  private isValidReference(reference: string): boolean {
    // Basic patterns for Bible references
    const patterns = [
      /^[A-Za-z0-9\s]+ \d+:\d+/,  // "Book Chapter:Verse"
      /^[A-Za-z0-9\s]+ \d+:\d+-\d+/,  // "Book Chapter:Verse-Verse"
      /^[A-Za-z0-9\s]+ \d+/  // "Book Chapter"
    ];
    
    return patterns.some(pattern => pattern.test(reference));
  }

  /**
   * Sanitize filename for cross-platform compatibility
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  /**
   * Build validation result
   */
  private buildResult(isValid: boolean, issues: ValidationIssue[], stats: ValidationStats): ValidationResult {
    const errorCount = stats.issuesBySeverity.error || 0;
    const warningCount = stats.issuesBySeverity.warning || 0;
    const infoCount = stats.issuesBySeverity.info || 0;

    let summary = `Validation ${isValid ? 'PASSED' : 'FAILED'}`;
    summary += ` - ${stats.filesChecked} files checked`;
    
    if (errorCount > 0) {
      summary += `, ${errorCount} errors`;
    }
    if (warningCount > 0) {
      summary += `, ${warningCount} warnings`;
    }
    if (infoCount > 0) {
      summary += `, ${infoCount} info`;
    }

    return {
      isValid,
      issues,
      stats,
      summary
    };
  }

  /**
   * Update validation options
   */
  public updateOptions(newOptions: Partial<ValidationOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current validation options
   */
  public getOptions(): ValidationOptions {
    return { ...this.options };
  }
} 