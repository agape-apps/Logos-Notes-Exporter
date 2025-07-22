# NotesTool Database Analysis

**Generated:** January 8, 2025  
**Database:** `LogosDocuments/NotesToolManager/notestool.db`  
**Size:** 2.9MB

## Summary

The NotesTool database stores Logos Bible Software notes and annotations. Analysis shows:

- **2,048 total notes** (1,955 active notes)
- **1,964 active notes** (84 deleted/trashed)
- **1,726 notes with Bible references** (84.2% of active notes)
- **343 notes with rich text content** (17.5% of active notes) 
- **1,652 highlights** vs **312 text notes**
- **Date range:** 2011-01-11 to 2025-07-09 (14+ years of data)

This is a complete, self-contained notes database that can be converted independently.

## Database Statistics

### Core Content Metrics
| Metric | Count | Percentage |
|--------|-------|------------|
| Total Notes | 2,048 | 100% |
| Active Notes | 1,964 | 95.9% |
| Deleted Notes | 1 | 0.05% |
| Trashed Notes | 83 | 4.05% |
| Notes with Bible References | 1,726 | 84.2% |
| Notes with Rich Text Content | 343 | 17.5% |
| Highlight Notes | 1,652 | 84.1% |
| Text Notes | 312 | 15.9% |

### Reference & Organization
| Component | Count | Purpose |
|-----------|-------|---------|
| Bible References | 1,745 | Scripture anchoring |
| Text Range Anchors | 1,917 | Precise text positioning |
| Notebooks | 73 | Note organization |
| Note Styles | 26 | Visual formatting |
| Note Colors | 13 | Color coding |
| Data Types | 9 | Bible version types |

## Complete Table Analysis

### PRIMARY TABLES

#### 1. Notes Table
```sql
CREATE TABLE Notes (
    NoteId INTEGER PRIMARY KEY AUTOINCREMENT,
    ExternalId TEXT NOT NULL,                    -- Global unique identifier
    RevisionToken TEXT,                          -- Sync revision tracking
    ImportId TEXT,                               -- Import operation ID
    CreatedDate TEXT NOT NULL,                   -- ISO 8601 creation timestamp
    ModifiedDate TEXT,                           -- ISO 8601 modification timestamp
    CreatedBy TEXT,                              -- Creator identifier
    ModifiedBy TEXT,                             -- Last modifier identifier
    IsDeleted BOOL NOT NULL DEFAULT 0,           -- Deletion flag
    IsTrashed BOOL NOT NULL DEFAULT 0,           -- Trash flag
    IsSyncing BOOL NOT NULL DEFAULT 0,           -- Sync status
    Kind INT NOT NULL,                           -- Note type (0=Text, 1=Highlight)
    ContentRichText TEXT,                        -- 🔥 XAML CONTENT
    FoldedContent TEXT,                          -- Collapsed content preview
    NoteIndicatorId INT,                         -- Visual indicator type
    NoteColorId INT,                             -- Color reference
    NoteStyleId INT,                             -- Style reference
    AnchorsJson TEXT,                            -- JSON anchor definitions
    AnchorDataTypeId INT,                        -- Bible version type
    AnchorLanguageId INT,                        -- Language reference
    AnchorResourceIdId INT,                      -- Resource reference
    AnchorBibleBook INT,                         -- 🔥 BIBLE BOOK NUMBER
    AnchorWorkflowTemplateIdId INT,              -- Workflow template
    AnchorWorkflowKeyId INT,                     -- Workflow key
    AnchorGuideSectionId INT,                    -- Guide section
    AnchorInputIdId INT,                         -- Input reference
    TagsJson TEXT,                               -- JSON tag data
    NotebookExternalId TEXT NOT NULL,            -- Parent notebook
    Rank INTEGER NOT NULL DEFAULT 0,             -- Sort order
    Indent INT NOT NULL DEFAULT 0,               -- Hierarchy level
    LabelsJson TEXT,                             -- JSON label data
    ClippingTitleRichText TEXT,                  -- Clipping title
    ClippingExcerptRichText TEXT,                -- Clipping excerpt
    Role INT NOT NULL DEFAULT 1                  -- Role/permission level
);
```

