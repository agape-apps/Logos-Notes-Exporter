# TODO

## BINARY BUILDS & PUBLISHING

- [x] Binary Electron package runs: https://www.electronjs.org/docs/latest/tutorial/forge-overview
- [ ] Electron publish: https://www.electronjs.org/docs/latest/tutorial/tutorial-publishing-updating
- [x] APP LOGO works

## BUGS & ISSUES

- this date is not relevant to the context: **Created:** 4/15/2017   (Notebook created?). Also improve headings
- fix validation issues: 📋 Validation FAILED - 31 files checked, 2 errors ❌ Errors found: Note count mismatch: expected 29, found 31

- [ ] Create a subfolder always: Manual selection without creating a default folder could cause problems: /Users/christian/Documents/Test Output
- [x] remove unused dev db location LogosDocuments
- [x] use consistent default export location for Notes macOS & Windows Documents
- [ ] do we really want to add tags by default? (Notebook name, etc.)
- [x] Output Log cleanup duplication: 🚀 Starting export... 🚀 Starting export... Starting Logos Notes export...
- [ ] Consider changing LogosNotesExporter CLI command to Logos-Notes-Exporter for consistency (optional)
- [x] During development and app use (manual refresh), if Electron reloads, the db connection is lost

- [x] when exporting notes after the first start the screen refreshes and the log disappears
- [x] Markdown: is it ok for list items to have a double space at the line ending? YES, OK

## OPTIONAL ISSUES

- [ ] check src/xaml-converter.ts, possibly too many blank lines in some cases, but mostly looking good
- [ ] invalid offsets (-1) have been fixed but the book link is not that useful - check other options:
      - anchorLink: "https://app.logos.com/books/LLS%3A1.0.20"
      - in Logos-Exported-Notes/Conditional Immortality/LLS-1.0.20-0736.md
      - add a tag or note?

## DO NOT FIX

