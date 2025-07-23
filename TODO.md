# TODO

## BINARY BUILDS & PUBLISHING

- [x] Electron package: https://www.electronjs.org/docs/latest/tutorial/forge-overview
- [ ] Electron publish: https://www.electronjs.org/docs/latest/tutorial/tutorial-publishing-updating
- [ ] test publishing

## BUGS & ISSUES

- [ ] check if this is still used: LogosDocuments
- [ ] consistent default export location for Notes (not relative to command) 
- [ ] do we really want to add tags by default? (Notebook name, etc.)
- [x] Output Log cleanup duplication: 🚀 Starting export... 🚀 Starting export... Starting Logos Notes export...
- [ ] 
- [ ] 

- [ ] when exporting notes after the first start the screen refreshes and the log disappears
  - happened after centralizing the settings
- [x] fix src/xaml-converter.ts, possibly too many blank lines in some cases, but mostly looking good
- [ ] invalid offsets (-1) have been fixed but the book link is not that useful - check other options:
  - anchorLink: "https://app.logos.com/books/LLS%3A1.0.20"
  - in Logos-Exported-Notes/Conditional Immortality/LLS-1.0.20-0736.md
  - add a tag or note?
- [ ] Markdown: is it ok for list items to have a double space at the line ending?

### Issues to check 

- [x] Multiple Anchors work. First anchor is used for main reference and filename
- [ ] How to manage highlight notes without text?
  - [ ] add scripture from WEB (World English Bible) OPTIONAL
  - [ ] Just add the reference range in the Markdown section
- [ ] Why are there notes of type highlight which have text in them?

## TESTING & ERROR HANDLING

- [ ] testing with jest unit tests
- [ ] more testing on Windows
- [ ] test on Apple Silicon
- [ ] improve error handling, for databases, for conversion issues, for download/network issues

## SETTINGS & CONFIGURATION

- The CLI settings have their own defaults in spite of the centralized settings file, as the default is to run without flags. It would take a lot of changes to automatically follow each settings change in the CLI. Currently only done for including highlight notes, so the default can be easily changed. 

- a different CLI UI design would be needed to make it similar to the Electron version, but that is not really needed

## EXPORT OPTIONS & FEATURES

- [ ] Export just one Notebook (useful for big collections)
- [ ] Export by Tags (not tested tags yet) OPTIONAL
- [ ] Export a Notebook into one Markdown file 
- [ ] Include the scripture reference in notes text
- [ ] add more flexible conversion options (depending on Markdown target) (OPTIONS IN SETTINGS)
- [ ] Simplify Options
  - [ ] only Obsidian useful options for the default setting
  - [x] export highlights in only in advanced mode
  - [ ] all Metadata for backup purposes
  - [ ] all notes on one page (Notebook export) with only essential metadata for actual use (in Word or for printing)
  - [ ] individual options in hiddden panel
- [ ] noteId: and logosBibleBook: are not needed in default metadata
- [ ] Optional Wikilinks for images if export is for Obsidian
- [ ] German version?

#### Completed Export Options

- [x] Overwrite notes (default, inform users)
- [x] Export all
- [x] Add Logos Tags to Notes Metadata 

## XAML CONVERSION

- [ ] It would make sense to test with copy/paste notes to Libreoffice and then convert the rich text document to Markdown with Pandoc
- [ ] `pandoc input.docx -f docx -t markdown -o output-docx.md`
- [ ] then compare the results with our converter (not impressive, very limited)
- [ ] possibly have Pandoc compatible settings as an option (not worth it)

**Tabs**

- [ ] tabs **on the start of lines** turn into code (in many Markdown readers), convert to indents instead? (OPTION IN SETTINGS)
  - [ ] **turn into indents** (either as blockquote or nbsp with spaces) DEFAULT
  - [ ] preserve (so as to pass through to Markdown - for Code, but not used much) 
  - [ ] make no changes to tabs in the middle of lines!
  - [ ] turn into nbsp (ugly)
  - [ ] turn into space(s) (like Pandoc)
- [x] If regular Markdown is copied into Notes using the default font (10 - 12 size), then the formatting will be maintained as plain text Markdown (should not be modified by the converter)
- [ ] four spaces can turn into code (but not always?)
- [ ] only convert formatting instructions from XAML formatting
- [ ] Note to user: not everything converts nicely OPTIONAL

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

- [ ] move Progress UI to right side above log and display in both modes
- [ ] Move to better-sqlite3 Throughout Core Package docs/migrate-to-better-sqlite.md
- [ ] Implement improvements, refactoring from Electron App Evaluation, see EVALUATION.md

## APP-SPECIFIC FEATURES

### For LibreOffice

- [ ] Paste Markdown from Typora and MarkText (same result)
- [ ] Export to Word .docx from Typora

### For Obsidian 

- [ ] view all notes from one notebook in one document, similar to the notes exporter
  - [ ] Verse references
  - [ ] Book references 
  - [ ] Note text
  - [ ] —- divider
  - [ ] optionally exclude highlights
  - [ ] Use README.md index files for that
- [ ] Obsidian plugins could show verses on hover. Many recognize Bible references and can also link to a Bible for example
- [ ] Note names are unique and could be linked to with Wikilinks from other notes in Obsidian (TEST)

#### Completed Obsidian Features

- [x] view formatted notes one by one

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