**Key Content Fields:**
- **`ContentRichText`**: Primary note content in XAML format
- **`AnchorBibleBook`**: Direct Bible book number (uses our mapping)
- **`Kind`**: 0 = Text Note, 1 = Highlight, 2+ = Other types
- **`NotebookExternalId`**: Links to notebook organization

**Critical Indexes:**
- `Notes_ExternalId_IsDeleted` - Fast external ID lookups
- `Notes_IsDeleted_IsTrashed_NotebookExternalId` - Active notes by notebook
- `Notes_CreatedDate`, `Notes_ModifiedDate` - Temporal queries
- `Notes_Kind` - Note type filtering

#### 2. NoteAnchorFacetReferences Table
```sql
CREATE TABLE NoteAnchorFacetReferences (
    NoteAnchorFacetReferenceId INTEGER PRIMARY KEY AUTOINCREMENT,
    NoteId INTEGER NOT NULL,                     -- Links to Notes.NoteId
    AnchorIndex INT NOT NULL,                    -- Multiple refs per note
    DataTypeId INT NOT NULL,                     -- Bible version type
    BibleBook INT,                               -- 🔥 BIBLE BOOK NUMBER
    SortKey BLOB NOT NULL,                       -- Binary sort key
    Reference TEXT NOT NULL                      -- 🔥 COMPLETE REFERENCE
);
```

**Purpose:** Links notes to specific Bible passages
**Reference Format:** `bible+{version}.{book}.{chapter}.{verse}(-{endverse})`
**Examples:**
- `bible+nkjv.61.24.14` = Matthew 24:14 (NKJV)
- `bible+esv.19.86.9` = Psalm 86:9 (ESV)
- `bible+nrsv.40.1.1-40.1.2` = Tobit 1:1-2 (NRSV, Apocrypha)

**Critical Index:** `NoteAnchorFacetReferences_NoteId`

#### 3. Notebooks Table
```sql
CREATE TABLE Notebooks (
    NotebookId INTEGER PRIMARY KEY AUTOINCREMENT,
    ExternalId TEXT NOT NULL,                    -- Global unique identifier
    RevisionToken TEXT,                          -- Sync revision
    CreatedDate TEXT NOT NULL,                   -- Creation timestamp
    ModifiedDate TEXT,                           -- Modification timestamp
    CreatedBy TEXT,                              -- Creator
    ModifiedBy TEXT,                             -- Last modifier
    IsDeleted BOOL NOT NULL DEFAULT 0,           -- Deletion flag
    IsTrashed BOOL NOT NULL DEFAULT 0,           -- Trash flag
    IsSyncing BOOL NOT NULL DEFAULT 0,           -- Sync status
    Title TEXT,                                  -- 🔥 NOTEBOOK NAME
    ImportId TEXT,                               -- Import operation
    Role INT NOT NULL DEFAULT 1                  -- Role/permission
);
```

**Top Notebooks by Note Count:**
1. **Highlighter Pens** - 265 notes
2. **Solid Colors** - 116 notes  
3. **Immortality or Destruction** - 94 notes
4. **Conditional Immortality** - 64 notes
5. **Highlight** - 57 notes

### SUPPORTING TABLES

#### 4. DataTypes Table
```sql
CREATE TABLE DataTypes (
    DataTypeId INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL                           -- Bible version identifier
);
```

**Available Bible Versions:**
| ID | Version | Full Name |
|----|---------|-----------|
| 1 | bible | Generic Bible |
| 2 | bible+nkjv | New King James Version |
| 3 | bible+nrsv | New Revised Standard Version |
| 4 | bible+esv | English Standard Version |
| 5 | lemma | Original language lemmas |
| 6 | bible+nlt | New Living Translation |
| 7 | bible+schlacter2000 | Schlachter 2000 (German) |
| 8 | bible+leb2 | Lexham English Bible |
| 9 | bible+niv | New International Version |

#### 5. NoteStyles Table
```sql
CREATE TABLE NoteStyles (
    NoteStyleId INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL                           -- Style name
);
```

**Common Styles:**
- `highlight` - Standard highlighting
- `custom:GreenHighlighter`, `custom:YellowHighlighter`, `custom:OrangeHighlighter`
- `custom:DoubleUnderline`, `custom:BlueUnderline`, `custom:OrangeWavyUnderline`
- `custom:ColorBox`, `custom:Box`
- `none` - No special styling

