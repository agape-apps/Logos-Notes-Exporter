### Transformation Logic       

| XAML Feature                      | Transformation Logic                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `<Paragraph>`                     | → `<p>` in HTML or double newlines in Markdown                                        |
| `<Run>`                           | → inline text; apply styles like `<strong>`, `*italic*`, etc.                         |
| `Run[@FontBold]`                  | → `<strong>` in HTML, in Markdown use `**...**`                                       |
| `Run[@FontItalic]`                | → `<em>` in HTML, in Markdown use `*...*`                                             |
| `Run[@HasUnderline]`              | → `<u>` in HTML, in Markdown use `<u>`                                                |
| `Run[@HasStrikethrough]`          | → `<del>` in HTML, in Markdown use `~~...~~`                                          |
| `List[@Kind='Disc']`              | → `<ul>` in HTML, in Markdown use `-`                                                 |
| `List[@Kind='Decimal']`           | → `<ol>` in HTML, in Markdown use `1.`                                                |
| `UriLink[@Uri]`                   | → `<a href="...">text</a>` or `[text](url)`                                           |
| `Run[@FontCapitals='SmallCaps']`  | → CSS `font-variant: small-caps;` in HTML (not supported in Markdown - ignore)        |
| `Run[@FontVariant='Subscript']`   | → `<sub>` in HTML (Subcript~123~ in Markdown)                                         |
| `Run[@FontVariant='Superscript']` | → `<sup>` in HTML (Superscript^123^ in Markdown)                                      |
| `Run[@BackgroundColor]`           | → `<span style="background-color:...">...</span>` in HTML, in Markdown use `==highlight==` |



---

### Supported XAML Features in the Converter
Here's the table from docs/XAML conversion.md with an added column for the current status in the code:
| **XAML Feature** | **Transformation Logic (from Docs)** | **Status in Converter** | **Notes/Details** |
|---|---|---|---|
| <Paragraph> | → <p> in HTML or double newlines in Markdown | **Supported** | Processed in processParagraph. Adds double newlines for regular paragraphs or converts to Markdown headings (#, ##, etc.) based on font sizes from Run elements inside it (using getHeadingLevelFromParagraph). Empty paragraphs add a single newline. |
| <Run> | → inline text; apply styles like <strong>, *italic*, etc. | **Supported** | Processed in processRun. Extracts text from @_Text or #text, then applies inline formatting via applyInlineFormatting (e.g., bold, italic, etc.). |
| Run[@FontBold] | → <strong> in HTML, in Markdown use **...** | **Supported** | Checked in applyInlineFormatting using @_FontBold="true". Wraps text in **bold**. (Note: Code uses @_FontBold, not standard XAML @_FontWeight="Bold".) |
| Run[@FontItalic] | → <em> in HTML, in Markdown use *...* | **Supported** | Checked in applyInlineFormatting using @_FontItalic="true". Wraps text in *italic*. |
| Run[@HasUnderline] | → <u> in HTML, in Markdown use <u> | **Supported** | Checked in applyInlineFormatting using @_HasUnderline="true". Wraps text in <u>underline</u> (HTML fallback, as Markdown doesn't have native underline). |
| Run[@HasStrikethrough] | → <del> in HTML, in Markdown use ~~...~~ | **Supported** | Checked in applyInlineFormatting using @_HasStrikethrough="true". Wraps text in ~~strikethrough~~. |
| List[@Kind='Disc'] | → <ul> in HTML, in Markdown use - | **Supported** | Processed in processList and processListItems. Uses - for unordered lists if @_Kind="Disc". |
| List[@Kind='Decimal'] | → <ol> in HTML, in Markdown use 1. | **Supported** | Processed in processList and processListItems. Uses numbered markers (1., 2., etc.) for ordered lists if @_Kind="Decimal". |
| UriLink[@Uri] | → <a href="...">text</a> or [text](url) | **Supported** | Processed in processHyperlink. Creates Markdown links like [text](url) using @_NavigateUri for the URL. |
| Run[@FontCapitals='SmallCaps'] | → CSS font-variant: small-caps; in HTML (not supported in Markdown - ignore) | **Supported** (with fallback) | Checked in applyInlineFormatting using @_FontCapitals="smallcaps". Converts to <small>UPPERCASE</small> (HTML fallback; no native Markdown support). |
| Run[@FontVariant='Subscript'] | → <sub> in HTML (Subcript~123~ in Markdown) | **Supported** | Checked in applyInlineFormatting using @_FontVariant="subscript". Wraps in <sub>text</sub> (HTML fallback). |
| Run[@FontVariant='Superscript'] | → <sup> in HTML (Superscript^123^ in Markdown) | **Supported** | Checked in applyInlineFormatting using @_FontVariant="superscript". Wraps in <sup>text</sup> (HTML fallback). |
| Run[@BackgroundColor] | → <span style="background-color:...">...</span> in HTML, in Markdown use ==highlight== | **Not Supported** | The attribute @_BackgroundColor is defined in the XamlElement interface, but it's not used in applyInlineFormatting or elsewhere. No highlighting is applied (text remains plain). This could be added easily. |
### Summary of Support Level
* **Fully Supported**: 12 out of 13 features (all except background color).
* **Partially Supported**: None (small caps, sub/superscript use HTML fallbacks, but that's as per the docs).
* **Not Supported**: 1 (background color highlighting).
* **Additional Notes**:
* The converter also supports inline code detection via monospace fonts (e.g., @_FontFamily="Courier New" → `` code ``).
* Headings are determined by font sizes in Runs (e.g., 24pt → # H1), matching the headingSizes option.
* Combined formatting (e.g., bold + underline) works by nesting the markup in the correct order.
* The converter uses preserveOrder: true in the XMLParser to maintain document order (e.g., for lists).
* If a feature isn't supported (like background color), the text is still extracted as plain text (fallback in extractPlainText).
