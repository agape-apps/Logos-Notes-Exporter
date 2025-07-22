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

## Common Rich Text Features in Logos Notes

|                **Feature Category**                |                 **Examples / Description**                  |       **Supported in Logos Notes**        | **Markdown Support**                             |
| :------------------------------------------------: | :---------------------------------------------------------: | :---------------------------------------: | ------------------------------------------------ |
|          **Bold, Italic, Strikethrough**           |                    Available on Toolbar                     |                    Yes                    | Yes                                              |
|                   **Underline**                    |                    Available on Toolbar                     |                    Yes                    | Yes, via HTML <u>                                |
|             **Superscript/Subscript**              |           For footnotes, chemical formulas, etc.            |                    Yes                    | Yes, via extensions                              |
|                   **Small Caps**                   |                Special typographical effects                |                    Yes                    | No, uses CAPS instead                              |
|                   **Font Color**                   |                    32 Foreground Colors                     |                    Yes                    | No                                               |
| **Text Highlights<br>Background Colors / Shading** |                    Highlight behind text                    |           Yes, different colors           | Yes, via highlights (one color)                  |
|                     **Fonts**                      |                 Choosing among named fonts                  |                    Yes                    | No                                               |
|                   **Font Sizes**                   |                Custom sizes from 8 to 36 pt                 |                    Yes                    | Yes, via Headings and <small>                    |
|                    **Headings**                    |        Multiple heading levels with adjustable size         |            Yes, via font sizes            | Yes, H1 to H6                                    |
|                 **Text Alignment**                 |                Left, Center, Right, Justify                 |                    Yes                    | No                                               |
|                 **Text Direction**                 |         Right-to-left (RTL) for different languages         |                 Untested                  | Untested                                         |
|              **Line Spacing Control**              |                    1.0, 1.5, 2.0 spacing                    |                    No                     | No                                               |
|                    **Indents**                     |                     For text and lists                      |                    Yes                    | Yes for lists, simulate for text via blockquotes |
|                  **Blockquotes**                   |                          Available                          |         No, simulate via indents          | Yes                                              |
|            **Bulleted/Numbered Lists**             |                    Available via toolbar                    |                    Yes                    | Yes                                              |
|                  **Nested Lists**                  | Properly indented multiple levels of bullet/numbered lists  |                    Yes                    | Yes                                              |
|                     **Tables**                     |  Tabular data, columns/rows, HTML <table>, Markdown tables  |                    No                     | Yes                                              |
|                   **Hyperlinks**                   | Can link to Bible verses, Logos resources, or external URLs |                    Yes                    | Yes                                              |
|               **Anchors/References**               |              Locations within Bibles or books               |                    Yes                    | Yes for Bibles, limited for books                |
|                     **Images**                     |             Inserted via drag/drop or clipboard             | Yes, No resizing or captions; inline only | Yes, No resizing or captions; inline only        |
|             **Advanced Image Layout**              |        Image alignment (left/right/inline), captions        |                    No                     | No                                               |
|              **Inline Greek/Hebrew**               |              Supports Unicode Greek and Hebrew              |                Yes, UTF-8                 | Yes, UTF-8                                       |
|            **Code Blocks / Monospaced**            |    Inline or block-formatted code using monospace fonts     |                  Limited                  | Yes, using code markers                          |
|              **Syntax Highlighting**               |  For Bible languages, programming, or other formal markup   |                    No                     | Yes, in code blocks                              |
|                **Horizontal Rules**                |            Dividers to separate content visually            |                    No                     | Yes                                              |
|              **Footnotes / Endnotes**              |             Inline footnotes or linked endnotes             |                    No                     | Limited                                          |
|              **Custom CSS / Themes**               |                  Styling per user or theme                  |                    No                     | Yes, depending on application                    |

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