#### 6. NoteColors Table
```sql
CREATE TABLE NoteColors (
    NoteColorId INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL                           -- Color name
);
```

**Available Colors:**
`yellow`, `violet`, `red`, `lightBlue`, `blue`, `orange`, `green`, `lightGreen`, `lightRed`, `darkGreen`, `darkYellow`, `darkBlue`, `darkPurple`

#### 7. NoteAnchorTextRanges Table
```sql
CREATE TABLE NoteAnchorTextRanges (
    NoteAnchorTextRangeId INTEGER PRIMARY KEY AUTOINCREMENT,
    ResourceIdId INT NOT NULL,                   -- Resource reference
    ResourceVersionId INTEGER NOT NULL,          -- Resource version
    Offset INT NOT NULL,                         -- Text start position
    PastEnd INT NOT NULL,                        -- Text end position
    NoteId INTEGER NOT NULL,                     -- Links to Notes
    AnchorIndex INT NOT NULL,                    -- Multiple ranges per note
    WordNumberCount INT NOT NULL DEFAULT -1,     -- Word count
    WordNumbers BLOB                             -- Binary word data
);
```

**Purpose:** Precise text selection coordinates within resources

### METADATA & SYNC TABLES

#### 8. SyncItems Table
- **7,744 rows** - Comprehensive sync tracking
- Links notes and notebooks to cloud synchronization
- Tracks revision numbers and sync states

#### 9. ResourceIds & ResourceVersions
- **52 Resource IDs** - Logos resources referenced
- **70 Resource Versions** - Version tracking
- Format: `LLS:1.0.30` (Logos Library System identifiers)

### UTILITY TABLES

| Table | Rows | Purpose |
|-------|------|---------|
| **NoteIndicators** | 5 | Visual indicators (hidden, box, exclamation, etc.) |
| **Info** | 1 | Database version (35) |
| **BibleDataTypeInfo** | 1 | Supported Bible versions list |
| **GuideSections** | 1 | Guide integration |
| **SyncProperties** | 4 | Sync configuration |

### EMPTY TABLES (Reserved for Future Use)
- `NoteTags`, `Tags` - Tagging system
- `Languages` - Multi-language support  
- `NoteAnchorHeadwords` - Original language support
- `WorkflowKeys`, `WorkflowTemplateIds` - Workflow integration
- Various sync management tables

## Critical Indexes for Performance

### High-Impact Indexes
```sql
-- Note retrieval and filtering
Notes_ExternalId_IsDeleted
Notes_IsDeleted_IsTrashed_NotebookExternalId  
Notes_Kind
Notes_CreatedDate
Notes_ModifiedDate

-- Bible reference lookups
NoteAnchorFacetReferences_NoteId

-- Text range positioning
NoteAnchorTextRanges_NoteId_ResourceIdId
NoteAnchorTextRanges_ResourceVersionId_Offset_PastEnd

-- Sync operations
SyncItems_NoteId_Kind
SyncItems_SyncState
```

### Lookup Indexes
```sql
-- Resource management
ResourceIds_ResourceId
ResourceVersions_ResourceId_Version

-- Organization
Notebooks_ExternalId_IsDeleted_IsTrashed
NoteTags_NoteId_TagId

-- Styling
NoteColors_Name
NoteStyles_Name
```

## Content Structure Analysis

### Rich Text Content Format (XAML)

Notes store content in **WPF XAML format** with the following structure:

```xml
<Paragraph>
    <Run FontSize="12" Text="Note content here"/>
</Paragraph>
<Paragraph/>
<Paragraph Margin="0,0,0,0" TextAlignment="Left">
    <Run Text="Additional content"/>
</Paragraph>
```

**Common XAML Elements:**
- `<Paragraph>` - Text blocks
- `<Run>` - Text runs with formatting
- `FontSize`, `FontFamily`, `FontItalic` - Text formatting
- `Margin`, `TextAlignment` - Layout properties
- `<Span>` - Inline text containers

**Sample Content Types:**
1. **Simple Notes:** Single paragraph with basic text
2. **Formatted Notes:** Multiple paragraphs with styling
3. **Structured Notes:** Headers, lists, emphasis
4. **Apocryphal References:** Books 40-60 (Tobit, Maccabees, etc.)

