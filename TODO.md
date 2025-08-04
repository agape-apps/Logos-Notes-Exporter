# TODO

## HIGH PRIORITY - BUGS & ISSUES

- [ ] Refactor large files into smaller files (MOSTLY DONE)
- [ ] Check if validation issues still happen: 📋 Validation FAILED - 31 files checked, 2 errors ❌ Errors found: Note count mismatch: expected 29, found 31 (REPRODUCE)
- [ ] *Output Directory* is shown incorrectly as `/Users/user/Documents` after *Restore Defaults* is clicked, but the correct directory is actually used
- [x] Create a subfolder always: Manual selection without creating a default folder could cause problems: /Users/christian/Documents/Test Output
- [x] Change LogosNotesExporter CLI command to Logos-Notes-Exporter for consistency

## BINARY BUILDS & PUBLISHING

- [ ] Electron publish: https://www.electronjs.org/docs/latest/tutorial/tutorial-publishing-updating

## TESTING & ERROR HANDLING

- [ ] Testing with jest unit tests, including actual XAML samples
- [ ] More testing on Windows
- [ ] Test on Apple Silicon
- [ ] Improve error handling, for databases, for conversion issues, for download/network issues CHECK
- [ ] End to End testing with real sample database files

## EXPORT OPTIONS & FEATURES

- [ ] Export by Tags (not tested tags yet) OPTIONAL
- [ ] Do we really want to add tags by default? (Notebook name, etc.)
- [ ] Add more flexible conversion options (depending on Markdown target) (OPTIONS IN SETTINGS)
- [ ] Simplify Options
  - [ ] Only Obsidian useful options for the default setting
  - [ ] All Metadata for backup purposes
  - [x] All notes on one page (Notebook export) with only essential metadata for actual use (in Word or for printing)
  - [ ] Individual options in hidden panel (OPTINAL, as Advanced view basically works well)
- [ ] noteId: and logosBibleBook: are not needed in default metadata
- [ ] Use Wikilinks for images if export is for Obsidian (OPTIONAL)
- [ ] German version (OPTIONAL)
- [ ] Add help text to help button (or remove the button)

## XAML CONVERSION

- [ ] Four spaces can turn into code (but not always?) NOT USUALLY USED IN NOTES
- [x] Note to user: not everything converts nicely (In README and HELP)
- [ ] Turn tabs into space(s) (like Pandoc) (OPTIONAL but not needed)

## OPTIONAL ISSUES

- [ ] Check src/xaml-converter.ts, possibly too many blank lines in some cases, but mostly looking good
- [ ] Invalid offsets (-1) have been fixed but the book link is not that useful - check other options:
      - anchorLink: "https://app.logos.com/books/LLS%3A1.0.20"
      - in Logos-Exported-Notes/Conditional Immortality/LLS-1.0.20-0736.md
      - add a tag or note?

### Issues to check

- [ ] How to manage highlight notes without text?
  - [ ] Add scripture from WEB (World English Bible) OPTIONAL
  - [ ] Just add the reference range in the Markdown section
- [ ] Why are there notes of type highlight which have text in them?

## DATABASE

- [x] **Note to user:** Logos can be open safely, as sqlite is used read only - verify that this will not cause a lock on usage in Logos!

## APP-SPECIFIC FEATURES

### For LibreOffice/Word

- [ ] Paste Markdown from Typora, Obsidian and MarkText (same result)
- [ ] Export to Word .docx from Typora

### For Obsidian

- [ ] Book references ?
- [ ] Obsidian plugins could show verses on hover. Many recognize Bible references and can also link to a Bible for example
- [ ] Note names are unique and could be linked to with Wikilinks from other notes in Obsidian (TEST)

## CODE IMPROVEMENTS

### Code Duplication

- [ ] Only note (text) and highlights are actual note types, annotation should be the same as unknown
  - [ ] Multiple "Get human-readable note type name" includes annotation as 2 or unknown (inconsistently)

### Features to Investigate

- [ ] Possibly add `empty note` Tag to notes like Heavenly Citizens - Phil. Ch. 3/NT71_Phil-03.20.md (remove the notice text)

### Options Review

- [ ] This option may not be needed: `--no-notebook-info` Exclude notebook information (default: include)

### FIX HACKS

- Extract note content by reading the generated markdown file
  // TODO: this is quite a hack. Instead the generated note content should be
  // copied into each note file and the Notebook index file in the same loop.

## MAIN USE CASES

### Backup (working)

Prevents vendor lock-in of data

- [ ] Implement as a named setting
- [ ] Show max amount of meta-data

### Use in other Apps like Obsidian (working)

- [ ] Implement as a named setting
- [ ] Focus on meta data that is useful in Obsidian

### Similar to Export/Print (not implemented yet)

- [ ] Implement as a named setting
- [ ] Use in Word, Libreoffice, elsewhere
- [ ] Needs the scripture references, possibly book reference
- [ ] List of Notes from one Notebook
- [ ] Only minimal metadata
- [ ] Could be added to the index file

## SETTINGS & CONFIGURATION

- The CLI settings have their own defaults in spite of the centralized settings file, as the default is to run without flags. It would take a lot of changes to automatically follow each settings change in the CLI. Currently only done for including highlight notes, so the default can be easily changed.
- A different CLI UI design would be needed to make it similar to the Electron version, but that is not really needed

## TECHNICAL NOTES

### KEEP bun:sqlite !

**DO NOT IMPLEMENT THE STEPS BELOW, because then the Bun binary builds will not work any more**

- [ ] Update core package to use better-sqlite3 instead of bun:sqlite for universal Node.js/Bun compatibility.
- [ ] Removed 55-line database adapter layer from Electron package as it's no longer needed.
- [ ] Eliminated duplicate SQLite dependencies between packages for simplified dependency management.
- [ ] Verified CLI functionality works correctly with Bun runtime using better-sqlite3 Node.js module.
- [ ] Verified Electron functionality works correctly using better-sqlite3 Node.js module.
- [ ] Tested this version, but does not work for this project as binary builds become impractical.

### Cannot Fix

- To get the highlighted text which corresponds to the highlight range from books is impossible, as we do not have access to the content of book resources
- Highlight range for verses can only output the whole verse highlighted (not word by word range)
- These could only be implemented by Logos with their own exporter from within the app

### General Notes

- [ ] Note that not all CLI command option combinations or settings combinations have been tested

## DO NOT FIX

Fix was attempted, but failed. Not necessary and not worth fixing.
- Electron Console Log: Function components cannot be given refs. Attempts to access this ref will fail. (This warning does not show up once the app is packaged.)
- Electron Security Warning (Insecure Content-Security-Policy (This warning will not show up once the app is packaged.)

## STATISTICS (for reference)

📚 Organizing notes by notebooks...
Found 60 notebook groups

📊 Statistics:
  Total Notes: 2009
  Notes with Content: 373
  Notes with References: 1699
  Notebooks: 73
  Notes with No Notebook: 814

📁 Planning file structure...
  Directories to create: 61
  Notes to export: 349
  Index files to create: 61
  Estimated size: 759 KB