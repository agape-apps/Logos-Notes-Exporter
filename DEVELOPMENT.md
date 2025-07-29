## Development for CLI

*(this needs to be updated with current scripts)*

### Prerequisites

- [Bun - install from here](https://bun.sh/) runtime (v1.0.0 or higher)
- Access to Logos Bible Software NotesTool database file

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/logos-notes-exporter.git
cd logos-notes-exporter

# Check Bun installation and Install dependencies
bun --version
bun install

# Make CLI executable
chmod +x src/cli.ts
```

## Build Binaries for macOS and Windows

```sh
bun run binary:macx64    # Build for macOS Intel
bun run binary:macarm    # Build for macOS Apple Silicon  
bun run binary:windows   # Build for Windows x64
```

- Logos-Notes-Exporter binary files will be in bin/...

## Publish release

- Update version in package.json and publish new binary release
- this will trigger new Release builds via Github actions

```sh
scripts/create-release.sh
```

- remove a tag in case of build errors, for example

```sh
git tag -d v1.x.x
git push origin --delete v1.x.x
```

## 📖 Usage

during development run

```sh
bun run export [options]
```

### Running Tests

```bash
bun test
```

### Type Checking

```bash
bun run lint
```

### Building

```bash
bun run build
```

### Project Structure

```
bin/       # executable binary files for multiple platforms
data/      # database and XAML data
docs/      # documentation of databases and XAML
scripts/   # create binary release script, triggers Github Action
packages/  # TypeScript source code files in monorepo for CLI, Electron and Core

Logos-Exported-Notes/  # exported Markdown notes  
```

## 🏗 Architecture

The project follows a modular architecture:

- order of files follows a logical processing flow from CLI to output

- **`cli.ts`**: Command-line interface and main application entry point
- **`notestool-database.ts`**: SQLite database interface for notes data
- **`catalog-database.ts`**: Interface for Logos catalog database to resolve resource titles
- **`database-locator.ts`**: Cross-platform database discovery and validation
- **`reference-decoder.ts`**: Bible reference parsing and formatting
- **`notebook-organizer.ts`**: Note organization by notebooks and folders
- **`file-organizer.ts`**: File structure and path management
- **`metadata-processor.ts`**: YAML frontmatter generation and metadata extraction
- **`markdown-converter.ts`**: Markdown generation with YAML frontmatter integration
- **`xaml-converter.ts`**: XAML-to-Markdown conversion with formatting preservation
- **`unicode-cleaner.ts`**: Unicode text cleaning and footnote marker removal
- **`validator.ts`**: Export quality assurance and validation
- **`types.ts`**: Centralized TypeScript type definitions

## 📊 Supported Note Types

- **Text Notes** (kind: 0): Regular text notes
- **Highlights** (kind: 1): Highlighted text passages

## 🔗 Bible Reference Support

The tool supports Logos Bible reference formats:

- **Anchor format**: `bible+nkjv.61.24.14` → "1 Peter 24:14"


## 🗄 Database Locations

- Database is always opened read-only
- For Development you can use a copy of the databases by copying the Logos directory 

The tool looks for the NotesTool database in these common locations:

### Windows

```
%LOCALAPPDATA%\Logos4\Documents\<RANDOM_ID>\NotesToolManager\notestool.db
```

### macOS

```
~/Library/Application Support/Logos4/Documents/<RANDOM_ID>/NotesToolManager/notestool.db
```

### Custom Location

Specify with the `--database` option.