### Bible Reference Integration

Each note can link to multiple Bible passages through:

1. **Direct Book Anchor:** `Notes.AnchorBibleBook` (quick lookup)
2. **Detailed References:** `NoteAnchorFacetReferences.Reference` (complete citation)
3. **Text Positioning:** `NoteAnchorTextRanges` (exact text coordinates)

**Reference Decoding Using Our Mapping:**
- Books 1-39: Old Testament
- Books 40-60: Apocrypha/Deuterocanonical  
- Books 61-87: New Testament

## Conversion Strategy for NOTESTOOL.DB

### Phase 1: Data Extraction

#### A. Core Note Extraction
```sql
SELECT 
    n.NoteId,
    n.ExternalId,
    n.CreatedDate,
    n.ModifiedDate,
    n.Kind,
    n.ContentRichText,
    n.AnchorBibleBook,
    nb.Title as NotebookTitle,
    ns.Name as StyleName,
    nc.Name as ColorName
FROM Notes n
LEFT JOIN Notebooks nb ON n.NotebookExternalId = nb.ExternalId
LEFT JOIN NoteStyles ns ON n.NoteStyleId = ns.NoteStyleId  
LEFT JOIN NoteColors nc ON n.NoteColorId = nc.NoteColorId
WHERE n.IsDeleted = 0 AND n.IsTrashed = 0
ORDER BY n.CreatedDate;
```

#### B. Bible Reference Association
```sql
SELECT 
    r.NoteId,
    r.Reference,
    r.BibleBook,
    dt.Name as BibleVersion
FROM NoteAnchorFacetReferences r
JOIN DataTypes dt ON r.DataTypeId = dt.DataTypeId
ORDER BY r.NoteId, r.AnchorIndex;
```

#### C. Notebook Organization
```sql
SELECT 
    NotebookId,
    ExternalId,
    Title,
    CreatedDate,
    (SELECT COUNT(*) FROM Notes WHERE NotebookExternalId = nb.ExternalId 
     AND IsDeleted = 0 AND IsTrashed = 0) as NoteCount
FROM Notebooks nb
WHERE IsDeleted = 0 AND IsTrashed = 0
ORDER BY NoteCount DESC;
```

### Phase 2: Content Processing

#### A. XAML to Markdown Conversion

**Strategy:** Use existing XAML-to-Markdown converters or build custom parser

**Key Conversions:**
```xml
<!-- XAML Input -->
<Paragraph>
    <Run FontSize="14" FontWeight="Bold" Text="Heading"/>
</Paragraph>
<Paragraph>
    <Run Text="Regular text with "/>
    <Run FontItalic="True" Text="italic emphasis"/>
</Paragraph>

<!-- Markdown Output -->
## Heading

Regular text with *italic emphasis*
```

**Implementation Options:**
1. **Custom Parser:** Parse XAML elements and convert to Markdown
2. **AxDa.XamlDocConverter.Markdown:** Use existing .NET library
3. **Hybrid Approach:** Extract text content with basic formatting preservation

#### B. Bible Reference Decoding

**Reference Parser:**
```typescript
function parseLogosBibleReference(reference: string, bookMapping: BookMap) {
    // Input: "bible+nkjv.61.24.14"
    // Output: "Matthew 24:14 (NKJV)"
    
    const parts = reference.split('.');
    const version = parts[0].replace('bible+', '').toUpperCase();
    const bookNum = parseInt(parts[1]);
    const chapter = parseInt(parts[2]); 
    const verse = parts[3];
    
    const bookName = bookMapping[bookNum];
    return `${bookName} ${chapter}:${verse} (${version})`;
}
```

**Range Handling:**
```typescript
// "bible+nkjv.61.24.14-61.24.16" → "Matthew 24:14-16 (NKJV)"
// "bible+esv.19.86.9-19.87.2" → "Psalm 86:9-87:2 (ESV)"
```

### Phase 3: Output Generation

#### A. Markdown File Structure

