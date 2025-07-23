#!/usr/bin/env bun
import { parseArgs } from 'util';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { 
  LogosNotesExporter,
  type CoreExportOptions,
  type ExportCallbacks,
  NotesToolDatabase
} from '@logos-notes-exporter/core';
import { DEFAULT_CONFIG } from '@logos-notes-exporter/config';

/**
 * Read version from package.json
 */
function getPackageVersion(): string {
  try {
    const packagePath = join(process.cwd(), 'package.json');
    const packageContent = readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(packageContent);
    return packageJson.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

interface CLIOptions {
  /** Database file path */
  database?: string;
  /** List available database locations */
  listDatabases?: boolean;
  /** Show database search instructions */
  showInstructions?: boolean;
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
  help?: boolean;
  version?: boolean;
}

const HELP_TEXT = `
Logos Notes Exporter - Convert Logos notes to Markdown

USAGE:
  LogosNotesExporter [OPTIONS]

OPTIONS:
  --database, -d        Path to NotesTool database file (auto-detected if not specified)
  --list-databases      List all available database locations and exit
  --show-instructions   Show manual database location instructions and exit
  --output, -o          Output directory (default: ${DEFAULT_CONFIG.export.outputDirectory})
  
  ORGANIZATION:
  --no-organize-notebooks  Disable organizing notes by notebooks (default: organize by notebooks)
  --date-folders           Create date-based subdirectories
  --skip-highlights        Skip highlight notes, export only text and annotation notes (default: enabled)
  --include-highlights     Include highlight notes in export (overrides default)
  --no-index-files         Do not create README.md index files (default: create them)
  
  MARKDOWN:
  --html-sub-superscript Use HTML sub/superscript tags instead of Pandoc-style ~text~ and ^text^
  --indents-not-quotes   Use indents with non-breaking spaces instead of blockquotes (default: convert to >) 
  --no-frontmatter       Exclude YAML frontmatter (default: include)
  --show-metadata        Include metadata in markdown content (default: only shown in frontmatter)
  --no-dates             Exclude creation/modification dates (default: include)
  --no-notebook-info     Exclude notebook information (default: include)
  --include-id           Include note IDs
  --date-format          Date format: iso, locale, short (default: ${DEFAULT_CONFIG.markdown.dateFormat})
  
  PROCESSING:
  --verbose, -v         Verbose output
  --dry-run             Show what would be done without writing files
  --help, -h            Show this help
  --version             Show version

EXAMPLES:
  # Basic export (auto-locates database)
  LogosNotesExporter

  # Include highlight notes as well
  LogosNotesExporter --include-highlights
  
  # Custom output directory location
  LogosNotesExporter --output ./My-Notes
  
  # Dry run to see what would be exported
  LogosNotesExporter --dry-run --verbose
  
  # Export without frontmatter and show metadata in content
  LogosNotesExporter --no-frontmatter --show-metadata

  # List available database locations
  LogosNotesExporter --list-databases
  
  # Export using a custom database location
  LogosNotesExporter --database ./path/to/notestool.db

NOTES:
  - All database operations are READ-ONLY for safety, Logos can continue to be used while exporting
  - Database is auto-detected in standard Logos installation locations
    - Windows: %LOCALAPPDATA%\\Logos\\Documents\\{random-id}\\NotesToolManager\\notestool.db
    - macOS: ~/Library/Application Support/Logos4/Documents/{random-id}/NotesToolManager/notestool.db
    - Use --list-databases to see all available locations
  - Output files will be organized by notebooks unless --no-organize-notebooks
  - Existing files will be overwritten by default
`;

/**
 * Parse command line arguments
 */
function parseCommandLine(): CLIOptions {
  const args = process.argv.slice(2);
  
  const parsed = parseArgs({
    args,
    options: {
      // Database options
      database: { type: 'string', short: 'd' },
      'list-databases': { type: 'boolean' },
      'show-instructions': { type: 'boolean' },
      output: { type: 'string', short: 'o' },
      
      // Organization options
      'no-organize-notebooks': { type: 'boolean' },
      'date-folders': { type: 'boolean' },
      'no-index-files': { type: 'boolean' },
      
      // Markdown options
      'no-frontmatter': { type: 'boolean' },
      'show-metadata': { type: 'boolean' },
      'no-dates': { type: 'boolean' },
      'no-notebook-info': { type: 'boolean' },
      'include-id': { type: 'boolean' },
      'date-format': { type: 'string' },
      
      // Processing options
      'skip-highlights': { type: 'boolean' },
      'include-highlights': { type: 'boolean' },
      'html-sub-superscript': { type: 'boolean' },
      'indents-not-quotes': { type: 'boolean' },
      verbose: { type: 'boolean', short: 'v' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean' },
    },
    allowPositionals: false,
  });

  const options: CLIOptions = {
    database: parsed.values.database,
    listDatabases: parsed.values['list-databases'],
    showInstructions: parsed.values['show-instructions'],
    output: parsed.values.output,
    organizeByNotebooks: !parsed.values['no-organize-notebooks'],
    includeDateFolders: parsed.values['date-folders'],
    createIndexFiles: !parsed.values['no-index-files'],
    includeFrontmatter: !parsed.values['no-frontmatter'],
    includeMetadata: parsed.values['show-metadata'],
    includeDates: !parsed.values['no-dates'],
    includeNotebook: !parsed.values['no-notebook-info'],
    includeId: parsed.values['include-id'],
    dateFormat: parsed.values['date-format'] as 'iso' | 'locale' | 'short' | undefined,
    skipHighlights: parsed.values['include-highlights'] ? false : (parsed.values['skip-highlights'] ?? DEFAULT_CONFIG.export.skipHighlights),
    htmlSubSuperscript: parsed.values['html-sub-superscript'] ?? DEFAULT_CONFIG.xaml.htmlSubSuperscript,
    indentsNotQuotes: parsed.values['indents-not-quotes'],
    verbose: parsed.values.verbose,
    dryRun: parsed.values['dry-run'],
    help: parsed.values.help,
    version: parsed.values.version,
  };

  return options;
}

/**
 * Validate CLI options
 */
function validateOptions(options: CLIOptions): void {
  // Check database exists if provided
  if (options.database && !existsSync(options.database)) {
    console.error(`❌ Database file not found: ${options.database}`);
    process.exit(1);
  }

  // Validate date format
  if (options.dateFormat && !['iso', 'locale', 'short'].includes(options.dateFormat)) {
    console.error(`❌ Invalid date format: ${options.dateFormat}. Must be one of: iso, locale, short`);
    process.exit(1);
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const options = parseCommandLine();

  // Handle help and version
  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (options.version) {
    const version = getPackageVersion();
    console.log(`Logos Notes Exporter v${version}`);
    process.exit(0);
  }

  // Handle database discovery commands
  if (options.listDatabases) {
    const locations = NotesToolDatabase.displayAvailableLocations();
    console.log(locations.join('\n'));
    process.exit(0);
  }

  if (options.showInstructions) {
    const instructions = NotesToolDatabase.getSearchInstructions();
    console.log(instructions.join('\n'));
    process.exit(0);
  }

  // Validate options
  validateOptions(options);

  // Convert CLI options to core options
  const coreOptions: CoreExportOptions = {
    database: options.database,
    output: options.output,
    organizeByNotebooks: options.organizeByNotebooks,
    includeDateFolders: options.includeDateFolders,
    createIndexFiles: options.createIndexFiles,
    includeFrontmatter: options.includeFrontmatter,
    includeMetadata: options.includeMetadata,
    includeDates: options.includeDates,
    includeNotebook: options.includeNotebook,
    includeId: options.includeId,
    dateFormat: options.dateFormat,
    skipHighlights: options.skipHighlights,
    htmlSubSuperscript: options.htmlSubSuperscript,
    indentsNotQuotes: options.indentsNotQuotes,
    verbose: options.verbose,
    dryRun: options.dryRun,
  };

  // Create callbacks for CLI output
  const callbacks: ExportCallbacks = {
    onLog: (message: string) => console.log(message),
    // Progress callback not needed for CLI
  };

  // Create and run exporter
  const exporter = new LogosNotesExporter(coreOptions, callbacks);
  const result = await exporter.export();

  if (!result.success) {
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { parseCommandLine, validateOptions, main }; 