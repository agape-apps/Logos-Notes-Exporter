# NoteAnchorFacetReferences Table Analysis
Generated: Tue Jul  8 20:02:20 PST 2025

## Table Overview

- **Total Anchor References:** 1701

## Schema
```sql
CREATE TABLE NoteAnchorFacetReferences (
					NoteAnchorFacetReferenceId integer primary key autoincrement,
					NoteId integer not null,
					AnchorIndex int not null,
					DataTypeId int not null,
					BibleBook int,
					SortKey blob not null,
					Reference text not null
				);
CREATE INDEX NoteAnchorFacetReferences_NoteId on NoteAnchorFacetReferences(NoteId);
```

## Column Information

| Column | Type | Not Null | Default | Primary Key |
|--------|------|----------|---------|-------------|
| NoteAnchorFacetReferenceId | INTEGER | 0 |  | 1 |
| NoteId | INTEGER | 1 |  | 0 |
| AnchorIndex | INT | 1 |  | 0 |
| DataTypeId | INT | 1 |  | 0 |
| BibleBook | INT | 0 |  | 0 |
| SortKey | BLOB | 1 |  | 0 |
| Reference | TEXT | 1 |  | 0 |

## Sample Reference Data

### First 10 References
```
NoteAnchorFacetReferenceId|NoteId|AnchorIndex|DataTypeId|BibleBook|SortKey|Reference
1|6|0|1|19|∞'Uêê|bible+esv.19.86.9
2|116|0|1|62|∞SBR†|bible+nkjv.62.9.42
3|120|0|1|64|∞W@—|bible+nkjv.64.3.16
4|122|0|1|66|∞[Aëp|bible+esv.66.6.23
5|127|0|1|74|∞k@Pê|bible+nkjv.74.1.9
6|130|0|1|82|∞{@ê`|bible+esv.82.2.6
7|139|0|1|87|∞ÖE|bible+nkjv.87.20.15
8|147|0|1|1|∞@êp|bible+esv.1.2.7
9|148|0|1|1|∞@ë0|bible+esv.1.2.19
10|150|0|1|18|∞%A–ê|bible+esv.18.7.9
```

## Reference Pattern Analysis

### Reference Column Patterns (first part before first dot)

| Pattern | Count |
|---------|-------|
| bible+* | 1689 |
| bible | 7 |
| lemma | 5 |

### Bible Reference Analysis

- **Total Bible References:** 1689

### Sample Bible References
```
bible+esv.19.86.9
bible+nkjv.62.9.42
bible+nkjv.64.3.16
bible+esv.66.6.23
bible+nkjv.74.1.9
bible+esv.82.2.6
bible+nkjv.87.20.15
bible+esv.1.2.7
bible+esv.1.2.19
bible+esv.18.7.9
```

### Bible Book Number Analysis

Analyzing the book numbers in bible references (format: bible+version.book.chapter.verse)

| Book Number | Count | Sample Reference |
|-------------|-------|------------------|
|  | 163 | bible+esv.1.2.7 |
| 1 | 123 | bible+esv.19.86.9 |
| 2 | 173 | bible+esv.20.15.24 |
| 3 | 13 | bible+esv.32.2.2 |
| 6 | 837 | bible+nkjv.62.9.42 |
| 7 | 179 | bible+nkjv.74.1.9 |
| 8 | 200 | bible+esv.82.2.6 |

