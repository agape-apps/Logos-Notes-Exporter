# Logos Notes Exporter

A CLI tool and desktop app that converts Logos Bible Notes to Markdown files with YAML front-matter, organized by notebooks.

## 🔍 Overview

**Note: this is Beta Software which has only received limited testing.**

This tool extracts notes from Logos Bible Software's NotesTool database and converts them into well-organized Markdown files. It preserves:

- **Note content** (rich text converted to Markdown)
- **Bible references** (decoded and formatted)
- **Notebook organization** (maintains Logos Notebook folder structure)
- **Metadata** (creation dates, note types, etc.)
- **YAML frontmatter** (for compatibility with note-taking apps)

## ✨ Features

- **📚 Notebook Organization**: Notes are organized by their original Logos notebooks
- **🔗 Bible References**: Automatically decodes and formats Bible references
- **📝 Rich Text**: Rich Text formatting is converted to equivalent Markdown formatting
- **Ⓜ️ Markdown Passthrough**: Logos Notes can also use Markdown which will be passed through 
- **🧭 Metadata**: Includes YAML frontmatter with comprehensive note information
- **📷 Images**: Images are downloaded and saved in an images folder alongside the notes
- **🎨 Multiple Note Types**: Supports text notes and highlights
- **📁 Flexible Output**: Customizable directory structure and file organization
- **🔍 Dry Run Mode**: Preview what will be exported before writing files
- **📊 Statistics**: Detailed export statistics and progress reporting
- **🧹 Text Sanitization**: Cleans Rich Text content and removes problematic Unicode characters
- **🔒 Read-only**: Safely opens Logos user databases in read-only mode, does not modify them

## Intended Use Cases

- Use created Notebook folders in Obsidian, Typora or in other front-matter compatible Markdown applications
- Use as a vendor independent backup of your personal notes and highlights

## 🛠 Installation & Usage

- See detailed instructions in [[README-CLI.md]]

## 🚨 Limitations

- **SQLite dependency**: Requires access to the NotesTool SQLite database
- **Version compatibility**: Tested with recent Logos 10 desktop versions
- **Apocrypha**: May not include all available book names. Only tested with Apocrypha book names as used by NSRV
- **Rich text**: Complex formatting may not convert fully from XAML to Markdown (see Common Rich Text Features in Logos Notes)
  - Indents are converted to multilevel block quotes (or a non-breaking space followed by 4 spaces for each level) up to the 6th level
  - For Highlights the verse range is shown for Bibles, highlights in books lack a specific reference

## OS & Software Versions

- Logos 10 (Logos Bible Study 43.0.377)
- macOS Sequoia 15.5
- Windows 10 version 22H2

## 📜 License

This project is licensed under the GNU AFFERO GENERAL PUBLIC LICENSE Version 3 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Logos Bible Software for creating an excellent study platform

## 📞 Support

- **Issues & Feature Requests**: [GitHub Issues](https://github.com/agape-apps/LogosNotesExport/issues)
- **Documentation**: See the `/docs` folder for detailed documentation

## Notice: Independent Software

This application is developed independently and has no affiliation with Faithlife Corporation or their Logos Bible Software product. This software is not officially supported or endorsed by Faithlife.

---

**Made with ❤️ for the Bible study community**
