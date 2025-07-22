# Logos Notes Exporter

A command line tool that converts Logos Bible Notes to Markdown files with YAML front-matter, organized by notebooks.

## 🛠 CLI Installation & Usage

### 📦 Download Binaries

from https://github.com/agape-apps/LogosNotesExport/releases

Choose the binary for your platform:

- **🍎 macOS (Intel)**: `LogosNotesExporter-macos-x64` (tested and working)
- **🍎 macOS (Apple Silicon)**: `LogosNotesExporter-macos-arm64` (untested)
- **🪟 Windows**: `LogosNotesExporter-windows-x64.exe` (works, limited testing)

## 📖 Getting Started (in a Terminal)

on macOS:

- make executable, move & rename, run

```
chmod +x LogosNotesExporter-*
mv -v LogosNotesExporter-* /usr/local/bin/LogosNotesExporter
LogosNotesExporter --help
```

on Windows run:

```
LogosNotesExporter-windows-x64.exe --help
```

### Basic Export

```bash
# Export all notes with default settings into Notebook folders
LogosNotesExporter

# Specify custom database location
LogosNotesExporter --database /path/to/notestool.db

# Export to custom directory
LogosNotesExporter --output ./my-exported-notes
```

### Advanced Options

```bash
# Dry run to see what would be exported
LogosNotesExporter --dry-run --verbose

# Export with date-based folders (instead of Notebook folders)
LogosNotesExporter --date-folders --no-organize-notebooks

# Export without YAML frontmatter and show some metadata in content
LogosNotesExporter --no-frontmatter --show-metadata

# Custom date format
LogosNotesExporter --date-format short
```

### Command Line Options

```
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
  --no-frontmatter       Exclude YAML frontmatter (default: include)
  --show-metadata        Include metadata in markdown content (default: only shown in frontmatter)
  --no-dates             Exclude creation/modification dates (default: include)
  --no-notebook-info     Exclude notebook information (default: include)
  --include-id           Include note IDs
  --date-format          Date format: iso, locale, short (default: ${DEFAULT_CONFIG.markdown.dateFormat})
  
  PROCESSING:
  --verbose, -v        Verbose output
  --dry-run            Show what would be done without writing files
  --help, -h           Show this help
  --version            Show version
```

## 📁 Output Structure

The tool creates a well-organized directory structure:

```
Logos-Exported-Notes/
├── README.md                       # Main index with statistics
├── Topical Notebook Folder/        
│   ├── README.md                   # Notebook index
│   ├── NT66_Rom-08.02.md           # Individual notes
│   ├── NT70_Eph-06.17.md
│   └── NT72_Col-02.11.md
├── Another Notebook Folder/
│   ├── README.md
│   ├── NT61_Matt-04.04.md
│   └── NT64_John-06.63.md
└── No Notebook/                    # Notes without notebooks
    ├── README.md
    └── NT81_1Pet-03.15.md
```

## 📄 Markdown Format

Each exported note includes comprehensive YAML front-matter:

```yaml
---
title: "Matthew 24:6-8"
created: "2013-01-22T23:49:35.000Z"
modified: "2013-01-22T23:52:42.000Z"
tags:
  - "disasters"
  - "matthew"
  - "text"
noteType: "text"
references:
  - "Matthew 24:6-8"
noteId: 583
notebook: "Disasters"
logosBibleBook: 61
bibleVersion: "NKJV"
noteStyle: "highlight"
noteColor: "yellow"
noteIndicator: "exclamation"
dataType: "bible"
resourceId: "LLS:1.0.30"
resourceTitle: "The New King James Version"
anchorLink: "https://app.logos.com/books/LLS%3A1.0.30/references/bible+nkjv.61.24.6-61.24.8"
filename: "NT61_Matt-24.06"
---

And you will hear of wars and rumors of wars. See that you are not troubled; for all these things must come to pass, but the end is not yet.  For nation will rise against nation, and kingdom against ...

- Do not be troubled
- These things must come to pass
```

## 🗄 Database Locations

- Database is always opened read-only
- Bible references are always included when available

For Development (use copy of database):

```
LogosDocuments/NotesToolManager/notestool.db
```

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
