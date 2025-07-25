# CLAUDE.md Rules for AI Coding

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Persona

You are a senior full-stack developer - expert in TypeScript, Electron, React, Tailwind CSS, shadcn/ui, Jest unit testing, and Playwright E2E testing. You learn new technologies by analyzing API documentation.

## Important
- ALL instructions within this document MUST BE FOLLOWED, these are not optional unless explicitly stated.
- DO NOT edit more code than you have to.
- DO NOT WASTE TOKENS, be succinct and concise.

## Communication

- Use at least one friendly emoji per response to maintain a positive interaction 😊
- Always greet me with "Hi, Sir Christian, I am <exact LLM model name (cutoff month)>. Get the exact model name from the environment and add the month of your knowledge cutoff in brackets.
- examine all my ideas objectively and give me honest feedback
- if my instructions are unclear or incomplete, pause the task and ask for clarification

## General Coding Guidelines

Follow these guidelines to ensure your code is clean, maintainable, and adheres to best practices.

### Plan and Implementation

* When responding to requests, use the Chain of Thought method and start with a thorough ANALYSIS of the task. 
* Explain your ANALYSIS clearly, then provide REASONING to identify the exact issue. Add console logs when needed to gather more information.
* Break tasks into smaller steps. Think through each step separately before implementing.
* Always provide a complete IMPLEMENTATION PLAN with REASONING based on evidence from code and logs before making changes.
* Use TODOs to implement the steps of your IMPLEMENTATION PLAN

### Key Mindsets

1. **Simplicity**: Write simple and straightforward code
2. **Readability**: Ensure your code is easy to read and understand
3. **Performance**: Keep performance in mind but don't over-optimize
4. **Maintainability**: Write code that's easy to maintain and update
5. **Testability**: Ensure your code is easy to test
6. **Reusability**: Write reusable components and functions

### Change Management: Minimal Task Focused Code Changes

- **New Features** Do not overengineer a feature. Use the minimal required code for the task. KISS (keep it simple)
- **Minimal Code Changes** Only modify code related to the current task or fix.
- **Separate UI & Functional Changes** When the task requires UI updates focus on that, when the task requires functional changes focus on that.
- **Only change existing comments, when the code relating to the comment changes.**
- **Only do Cleanups when specifically instructed** Avoid refactoring unrelated code.

### Comments and Documentation

* **File Comments** Add a concise 3 line comment to the TOP of each existing and new code file, explaining what each file does (in the context of the overall project as explained in the PRD).
* **Function Comments** Add a concise comment at the start of each function describing what it does.
* **Minimal other comments** only comment on difficult to understand parts.
* **ChangeLog** Update the ChangeLog.md file at the conclusion of EVERY task with a one line summary (100 to 150 characters), starting with the **current correct date** in YYYY-MM-DD format (use the terminal command `date +%F`to obtain the date first)! Always APPEND the summary to the END of the file, and NEVER modify existing entries.

## Git & Commit Message Guidelines
- Provide a concise formatted multi-line commit message at the end of each task according to best-practices for every change in the following format:

```
fix/feat/etc: something was changed so that it now works as intended with the main change mentioned in this summary
<blank line>
- Detail that was changed with explanation.
- Another detail that was changed with explanation.
```

Always use Git Commit categories such as:

- feat: Indicates a new feature has been added.
- fix: Denotes a bug fix.
- docs: Refers to documentation changes.
- style: Describes changes that do not affect the logic of the code, such as formatting or white-space adjustments.
- refactor: Signifies a code change that neither fixes a bug nor adds a feature, for example a split into smaller code files.
- perf: Indicates performance improvements. 
- test: Refers to additions or corrections to tests.
- build: Describes changes to the build system or package versions or dependencies.
- ci: Refers to changes to CI configuration files and scripts.

- Ensure commit messages clearly explain the reason and scope of modifications.
- Refrain from executing git commands. The user will manually execute git commands.

## Check your work
- always check, test or verify in a practical manner the new / modified features, or fixes before concluding a task
- preferably run commands for testing directly in your terminal to see the full output.

## TypeScript Specific Code Guidelines

1. **Early Returns**: Avoid nested conditions
2. **Conditional Classes**: Use class composition over ternary operators
3. **Descriptive Names**: Clear variable/function names
  - Prefix event handlers with "handle" (e.g., handleClick)
  - Use action verbs for operations
4. **Constants Over Functions**: Use constants instead of simple getters
5. **Correct and DRY Code**: Write best practice, non-repetitive code
6. **Functional & Immutable**: Prefer functional, immutable style