Fix was attempted, but failed. Not necessary and not worth fixing.
- Electron Console Log: Function components cannot be given refs. Attempts to access this ref will fail. (This warning does not show up once the app is packaged.)
- Electron Security Warning (Insecure Content-Security-Policy (This warning will not show up
once the app is packaged.)

### Issues to check 

- [x] Multiple Anchors work. First anchor is used for main reference and filename
- [ ] How to manage highlight notes without text?
  - [ ] add scripture from WEB (World English Bible) OPTIONAL
  - [ ] Just add the reference range in the Markdown section
- [ ] Why are there notes of type highlight which have text in them?

## TESTING & ERROR HANDLING

- [ ] testing with jest unit tests, including actual XAML samples
- [ ] more testing on Windows
- [ ] test on Apple Silicon
- [ ] improve error handling, for databases, for conversion issues, for download/network issues CHECK
- [ ] End to End testing with real sample database files

## SETTINGS & CONFIGURATION

- The CLI settings have their own defaults in spite of the centralized settings file, as the default is to run without flags. It would take a lot of changes to automatically follow each settings change in the CLI. Currently only done for including highlight notes, so the default can be easily changed. 
- a different CLI UI design would be needed to make it similar to the Electron version, but that is not really needed

## EXPORT OPTIONS & FEATURES

- [x] Export notes for each Notebook into one Markdown Index file 
- [ ] Export just one Notebook (useful for big collections)
- [ ] Export by Tags (not tested tags yet) OPTIONAL
- [x] Include the scripture reference in notes text (MOSTLY DONE, check)
- [ ] add more flexible conversion options (depending on Markdown target) (OPTIONS IN SETTINGS)
- [ ] Simplify Options
  - [ ] only Obsidian useful options for the default setting
  - [x] export highlights in only in advanced mode
  - [ ] all Metadata for backup purposes
  - [ ] all notes on one page (Notebook export) with only essential metadata for actual use (in Word or for printing)
  - [ ] individual options in hiddden panel
- [ ] noteId: and logosBibleBook: are not needed in default metadata
- [ ] Use Wikilinks for images if export is for Obsidian (OPTIONAL)
- [ ] German version (OPTIONAL)

#### Completed Export Options

- [x] Overwrite notes (default, inform users)
- [x] Export all
- [x] Add Logos Tags to Notes Metadata 

## XAML CONVERSION 

- [ ] Test with copy/paste notes to Libreoffice 
- [x] Test with copy/paste notes to Libreoffice and then convert the rich text document to Markdown with Pandoc (tested)
- [x] Use `pandoc input.docx -f docx -t markdown -o output-docx.md`
- [x] then compare the results with our converter (not impressive, very limited)
- [x] possibly have Pandoc compatible settings as an option (not worth it)
- [x] If regular Markdown is copied into Notes using the default font (10 - 12 size), then the formatting will be maintained as plain text Markdown (should not be modified by the converter)
- [ ] four spaces can turn into code (but not always?) NOT USUALLY USED IN NOTES
- [ ] Note to user: not everything converts nicely (In README and HELP)

**Tabs**
- [x] only convert formatting instructions from XAML formatting (Tabs are the exception)
- [x] tabs **on the start of lines** will be shown as code (in many Markdown readers), convert to indents instead? (OPTION IN SETTINGS)
  - [x] **turn into indents** (either as blockquote or nbsp with spaces) DEFAULT
  - [x] make no changes to tabs in the middle of lines!
  - [x] NOT preserve so as to pass through to Markdown  (used for Code only, but not used much. More common would be 4 spaces or ```) 
  - [ ] turn into space(s) (like Pandoc) (OPTIONAL but not needed)

#### Completed XAML Conversion

- [x] fix complex unordered list
- [x] fix complex ordered list (fix)
- [x] fix indents, they get ignored
- [x] use one indent without list as blockquote
- [x] improve subscript/superscript options (OPTION IN SETTINGS)
      HTML and Subscript~123~ Superscript^123^ for Typora (Obsidian with plugin)
- [x] change small caps to CAPITALS only 
- [x] download Images
- [x] font sizes 24 and up is H1
- [x] Heading sizes based on available sizes in Logos (add in-between sizes as well)
- [x] Normal Font: 12, 11, 10 (and below)
- [x] Small font: 9 (and below) <small>
- [x] font size 9 and below is <small>
- [x] Add support for other monospace Font Names

## DATABASE

- [ ] **Note to user:** Logos can be open safely, as sqlite is used read only - verify that this will not cause a lock on usage in Logos!

## GUI & USER INTERFACE

- [x] separate Progress display into dedicated card component in Basic view
- [ ] Implement improvements, refactoring from Electron App Evaluation, see EVALUATION.md

## APP-SPECIFIC FEATURES

### For LibreOffice/Word

- [ ] Paste Markdown from Typora and MarkText (same result)
- [ ] Export to Word .docx from Typora

### For Obsidian 

- [x] view all notes from one notebook in one document, similar to the notes exporter
  - [x] Verse references
  - [ ] Book references ?
  - [x] Note text
  - [x] —- divider
  - [x] optionally exclude highlights
  - [x] Use README.md index files for that: INDEX.md
- [ ] Obsidian plugins could show verses on hover. Many recognize Bible references and can also link to a Bible for example
- [ ] Note names are unique and could be linked to with Wikilinks from other notes in Obsidian (TEST)

#### Completed Obsidian Features

- [x] view formatted notes inside Notebooks one by one

## CODE IMPROVEMENTS

### Code Duplication

- [ ] only note (text) and highlights are actual note types, annotation should be the same as unknown
  - [ ] Multiple "Get human-readable note type name" includes annotation as 2 or unknown (inconsistently)

### Features to Investigate

- [ ] possibly add `empty note` Tag to notes like Heavenly Citizens - Phil. Ch. 3/NT71_Phil-03.20.md (remove the notice text)

### Options Review

- [ ] this option may not be needed: `--no-notebook-info` Exclude notebook information (default: include)

## TECHNICAL NOTES

### KEEP bun:sqlite !

**DO NOT IMPLEMENT THE STEPS BELOW, because then the Bun binary builds will not work any more**

- [ ] Update core package to use better-sqlite3 instead of bun:sqlite for universal Node.js/Bun compatibility.
- [ ] Removed 55-line database adapter layer from Electron package as it's no longer needed.
- [ ] Eliminated duplicate SQLite dependencies between packages for simplified dependency management.
- [ ] Verified CLI functionality works correctly with Bun runtime using better-sqlite3 Node.js module.
- [ ] Verified Electron functionality works correctly using better-sqlite3 Node.js module.
- [ ] Tested this version, but does not work for this project as binary builds become impractical.

### FIX HACKS 

- Extract note content by reading the generated markdown file
  // TODO: this is quite a hack. Instead the generated note content should be
  // copied into each note file and the Notebook index file in the same loop.

### Cannot Fix

- to get the highlighted text which corresponds to the highlight range from books is impossible, as we do not have access to the content of book resources

- highlight range for verses can only output the whole verse highlighted (not word by word range)
- These could only be implemented by Logos with their own exporter from within the app

### General Notes

- [ ] note that not all CLI command option combinations or settings combinations have been tested

## MAIN USE CASES

### Backup (working)

Prevents vendor lock-in of data

- [ ] implement as a named setting
- [x] backup of all notes
- [x] backup of all highlights (by Bible verse OK, but not from books)
- [ ] show max amount of meta-data

### Use in other Apps like Obsidian (working)

- [ ] implement as a named setting
- [x] folder structure by Notebook
- [x] Notes are named in easy to sort manner
- [ ] focus on meta data that is useful in Obsidian

### Similar to Export/Print (not implemented yet)

- [ ] implement as a named setting
- [ ] use in Word, Libreoffice, elsewhere
- [ ] needs the scripture references, possibly book reference
- [ ] list of Notes from one Notebook
- [ ] only minimal metadata
- [ ] could be added to the index file

### Check Notebooks count

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