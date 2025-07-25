## Common Rich Text Features in Logos Notes and Markdown

- Logos uses a limited subset of Rich Text formatting.
- For Markdown most of this formatting is converrted into meaningful equivalents, while ignoring Font Color, Text Alignment and most Fonts.

| Feature Category | Examples / Description | Supported in Logos Notes | Markdown Support |
|:------------------------------------------------:|:---------------------------------------------------------:|:---------------------------------------:|------------------------------------------------|
| **Bold, Italic, Strikethrough** | Available on Toolbar | Yes | Yes |
| **Underline** | Available on Toolbar | Yes | Yes, via HTML &lt;u&gt; |
| **Superscript/Subscript** | For footnotes, chemical formulas, etc. | Yes | Yes, via extensions (two options) |
| **Small Caps** | Special typographical effects | Yes | No, uses CAPS instead |
| **Font Color** | 32 Foreground Colors | Yes | No |
| **Text Highlights, Background Colors** | Highlight behind text | Yes, different colors | Yes, via highlights (one color) |
| **Fonts** | Choosing among named fonts | Yes | No, only default and code |
| **Font Sizes** | Custom sizes from 8 to 36 pt | Yes | Yes, via Headings and &lt;small&gt; |
| **Headings** | Multiple heading levels with adjustable size | Yes, via font sizes | Yes, H1 to H6 |
| **Text Alignment** | Left, Center, Right, Justify | Yes | No |
| **Text Direction** | Right-to-left (RTL) for different languages | Untested | Untested |
| **Indents** | For text and lists | Yes | Yes for lists. Simulate for text via blockquotes (max 6 levels) |
| **Tabs** | Tabs at the beginning of a line | Yes | Converted to indents, otherwise the line is shown as code in Markdown |
| **Blockquotes** | Available | No, simulate via indent | Yes |
| **Bulleted/Numbered Lists** | Available via toolbar | Yes | Yes |
| **Nested Lists** | Properly indented multiple levels of bullet/numbered lists | Yes | Yes |
| **Tables** | Tabular data, columns/rows, HTML &lt;table&gt;, Markdown tables | No | Yes |
| **Hyperlinks** | Can link to Bible verses, Logos resources, or external URLs | Yes | Yes |
| **Anchors/References** | Locations within Bibles or books | Yes | Yes for Bibles, limited for books |
| **Images** | Inserted via drag/drop or clipboard | Yes, but no resizing | Yes, but no resizing |
| **Image Layout** | Image alignment (left/right/inline), captions | No | No |
| **Inline Greek/Hebrew** | Supports Unicode Greek and Hebrew | Yes, UTF-8 | Yes, UTF-8 |
| **Code Blocks / Monospaced** | Inline or block-formatted code using monospace fonts | Use monospace | Yes, using code markers |
| **Syntax Highlighting** | For Bible languages, programming, or other formal markup | No | Yes, in code blocks |
| **Horizontal Rules** | Dividers to separate content visually | No | Yes |
| **Footnotes / Endnotes** | Inline footnotes or linked endnotes | No | Limited |
| **Custom CSS / Themes** | Styling per user or theme | No | Yes, depending on application |