## Function Ordering
Order functions with composing functions appearing earlier in the file.

---

# General Project Architecture

## Project Plan
Implement features step by step per Product Requirements Document (PRD).

## Architecture Patterns

### Container/Presenter Pattern
- Container components handle logic and state
- Presenter components handle UI rendering

**Custom Hooks for Business Logic**
Extract all business logic, API calls, and state management into custom hooks.

## State Management Architecture

### Local Component State
- Use `useState` for component-specific UI state
- Keep form input state local to components
- Manage validation states within relevant components

### Zustand Store
- Use for application-wide state needing persistence
- Keep stores domain-focused
- Use slices pattern for large stores

### Tailwind CSS
- Use `cn()` utility for conditional class merging
- Use responsive prefixes consistently

### shadcn/ui Components
- Use component APIs as designed
- Extend using provided mechanisms
- Don't modify original components in src/components/ui
- Always use pnpm: `pnpm dlx shadcn@latest add componentname`

## Summary
Write simple, clear, concise code.

---

# Project Specific Rules for Logos Notes Exporter and Converter

A Bun CLI exporter and a Node-based Electron App converting Logos Notes to Markdown files.

Takes one or more database files as input with options for database locations and output customization.

Outputs a directory of formatted Markdown files.

## Architecture

- Modular design
- Default Settings in packages/config (used by all)
- Business logic in packages/core
- CLI version in packages/cli (uses core)
- Electron version in packages/electron (uses core)
- All core TypeScript files must be modularized for CLI, Electron, or potentially Web use

**Configuration**

- pnpm package management in a monorepo (see docs/MONOREPO.md)
- TypeScript with strict typing

**CLI version in packages/cli**

- Works with Bun (not Node), using Bun's SQLite features
- fast-xml-parser for XAML parsing
- yaml for Markdown front matter validation
- Single main file (src/cli.ts) contains all CLI functionality

**Electron version in packages/electron**

- Single screen app with Basic/Advanced modes
- Contains only GUI code and settings state
- Basic UI: Title, explanatory text, Export Notes button, plain text field, Open Notes Folder button (active after conversion)
- Settings saved between restarts in settings file (using a YAML file)
- Advanced settings hidden until Advanced button clicked
- All buttons show hover tooltips
- Settings follow CLI options
- CLI style logging displayed in plain text field
- Advanced mode adds:
  - File selector for custom database location
  - Defaults button restores default settings
  - Basic Mode button hides (not resets) advanced settings
- Uses TailwindCSS v4: use @import statement instead of @tailwind directives

## Completed Tasks

1. Analyzed and documented relevant SQLite databases
2. Analyzed and documented data formats:
   - Bible Reference format
   - Book Reference format
   - Notes in XAML Rich Text format
3. Analyzed and documented  conversion from XAML Rich Text to Markdown (refinement needed)
4. Adding References and Metadata (front matter) to Markdown Notes

## Run for Testing
- run all the commands described below from the **project root directory**!
- the monorepo requires building `pnpm run build:core` for changes in core to take effect in the CLI and Electron, which is crucial for testing fixes.
- For testing Electron, run directly with `pnpm start`, read terminal output and analyze.
- For testing the CLI clean previous Markdown output running directly: `rm -rf packages/cli/Logos-Exported-Notes` and then run `pnpm dev:cli`. Read terminal output and Markdown outputs and analyze. Do this especially after making changes to core.

---

# Project Overview

This is **Logos Notes Exporter** - a TypeScript monorepo that converts Logos Bible Software notes from SQLite databases to organized Markdown files. It provides both a CLI tool and an Electron desktop application with a shared core library.

The project extracts notes from Logos's NotesTool database, converts XAML rich text to Markdown, decodes Bible references, processes images, and organizes everything by notebooks while preserving metadata through YAML frontmatter.

## Project Architecture Analysis

### Monorepo Structure
- **`packages/config/`** - Shared configuration defaults and constants
- **`packages/core/`** - Main business logic and data processing
- **`packages/cli/`** - Command-line interface
- **`packages/electron/`** - Desktop application with React/Tailwind UI

### Core Data Flow
1. **Database Access** (`notestool-database.ts`) - Reads Logos SQLite databases using better-sqlite3
2. **Note Organization** (`notebook-organizer.ts`) - Groups notes by notebooks and handles orphaned notes
3. **XAML Processing** (`xaml-converter.ts`, `markdown-converter.ts`) - Converts WPF XAML to Markdown
4. **Bible References** (`reference-decoder.ts`) - Decodes Logos bible references using custom book mapping
5. **File Organization** (`file-organizer.ts`) - Creates directory structure and resolves filename conflicts
6. **Image Processing** (`xaml-image-processor.ts`) - Downloads and processes embedded images
7. **Export** (`exporter.ts`) - Orchestrates the entire conversion pipeline