**Individual Note Files:**
```markdown
---
id: 2048
external_id: "abc123-def456-..."
created: "2025-07-09T06:57:54Z"
modified: "2025-07-09T06:57:54Z"
notebook: "Test Notebook"
kind: "text_note"
style: "highlight"
color: "yellow"
bible_references:
  - reference: "Tobit 1:1-2 (NRSV)"
    book_number: 40
    raw_reference: "bible+nrsv.40.1.1-40.1.2"
tags: []
---

# Book of Tobit One:One-Two

This note discusses the opening verses of the Book of Tobit...

## Related Passages
- [Tobit 1:1-2 (NRSV)](bible+nrsv.40.1.1-40.1.2)
```

#### B. Export Formats

**1. Individual Markdown Files**
- One file per note
- YAML frontmatter with metadata
- Organized in folders by notebook
- Bible references as links

**2. Consolidated JSON Export**  
- Complete database export
- Preserves all relationships
- Suitable for data analysis
- Easy to import into other systems

**3. CSV Export**
- Tabular format for spreadsheet analysis
- Flattened structure
- Bible references as separate columns
- Good for reporting and statistics

**4. Obsidian Vault**
- Note files with bidirectional links
- Bible reference linking
- Tag-based organization
- Graph view of connections

### Phase 4: Implementation Plan

#### Technical Architecture
```typescript
// Core conversion pipeline
export class NotesToolConverter {
    private db: Database;
    private bookMapping: BibleBookMapping;
    private xamlConverter: XamlToMarkdownConverter;
    
    async convertAllNotes(): Promise<ConversionResult> {
        const notes = await this.extractNotes();
        const references = await this.extractReferences();
        const notebooks = await this.extractNotebooks();
        
        const converted = notes.map(note => 
            this.convertSingleNote(note, references, notebooks)
        );
        
        return this.generateOutput(converted);
    }
}
```

#### Priority Implementation Order
1. **Basic extraction** - Get all notes and metadata ✅
2. **Bible reference mapping** - Apply our book mapping ✅  
3. **XAML parsing** - Convert rich text to Markdown
4. **File generation** - Create organized output files
5. **Validation** - Verify against application data

#### Quality Assurance
- **Cross-check** with application note count (1,955)
- **Verify** Bible reference accuracy
- **Test** XAML conversion on various note types  
- **Validate** notebook organization preservation

---

## Conversion Benefits

### Single Database Approach Advantages
✅ **Complete independence** - No dependency on legacy `notes.db`  
✅ **Modern structure** - Better organized, more metadata  
✅ **Active maintenance** - Continuously updated database  
✅ **Rich references** - Complete Bible reference system  
✅ **Full timeline** - 14+ years of notes (2011-2025)  

### Expected Output
- **~1,964 note files** in Markdown format
- **~343 substantial notes** with rich content  
- **~1,726 Bible-linked notes** with accurate references
- **~73 notebook folders** for organization
- **Complete metadata** preservation in YAML frontmatter

---

## Implementation Checklist

### Prerequisites ✅
- [x] Database schema fully analyzed
- [x] Bible book mapping completed (`docs/anchor-complete-ot-nt-mapping.md`)
- [x] Content structure understood
- [x] Reference format decoded

### Development Tasks
- [ ] Build note extractor (SQL queries)
- [ ] Implement XAML-to-Markdown converter
- [ ] Create Bible reference decoder
- [ ] Design output file structure  
- [ ] Build notebook organizer
- [ ] Add metadata processor
- [ ] Create validation system
- [ ] Implement export formats

### Testing & Validation
- [ ] Verify note count matches application (1,955)
- [ ] Test Bible reference accuracy
- [ ] Validate XAML conversion quality
- [ ] Check notebook organization
- [ ] Ensure metadata completeness

---

## Conclusion

The NotesTool database represents a **complete, modern notes storage system** that can be converted independently with high fidelity. The database structure is well-designed, comprehensive, and contains all necessary information for producing high-quality Markdown exports.

**Key Success Factors:**
1. **Rich metadata** available for complete note context
2. **Structured references** using our validated Bible book mapping  
3. **XAML content** convertible to clean Markdown
4. **Organization preserved** through notebook system
5. **Timeline integrity** from 2011 to present

**Recommended Approach:** Focus on this database exclusively for the conversion project, as it provides everything needed for a comprehensive notes export system. 📚✨ 