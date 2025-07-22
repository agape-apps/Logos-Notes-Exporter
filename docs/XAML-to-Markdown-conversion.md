# AxDa.XamlDocConverter.Markdown 1.0.5
[AxDa.XamlDocConverter.Markdown 1.0.5](https://www.nuget.org/packages/AxDa.XamlDocConverter.Markdown#readme-body-tab)

Converts WPF flow document content from XAML format to Markdown and vice versa.

## WPF Flow Document Markdown Converter

WPF Flow Document Markdown Converter provides high-performance, low-allocating conversion from WPF flow document content to Markdown and vice versa. It's extensible and easy to use.

Easily convert WPF flow document text content specified by a Microsoft WPF TextRange object or a XAML stream to the Markdown language format, and vice versa.

WPF Flow Document Markdown Converter uses .NET capabilities. It provides powerful conversion options and empowers developers to use the Markdown text format in WPF applications.

### MarkdownXamlDocConverter overview

WPF Flow Document Markdown Converter provides extensive conversion capabilities for serializing Microsoft [WPF flow document content](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/advanced/flow-document-overview) content to Markdown, and vice versa.

Following is a simple example, converting Markdown text to WPF flow document content:

```
using System.IO;

using AxDa.XamlDocConverter.Markdown;

// prepare Markdown input ...

string markdown =
@"# This is a heading

|Column 1|Column 2|
|-|-|
|Value 1|Value 2|";

using MemoryStream markdownStream = new MemoryStream()
using MemoryStream xamlStream = new MemoryStream();

StreamWriter mdWriter = new StreamWriter(markdownStream);
mdWriter.Write(markdown);
mdWriter.Flush();
markdownStream.Position = 0L;

// convert Markdown to XAML ...

new MarkdownXamlDocConverter().MarkdownToXaml(markdownStream, xamlStream);

// output XAML ...

StreamReader xamlReader = new StreamReader(xamlStream);
xamlStream.Position = 0L;
string xaml = xamlReader.ReadToEnd();
```

The above code assigns the following result to the `xaml` string variable:

```
<?xml version="1.0" encoding="UTF-8"?>
<Section xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Paragraph FontSize="24">
    <Run>This is a heading</Run>
  </Paragraph>
  <Table>
    <TableRowGroup>
      <TableRow FontWeight="Bold">
        <TableCell>
          <Paragraph>
            <Run>Column 1</Run>
          </Paragraph>
        </TableCell>
        <TableCell>
          <Paragraph>
            <Run>Column 2</Run>
          </Paragraph>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell>
          <Paragraph>
            <Run>Value 1</Run>
          </Paragraph>
        </TableCell>
        <TableCell>
          <Paragraph>
            <Run>Value 2</Run>
          </Paragraph>
        </TableCell>
      </TableRow>
    </TableRowGroup>
  </Table>
</Section>
```

### How to Use

Converting WPF Flow Document content to Markdown content, or vice versa, is easy:

In a WPF application, convert WPF document content to Markdown by retrieving the [`TextRange`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.textrange) object from a [Flow Document](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.flowdocument) control and pass it to the `MarkdownXamlDocConverter.XamlToMarkdown()` method, along with a destination [`Stream`](https://learn.microsoft.com/en-us/dotnet/api/system.io.stream) to receive the converted Markdown content.

Conversely, to populate a WPF Flow Document control with rendered Markdown content, provide the `MarkdownXamlDocConverter.MarkdownToXaml()` method with a source [`Stream`](https://learn.microsoft.com/en-us/dotnet/api/system.io.stream) containing Markdown source code and the [`TextRange`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.textrange) object from a [Flow Document](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.flowdocument) control to be populated.

Instead of a [`TextRange`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.textrange) object, you can alternatively use a XAML stream, for example, from [`TextRange.Save()`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.textrange.save).

### Mapping Markdown to WPF Flow Documents

The [WPF flow document](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/advanced/flow-document-overview) feature is designed to optimize text viewing and readability. Rather than being set to one predefined layout, flow documents dynamically adjust and reflow their content based on run-time variables such as window size, device resolution, and optional user preferences.

However, WPF Flow Documents do not support some features common to Markdown. For example, heading, horizontal rule or quote block classes are missing from the [`System.Windows.Documents`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents) namespace. On the other hand, Markdown does not support any of the fancy styling techniques provided by WPF. So, there is a gap between these two content description formats.

To be able to convert these elements from Markdown to WPF XAML, and vice versa, the `MarkdownXamlDocConverter` class assumes a set of conventions for identifying XAML flow document elements as heading, horizontal rule, quotation block or code.

#### Heading

A [`Paragraph`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.paragraph) element is identified as a heading element if the following conditions are met:

1. The font size matches one of the font sizes defined in the `HeadingSizes` array property in `XamlDocConverterOptions`.

⠀
##### Example

Assuming that the font size array in `XamlDocConverterOptions.HeadingSizes` is equal to `[24, 20, 18, 16, 15, 14, 13]`, then

```
<Paragraph FontSize="24">
  <Run>This is heading level 1</Run>
</Paragraph>
<Paragraph FontSize="20">
  <Run>This is heading level 2</Run>
</Paragraph>
<Paragraph FontSize="18">
  <Run>This is heading level 3</Run>
</Paragraph>
<Paragraph FontSize="16">
  <Run>This is heading level 4</Run>
</Paragraph>
```

is converted to

```
# This is heading level 1
## This is heading level 2
### This is heading level 3
#### This is heading level 4
```

On the other hand, to have a paragraph with a specific font size not being recognized as a heading, set the paragraph's font size to any value other than the values defined in `MarkdownXamlDocConverterOptions.HeadingSizes`.

##### Example

```
<Paragraph FontSize="24.001">
  <Run>This is not a heading</Run>
</Paragraph>
```

is converted to

```
This is not a heading
```

Please note that Markdown will then ignore the font size and treat the paragraph as a normal paragraph.

#### Horizontal Rule

A [`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) element is identified as a horizontal rule element if the following conditions are met:

1. It contains no child element
2. It contains no text
3. It has a top border – and only a border at the top – defined with the [`BorderBrush`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.block.borderbrush) and [`BorderThickness`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.block.borderthickness) properties set
4. The thickness of the top border corresponds to the `HorizontalLineThickness` property defined in `MarkdownXamlDocConverterOptions`. All other border thickness values must be `0`.

⠀
##### Example

```
<Section BorderThickness="0, 3, 0 ,0" BorderBrush="Silver"></Section>
```

is converted to

```
---
```

#### Quote Block

A [`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) element is identified as a quote block element if the following conditions are met:

1. It has a left border – and only a border on the left side – defined with the [`BorderBrush`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.block.borderbrush) and [`BorderThickness`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.block.borderthickness) properties set
2. The left border thickness corresponds to the `BlockQuoteLineThickness` property defined in `MarkdownXamlDocConverterOptions`. All other border thickness values must be `0`.

⠀
##### Example

```
<Section BorderThickness="3, 0, 0 ,0" BorderBrush="Silver">
  <Paragraph>
    <Run>“This is the truth”.</Run>
  </Paragraph>
</Section>
```

is converted to

```
> “This is the truth”.
```

#### Code Block

A [`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) element is identified as a code block element if the following conditions are met:

1. It is assigned a font family name that matches the font family name defined in the `MonospaceFontName` property of the `MarkdownXamlDocConverterOptions` object.
2. Optionally, a computer language acronym has been assigned to the `Tag` attribute.

⠀
##### Example

```
<Section FontFamily="Courier New" xml:space="preserve" Tag="c#">
  <Paragraph>
    <Run><![CDATA[int = 1;

return i;]]></Run>
  </Paragraph>
</Section>
```

is converted to

```
```c#
int = 1;

return i;
```
```

The computer language acronym is mapped to the resulting Markdown code block tag, and vice versa. This enables code syntax highlighters to recognize and colorize the corresponding section appropriately.

#### Inline Code

A [`Run`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.run) or [`Span`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.span) element is identified as an inline code element if the following conditions are met:

1. It is assigned a font family name that matches the font family name defined in the `MonospaceFontName` property of the `MarkdownXamlDocConverterOptions` object.

⠀
##### Example

```
<Paragraph>
  <Run>The value is </Run>
  <Run FontFamily="Courier New" xml:space="preserve">true</Run>
  <Run>.</Run>
</Paragraph>
```

is converted to

```
The value is `true`.
```

#### Task Item

Currently, converting Markdown task items to XAML, and vice versa, is not supported in the `AxDa.MarkdownXamlDocConverter` package.

However, a Markdown task item marker is compiled into a separate [`Run`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.run) element when converting to XAML. So, you can easily identify Markdown task items in XAML and add your own logic to them.

##### Example

```
- [ ] a
- [X] b
- [~] c
```

is converted to

```
<List MarkerStyle="Disc">
  <ListItem>
    <Paragraph>
        <Run>[ ] </Run>
        <Run>a</Run>
    </Paragraph>
  </ListItem>
  <ListItem>
    <Paragraph>
        <Run>[X] </Run>
        <Run>b</Run>
    </Paragraph>
  </ListItem>
  <ListItem>
    <Paragraph>
        <Run>[~] </Run>
        <Run>c</Run>
    </Paragraph>
  </ListItem>
</List>
```

### Create Your Own Converter Add-in

One advantage of the WPF Flow Document Markdown Converter is its easy extensibility. For example, you can add syntax highlighting add-ins to the converted result.

To create your own extension, use one of the `MarkdownXamlDocConverter.XamlToMarkdown()` overloads that return a [`MarkdownDocument`](https://www.nuget.org/packages/AxDa.Markdown/), or one of the `MarkdownXamlDocConverter.MarkdownToXaml()` overloads that return an [`XDocument`](https://learn.microsoft.com/en-us/dotnet/standard/linq/). Navigate through the object tree and customize it to your needs. Then serialize the result and pass it to a WPF XAML [`TextRange`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.textrange) object obtained from one of the WPF Flow Document controls.

## Implementation Details

### Markdown to XAML Flow Document Element Mapping

As explained above, XAML and Markdown serve are similar purpose but do not share the same syntax nor semantics. Markdown, for example, recognizes headings while XAML flow documents do not.

To ensure acceptable yet comprehensive conversion, the `MarkdownXamlDocConverter` class makes some style assumptions for element mapping.

The following table provides some technical details about these features:

<dl> <dt>Headings</dt> <dd><br/>

A Markdown heading is mapped to a [`Paragraph`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.paragraph) object with a `FontSize` attribute that matches one of the values in the `MarkdownXamlDocConverterOptions.HeadingSizes` array, and vice versa.

For example,

* `MarkdownXamlDocConverterOptions.HeadingSizes[0]` matches `#`
* …
* `MarkdownXamlDocConverterOptions.HeadingSizes[3]` matches `####`
The font size value must match exactly when converting from XAML to Markdown. If you want to use a [`Paragraph`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.paragraph) font size for decoration purposes but not for designating a heading, add a small fraction to either the corresponding [`Paragraph`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.paragraph) object's `FontSize` attribute or change the corresponding `MarkdownXamlDocConverterOptions.HeadingSizes` value. Then they won't be equal anymore and the corresponding [`Paragraph`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.paragraph) object won't be interpreted as a heading.</dd>

<dt>Block Quote</dt> <dd><br/>

A Markdown block quote is mapped to a [`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) object with `BorderBrush` attribute set to an arbitrary value and *left* border thickness equals the `MarkdownXamlDocConverterOptions.BlockQuoteLineThickness` property value while all other border thicknesses are equal to `0`.

**Example:**

```
<Section BorderBrush="Silver" BorderThickness="3,0,0,0">
```

[`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) `BorderBrush` property value is taken from `MarkdownXamlDocConverterOptions.BlockQuoteLineColor` when converting from Markdown to XAML.

When converting from XAML to Markdown, the actual color value is ignored, yet the `BorderBrush` attribute must be present for the section being recognized as a block quote.

The [`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) `BorderThickness` property value must match exactly when converting from XAML to Markdown. If you want to use a border for decoration purposes but not for designating a block quote, add a small fraction to either any value of the corresponding [`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) object's `BorderThickness` attribute or change the `MarkdownXamlDocConverterOptions.BlockQuoteLineThickness` value. Then they won't be equal anymore and the corresponding [`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) object won't be interpreted as a block quote.</dd>

<dt>Horizontal Rule</dt> <dd><br/>

A Markdown horizontal rule is mapped to a [`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) object that does not contain content, the `BorderBrush` attribute is set to an arbitrary value and *top* border thickness equals the `MarkdownXamlDocConverterOptions.HorizontalLineThickness` property value while all other border thicknesses are equal to `0`.

**Example:**

```
<Section BorderBrush="Silver" BorderThickness="0,3,0,0"/>
```

[`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) `BorderBrush` property value is taken from `MarkdownXamlDocConverterOptions.HorizontalLineColor` when converting from Markdown to XAML.

When converting from XAML to Markdown, the actual color value is ignored, yet the `BorderBrush` attribute must be present for the section being recognized as a horizontal rule.

The [`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) `BorderThickness` property value must match exactly when converting from XAML to Markdown. If you want to use a border for decoration purposes but not for designating a horizontal rule, add a small fraction to either any value of the corresponding [`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) object's `BorderThickness` attribute or change the `MarkdownXamlDocConverterOptions.HorizontalLineThickness` value. Then they won't be equal anymore and the corresponding [`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) object won't be interpreted as a horizontal rule.</dd>

<dt>Code Block</dt> <dd><br/>

A Markdown code block is mapped to a [`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) object with a `FontFamily` attribute set to a font matching `Options.MonospaceFontName`.

When converting from XAML to Markdown, the font family name must match exactly the font name from the `Options.MonospaceFontName` property. Otherwise, the [`Section`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.section) will not be interpreted as a code block.</dd>

<dt>Inline Code</dt> <dd><br/>

Markdown inline code is mapped to a [`Run`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.run) or [`Span`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.span) object with a `FontFamily` attribute set to a font matching `Options.MonospaceFontName`.

When converting from XAML to Markdown, the font family name must match exactly the font name from the `Options.MonospaceFontName` property. Otherwise, the [`Run`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.run) or [`Span`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.span) will not be interpreted as inline code.</dd> </dl>

### Ordered and Unorderer List Mappings

Lists are recognized and will correctly be mapped.

### Table Mappings

Tables are recognized and will correctly be mapped. Horizontal column text alignments are respected.

WPF Flow Document Markdown Converter efficiently maps WPF XAML elements and attributes to Markdown elements, and vice versa.

WPF Flow Document Markdown Converter is text based. XAML Styles and resources will be ignored and property/style inheritance will not be recognized. (See [Known Issues](https://www.nuget.org/packages/AxDa.XamlDocConverter.Markdown#known-issues) below).

The set of WPF flow document text element properties and Markdown isn't congruent. While WPF XAML offers a plethora of styling options, Markdown does not. So, by the inherent differences between these two languages, it is impossible to convert a WPF flow document into Markdown and vice versa without a certain amount of divergence in appearance.

### Options

WPF Flow Document Markdown Converter provides a rich set of conversion options. You can configure conversion details using the following `MarkdownXamlDocConverterOptions` properties:

<dl> <dt>HeadingSizes</dt> <dd>

Collection of XAML font sizes used to recognize a [`Paragraph`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.paragraph) element for being interpreted as the corresponding heading level in the target format.

The default values are: `[24, 20, 18, 16, 15, 14, 13]`.</dd>

<dt>MonospaceFontName</dt> <dd>

Font name used to recognize [`Paragraph`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.paragraph), [`Run`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.run) or [`Span`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.span) elements as being interpreted as code elements in the target format.

The default font family name is "`Courier New`".</dd>

<dt>BlockQuoteLineThickness</dt> <dd>

Left side border thickness used for recognizing a block quote.

The default value is `3`.</dd>

<dt>BlockQuoteLineColor</dt> <dd>

Left border [`Color`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.media.color) used for displaying a block quote.

The default value is [`Colors.Silver`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.media.colors.silver).</dd>

<dt>HorizontalLineThickness</dt> <dd>

Top border thickness used for recognizing a horizontal rule.

The default value is `3`.</dd>

<dt>HorizontalLineColor</dt> <dd>

Top border [`Color`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.media.color) used for displaying a horizontal rule.

The default value is [`Colors.Silver`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.media.colors.silver).</dd>

<dt>MaxFrontMatterLength</dt> <dd>

The maximum [`string`](https://learn.microsoft.com/en-us/dotnet/api/system.string) length allowed for the Markdown [FrontMatter](https://docs.github.com/en/contributing/writing-for-github-docs/using-yaml-frontmatter) text property.

This property is a safety precaution to keep invalid content from being assigned to a Markdown FrontMatter header.

The default value is `4,096` characters. </dd>

<dt>IgnoreUnknownElements</dt> <dd>

If `true`, unknown XAML elements and Markdown tokens in the source document are ignored.

The default value is `false`. Unknown XAML elements and Markdown tokens will throw [NotImplementedException](https://learn.microsoft.com/en-us/dotnet/api/system.notimplementedexception).</dd>

<dt>FontStylesAsElements</dt> <dd>

If `true`, font variants, like *bold* or *italics* will be rendered as dedicated XAML elements when converting from Markdown to WPF XAML.

If `false`, these font variants will be added as XAML font attributes to an existing [`Run`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.run) element when converting from Markdown to WPF XAML. No additional elements will be generated.

The default value is `false`.</dd>

<dt>TableHeaderFontWeight</dt> <dd>

Determines the font weight used for content recognized as table header when converting from Markdown to WPF XAML.

The default value is [`FontWeights.Bold`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.fontweights.bold).</dd>

<dt>EnforceWSPreserve</dt> <dd>

Enables or disables a conversion option that adds the XML attribute `xml:space=preserve` to the root element of an input document and to the root element of the generated XAML output document.

The default value is `true`.

A peculiarity of the WPF parser requires the `xml:space=preserve` XML attribute in the root element. If this attribute is not present in the XML root element, the WPF renderer may not display words with the expected word break.

However, this requirement typically results in the resulting XML being output as a single, long line. For troubleshooting purposes, you can set this property to `false`. The resulting XML will then be output with normal indentation. However, the result will not be WPF-compatible if this property is set to `false`.</dd> </dl>

## Known Issues

The current implementation of the Microsoft [`TextRange`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.textrange) class (.NET ⇐ v10.0) does not allow for navigating through its child content (See WPF issue [#10095](https://github.com/dotnet/wpf/issues/10095)). So, internally WPF Flow Document Markdown Converter saves the [`TextRange`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.textrange) content to a XAML stream using [`TextRange.Save()`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.textrange.save) and the resulting XAML is taken as source for conversion. The [`TextRange.Save()`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.textrange.save) method, however, does not save [`BlockUIContainer`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.documents.blockuicontainer) content. Thus, conversion is restricted to be text-only because image content cannot be gathered.

### Feedback, Sponsorship and Contact

You may reach me on [axeldahmen.de](http://axeldahmen.de/) or [LinkedIn](https://www.linkedin.com/in/axel-dahmen)

- Minor improvement.