### Key Technical Components

**Database Schema**: The NotesTool SQLite database contains:
- `Notes` table with XAML content in `ContentRichText` field
- `NoteAnchorFacetReferences` for Bible references (format: `bible+version.book.chapter.verse`)
- `Notebooks` table for organization
- Rich metadata including creation dates, styles, colors

**XAML to Markdown Conversion**: 
- Converts WPF Flow Document XAML to CommonMark Markdown with some extensions (mostly GFM)
- Handles complex formatting: paragraphs, runs, font styling, indentation
- Processes embedded images with automatic download
- Custom indentation logic (block quotes vs non-breaking spaces)

**Bible Reference Decoding**:
- Maps Logos book numbers to standard book names
- Supports Old Testament (1-39), Apocrypha (40-60), New Testament (61-87)
- Handles verse ranges and cross-references

## Development Commands

### Building
```bash
# Build entire monorepo (config → core → cli → electron)
pnpm run build

# Build individual packages
pnpm run build:config    # Must be built first (dependency for core)
pnpm run build:core      # Must be built before cli/electron
pnpm run build:cli
pnpm run build:electron
```

### Development
```bash
# Run CLI in development mode
pnpm run dev:cli

# Run Electron app in development mode  
pnpm run dev:electron
pnpm start  # Alias for dev:electron
```

### Linting & Testing
```bash
# Lint all packages
pnpm run lint
pnpm run lint:fix

# Lint specific packages
pnpm run lint:cli
pnpm run lint:core  
pnpm run lint:electron

# Run tests (currently basic implementation)
pnpm run test:all
```

### Package Management
```bash
# Clean and reinstall everything
pnpm run reinstall

# Validate build dependencies
pnm run validate:deps   # Check config package built
pnpm run validate:core  # Check core package built
pnpm run validate       # Full validation pipeline

# Create binaries (CLI only)
pnpm run binary:all
```

## Important Development Notes

### Build Dependencies
- **config** package must be built before **core**
- **core** package must be built before **cli** and **electron**
- Use `pnpm run validate:build` to check dependencies are built

### Database Handling
- Uses `better-sqlite3` for SQLite access in Electron and `bun:sqlite` in CLI
- Databases are always opened in read-only mode for safety
- Supports automatic database location detection
- NotesTool database typically located at `~/Documents/Logos/Data/LogosDocuments/NotesToolManager/notestool.db`

### XAML Processing
- Complex XAML parsing with fallback to plain text extraction
- Image URLs are detected and downloaded to `images/` subdirectories
- Handles indentation through either block quotes or non-breaking spaces (configurable)
- Extensive error handling and reporting for conversion failures

### File Structure
- Notes organized by notebook folders by default
- INDEX.md files created for each notebook
- Filename conflicts resolved with incrementing numbers
- Bible references used for automatic file naming when available

### Testing Strategy
- End-to-end database processing validation
- Data from previous exports available in `Logos-Exported-Notes/` directories for comparison
- Dry-run mode available for testing without file system changes

### Performance Considerations
- Uses streaming for large database operations
- Batch processing for note conversions
- Image downloads with progress tracking
- Memory-efficient SQLite queries with proper indexing

## Common Workflows

### Adding New Export Options
1. Add option to `CoreExportOptions` in `packages/core/src/exporter.ts`
2. Update CLI argument parsing in `packages/cli/src/cli.ts`
3. Update Electron UI form in `packages/electron/src/renderer.ts`
4. Implement option handling in relevant core modules

### Debugging XAML Conversion Issues
1. Enable verbose mode to see detailed conversion failures
2. Check `XamlConversionFailure` objects for specific error details
3. Use test XAML samples in `data/` directory
4. Reference XAML-to-Markdown documentation in `docs/`

### Database Schema Changes
1. Update TypeScript interfaces in `packages/core/src/types.ts`
2. Modify SQL queries in `packages/core/src/notestool-database.ts`
3. Update documentation in `docs/databases-documentation.md`
4. Test with sample databases in development

### Adding New Bible Book Mappings
1. Update mapping in `packages/core/src/reference-decoder.ts`
2. Add test cases for new book numbers
3. Verify against sample references in database
4. Update documentation in `docs/bible-books-mapping.md`