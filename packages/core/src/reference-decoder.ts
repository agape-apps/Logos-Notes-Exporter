export interface BibleBookMapping {
  anchorId: number;
  englishName: string;
  osisAbbr: string;
  chapterCount: number;
  status: string;
  logosBibleId?: string;
}

export interface DecodedReference {
  bookName: string;
  chapter?: number;
  verse?: number;
  endChapter?: number;
  endVerse?: number;
  reference: string; // Original reference
  anchorBookId: number;
  formatted: string; // Human readable format
}

export class BibleReferenceDecoder {
  private bookMappings: Map<number, BibleBookMapping> = new Map();

  constructor() {
    this.initializeBookMappings();
  }

  /**
   * Decode a Logos Bible reference string into human-readable format
   * Example input: "bible+nkjv.61.24.14" (Anchor format)
   * Example output: "1 Peter 24:14" 
   */
  public decodeReference(reference: string, anchorBookId?: number): DecodedReference | null {
    try {
      // Handle different reference formats
      if (reference.includes('bible+')) {
        return this.decodeBiblePlusReference(reference, anchorBookId);
      } else if (reference.includes('.')) {
        return this.decodeDottedReference(reference, anchorBookId);
      } else {
        return this.decodeSimpleReference(reference, anchorBookId);
      }
    } catch (error) {
      console.warn(`Failed to decode reference: ${reference}`, error);
      return null;
    }
  }

  /**
   * Get book name from anchor book ID
   */
  public getBookName(anchorBookId: number): string {
    const mapping = this.bookMappings.get(anchorBookId);
    return mapping ? mapping.englishName : `Unknown Book ${anchorBookId}`;
  }

  /**
   * Decode Logos "bible+version.book.chapter.verse" format
   */
  private decodeBiblePlusReference(reference: string, anchorBookId?: number): DecodedReference | null {
    // Pattern: bible+nkjv.61.24.14 or bible+esv.1.1.1-1.1.31
    const match = reference.match(/bible\+([^.]+)\.(\d+)\.(\d+)\.(\d+)(?:-(\d+)\.(\d+)\.(\d+))?/);
    if (!match) return null;

    const [, , bookNum, chapter, verse, , endChapter, endVerse] = match;
    const bookId = parseInt(bookNum || '0');
    const bookName = this.getBookName(anchorBookId || bookId);
    
    // Check if this is a single-chapter book
    const bookMapping = this.bookMappings.get(anchorBookId || bookId);
    const isSingleChapterBook = bookMapping?.chapterCount === 1;

    let actualChapter: number;
    let actualVerse: number | undefined;

    if (isSingleChapterBook) {
      // For single-chapter books: bible+nkjv.86.1.24 means Jude verse 24
      actualChapter = parseInt(verse || '0'); // The "verse" field is actually the verse number
      actualVerse = undefined; // No separate verse for formatting
    } else {
      // For multi-chapter books: normal chapter:verse
      actualChapter = parseInt(chapter || '0');
      actualVerse = parseInt(verse || '0');
    }

    const result: DecodedReference = {
      bookName,
      chapter: actualChapter,
      verse: actualVerse,
      reference,
      anchorBookId: anchorBookId || bookId,
      formatted: this.formatReference(bookName, actualChapter, actualVerse, 
        endChapter ? parseInt(endChapter || '0') : undefined, 
        endVerse ? parseInt(endVerse || '0') : undefined)
    };

    if (endChapter && endVerse) {
      result.endChapter = parseInt(endChapter || '0');
      result.endVerse = parseInt(endVerse || '0');
    }

    return result;
  }

  /**
   * Decode simple dotted reference format
   */
  private decodeDottedReference(reference: string, anchorBookId?: number): DecodedReference | null {
    // Pattern: 61.24.14 or 1.1.1-31
    const parts = reference.split('.');
    if (parts.length < 2) return null;

    const bookId = anchorBookId || parseInt(parts[0] || '0');
    const chapter = parseInt(parts[1] || '0');
    const verse = parts[2] ? parseInt(parts[2] || '0') : undefined;
    
    const bookName = this.getBookName(bookId);

    return {
      bookName,
      chapter,
      verse,
      reference,
      anchorBookId: bookId,
      formatted: this.formatReference(bookName, chapter, verse)
    };
  }

  /**
   * Decode simple reference (fallback)
   */
  private decodeSimpleReference(reference: string, anchorBookId?: number): DecodedReference | null {
    if (!anchorBookId) return null;

    const bookName = this.getBookName(anchorBookId);
    
    return {
      bookName,
      reference,
      anchorBookId,
      formatted: `${bookName} (${reference})`
    };
  }

  /**
   * Format reference into human-readable string
   */
  private formatReference(bookName: string, chapter: number, verse?: number, 
                         endChapter?: number, endVerse?: number): string {
    let formatted = bookName;

    // Check if this is a single-chapter book
    const bookMapping = Array.from(this.bookMappings.values()).find(b => b.englishName === bookName);
    const isSingleChapterBook = bookMapping?.chapterCount === 1;

    if (chapter) {
      if (isSingleChapterBook) {
        // For single-chapter books, the "chapter" is actually the verse number
        // Format: "Jude 24" instead of "Jude 1:24"
        formatted += ` ${chapter}`;
        
        if (verse) {
          // If there's a verse, it means we have verse range: "Jude 24-25"
          formatted += `-${verse}`;
        }
      } else {
        // Multi-chapter books: normal "Book chapter:verse" format
        formatted += ` ${chapter}`;
        
        if (verse) {
          formatted += `:${verse}`;
          
          if (endChapter && endVerse) {
            if (endChapter === chapter) {
              formatted += `-${endVerse}`;
            } else {
              formatted += `-${endChapter}:${endVerse}`;
            }
          }
        }
      }
    }

    return formatted;
  }

  /**
   * Initialize Bible book mappings from the anchor documentation
   * Based on docs/anchor-complete-ot-nt-mapping.md
   */
  private initializeBookMappings(): void {
    // Old Testament Books
    const otBooks: BibleBookMapping[] = [
      { anchorId: 1, englishName: 'Genesis', osisAbbr: 'Gen', chapterCount: 50, status: 'Complete' },
      { anchorId: 2, englishName: 'Exodus', osisAbbr: 'Exod', chapterCount: 40, status: 'Complete' },
      { anchorId: 3, englishName: 'Leviticus', osisAbbr: 'Lev', chapterCount: 27, status: 'Partial' },
      { anchorId: 4, englishName: 'Numbers', osisAbbr: 'Num', chapterCount: 36, status: 'Partial' },
      { anchorId: 5, englishName: 'Deuteronomy', osisAbbr: 'Deut', chapterCount: 34, status: 'Complete' },
      { anchorId: 6, englishName: 'Joshua', osisAbbr: 'Josh', chapterCount: 24, status: 'Complete' },
      { anchorId: 7, englishName: 'Judges', osisAbbr: 'Judg', chapterCount: 21, status: 'Complete' },
      { anchorId: 8, englishName: 'Ruth', osisAbbr: 'Ruth', chapterCount: 4, status: 'Complete' },
      { anchorId: 9, englishName: '1 Samuel', osisAbbr: '1Sam', chapterCount: 31, status: 'Complete' },
      { anchorId: 10, englishName: '2 Samuel', osisAbbr: '2Sam', chapterCount: 24, status: 'Complete' },
      { anchorId: 11, englishName: '1 Kings', osisAbbr: '1Kgs', chapterCount: 22, status: 'Complete' },
      { anchorId: 12, englishName: '2 Kings', osisAbbr: '2Kgs', chapterCount: 25, status: 'Complete' },
      { anchorId: 13, englishName: '1 Chronicles', osisAbbr: '1Chr', chapterCount: 29, status: 'Partial' },
      { anchorId: 14, englishName: '2 Chronicles', osisAbbr: '2Chr', chapterCount: 36, status: 'Partial' },
      { anchorId: 15, englishName: 'Ezra', osisAbbr: 'Ezra', chapterCount: 10, status: 'Complete' },
      { anchorId: 16, englishName: 'Nehemiah', osisAbbr: 'Neh', chapterCount: 13, status: 'Complete' },
      { anchorId: 17, englishName: 'Esther', osisAbbr: 'Esth', chapterCount: 10, status: 'Complete' },
      { anchorId: 18, englishName: 'Job', osisAbbr: 'Job', chapterCount: 42, status: 'Complete' },
      { anchorId: 19, englishName: 'Psalms', osisAbbr: 'Ps', chapterCount: 150, status: 'Complete' },
      { anchorId: 20, englishName: 'Proverbs', osisAbbr: 'Prov', chapterCount: 31, status: 'Complete' },
      { anchorId: 21, englishName: 'Ecclesiastes', osisAbbr: 'Eccl', chapterCount: 12, status: 'Complete' },
      { anchorId: 22, englishName: 'Song of Solomon', osisAbbr: 'Song', chapterCount: 8, status: 'Complete' },
      { anchorId: 23, englishName: 'Isaiah', osisAbbr: 'Isa', chapterCount: 66, status: 'Complete' },
      { anchorId: 24, englishName: 'Jeremiah', osisAbbr: 'Jer', chapterCount: 52, status: 'Partial' },
      { anchorId: 25, englishName: 'Lamentations', osisAbbr: 'Lam', chapterCount: 5, status: 'Complete' },
      { anchorId: 26, englishName: 'Ezekiel', osisAbbr: 'Ezek', chapterCount: 48, status: 'Partial' },
      { anchorId: 27, englishName: 'Daniel', osisAbbr: 'Dan', chapterCount: 12, status: 'Complete' },
      { anchorId: 28, englishName: 'Hosea', osisAbbr: 'Hos', chapterCount: 14, status: 'Complete' },
      { anchorId: 29, englishName: 'Joel', osisAbbr: 'Joel', chapterCount: 3, status: 'Complete' },
      { anchorId: 30, englishName: 'Amos', osisAbbr: 'Amos', chapterCount: 9, status: 'Complete' },
      { anchorId: 31, englishName: 'Obadiah', osisAbbr: 'Obad', chapterCount: 1, status: 'Complete' },
      { anchorId: 32, englishName: 'Jonah', osisAbbr: 'Jonah', chapterCount: 4, status: 'Complete' },
      { anchorId: 33, englishName: 'Micah', osisAbbr: 'Mic', chapterCount: 7, status: 'Complete' },
      { anchorId: 34, englishName: 'Nahum', osisAbbr: 'Nah', chapterCount: 3, status: 'Complete' },
      { anchorId: 35, englishName: 'Habakkuk', osisAbbr: 'Hab', chapterCount: 3, status: 'Complete' },
      { anchorId: 36, englishName: 'Zephaniah', osisAbbr: 'Zeph', chapterCount: 3, status: 'Complete' },
      { anchorId: 37, englishName: 'Haggai', osisAbbr: 'Hag', chapterCount: 2, status: 'Complete' },
      { anchorId: 38, englishName: 'Zechariah', osisAbbr: 'Zech', chapterCount: 14, status: 'Complete' },
      { anchorId: 39, englishName: 'Malachi', osisAbbr: 'Mal', chapterCount: 4, status: 'Complete' }
    ];

    // Apocrypha Books (Books 40-60 according to Logos numbering - NRSV arrangement)
    const apocryphaBooks: BibleBookMapping[] = [
      { anchorId: 40, englishName: 'Tobit', osisAbbr: 'Tob', chapterCount: 14, status: 'Complete' },
      { anchorId: 41, englishName: 'Judith', osisAbbr: 'Jdt', chapterCount: 16, status: 'Complete' },
      { anchorId: 42, englishName: 'Esther (Greek)', osisAbbr: 'EsthGr', chapterCount: 16, status: 'Complete' },
      { anchorId: 43, englishName: 'The Wisdom of Solomon', osisAbbr: 'Wis', chapterCount: 19, status: 'Complete' },
      { anchorId: 44, englishName: 'Ecclesiasticus (Sirach)', osisAbbr: 'Sir', chapterCount: 51, status: 'Complete' },
      { anchorId: 45, englishName: 'Baruch', osisAbbr: 'Bar', chapterCount: 6, status: 'Complete' },
      { anchorId: 46, englishName: 'The Letter of Jeremiah', osisAbbr: 'EpJer', chapterCount: 1, status: 'Complete' },
      { anchorId: 47, englishName: 'Song of the Three Young Men', osisAbbr: 'PrAzar', chapterCount: 1, status: 'Complete' },
      { anchorId: 48, englishName: 'Susanna', osisAbbr: 'Sus', chapterCount: 1, status: 'Complete' },
      { anchorId: 49, englishName: 'Bel and the Dragon', osisAbbr: 'Bel', chapterCount: 1, status: 'Complete' },
      { anchorId: 50, englishName: '1 Maccabees', osisAbbr: '1Macc', chapterCount: 16, status: 'Complete' },
      { anchorId: 51, englishName: '2 Maccabees', osisAbbr: '2Macc', chapterCount: 15, status: 'Complete' },
      { anchorId: 52, englishName: '1 Esdras', osisAbbr: '1Esd', chapterCount: 9, status: 'Complete' },
      { anchorId: 53, englishName: 'Prayer of Manasseh', osisAbbr: 'PrMan', chapterCount: 1, status: 'Complete' },
      { anchorId: 54, englishName: 'Psalm 151', osisAbbr: 'AddPs', chapterCount: 1, status: 'Complete' },
      { anchorId: 55, englishName: '3 Maccabees', osisAbbr: '3Macc', chapterCount: 7, status: 'Complete' },
      { anchorId: 56, englishName: '2 Esdras', osisAbbr: '2Esd', chapterCount: 16, status: 'Complete' },
      { anchorId: 57, englishName: '4 Maccabees', osisAbbr: '4Macc', chapterCount: 18, status: 'Complete' }
    ];

    // New Testament Books (Books 61-87 according to Logos numbering)
    const ntBooks: BibleBookMapping[] = [
      { anchorId: 61, englishName: 'Matthew', osisAbbr: 'Matt', chapterCount: 28, status: 'Complete' },
      { anchorId: 62, englishName: 'Mark', osisAbbr: 'Mark', chapterCount: 16, status: 'Complete' },
      { anchorId: 63, englishName: 'Luke', osisAbbr: 'Luke', chapterCount: 24, status: 'Complete' },
      { anchorId: 64, englishName: 'John', osisAbbr: 'John', chapterCount: 21, status: 'Complete' },
      { anchorId: 65, englishName: 'Acts', osisAbbr: 'Acts', chapterCount: 28, status: 'Complete' },
      { anchorId: 66, englishName: 'Romans', osisAbbr: 'Rom', chapterCount: 16, status: 'Complete' },
      { anchorId: 67, englishName: '1 Corinthians', osisAbbr: '1Cor', chapterCount: 16, status: 'Complete' },
      { anchorId: 68, englishName: '2 Corinthians', osisAbbr: '2Cor', chapterCount: 13, status: 'Complete' },
      { anchorId: 69, englishName: 'Galatians', osisAbbr: 'Gal', chapterCount: 6, status: 'Complete' },
      { anchorId: 70, englishName: 'Ephesians', osisAbbr: 'Eph', chapterCount: 6, status: 'Complete' },
      { anchorId: 71, englishName: 'Philippians', osisAbbr: 'Phil', chapterCount: 4, status: 'Complete' },
      { anchorId: 72, englishName: 'Colossians', osisAbbr: 'Col', chapterCount: 4, status: 'Complete' },
      { anchorId: 73, englishName: '1 Thessalonians', osisAbbr: '1Thess', chapterCount: 5, status: 'Complete' },
      { anchorId: 74, englishName: '2 Thessalonians', osisAbbr: '2Thess', chapterCount: 3, status: 'Complete' },
      { anchorId: 75, englishName: '1 Timothy', osisAbbr: '1Tim', chapterCount: 6, status: 'Complete' },
      { anchorId: 76, englishName: '2 Timothy', osisAbbr: '2Tim', chapterCount: 4, status: 'Complete' },
      { anchorId: 77, englishName: 'Titus', osisAbbr: 'Titus', chapterCount: 3, status: 'Complete' },
      { anchorId: 78, englishName: 'Philemon', osisAbbr: 'Phlm', chapterCount: 1, status: 'Complete' },
      { anchorId: 79, englishName: 'Hebrews', osisAbbr: 'Heb', chapterCount: 13, status: 'Complete' },
      { anchorId: 80, englishName: 'James', osisAbbr: 'Jas', chapterCount: 5, status: 'Complete' },
      { anchorId: 81, englishName: '1 Peter', osisAbbr: '1Pet', chapterCount: 5, status: 'Complete' },
      { anchorId: 82, englishName: '2 Peter', osisAbbr: '2Pet', chapterCount: 3, status: 'Complete' },
      { anchorId: 83, englishName: '1 John', osisAbbr: '1John', chapterCount: 5, status: 'Complete' },
      { anchorId: 84, englishName: '2 John', osisAbbr: '2John', chapterCount: 1, status: 'Complete' },
      { anchorId: 85, englishName: '3 John', osisAbbr: '3John', chapterCount: 1, status: 'Complete' },
      { anchorId: 86, englishName: 'Jude', osisAbbr: 'Jude', chapterCount: 1, status: 'Complete' },
      { anchorId: 87, englishName: 'Revelation', osisAbbr: 'Rev', chapterCount: 22, status: 'Complete' }
    ];

    // Populate the map
    [...otBooks, ...apocryphaBooks, ...ntBooks].forEach(book => {
      this.bookMappings.set(book.anchorId, book);
    });
  }

  /**
   * Get all available book mappings
   */
  public getBookMappings(): BibleBookMapping[] {
    return Array.from(this.bookMappings.values());
  }

  /**
   * Validate if a book ID exists
   */
  public isValidBookId(bookId: number): boolean {
    return this.bookMappings.has(bookId);
  }

  /**
   * Get OSIS abbreviation for a book
   */
  public getOsisAbbr(anchorBookId: number): string {
    const mapping = this.bookMappings.get(anchorBookId);
    return mapping ? mapping.osisAbbr : '';
  }

  /**
   * Get Bible section prefix based on anchor book ID
   * OT: 1-39, AP: 40-60, NT: 61-87
   */
  public getBibleSectionPrefix(anchorBookId: number): string {
    if (anchorBookId >= 1 && anchorBookId <= 39) {
      return 'OT';
    } else if (anchorBookId >= 40 && anchorBookId <= 60) {
      return 'AP';
    } else if (anchorBookId >= 61 && anchorBookId <= 87) {
      return 'NT';
    }
    return 'UN'; // Unknown
  }

  /**
   * Generate filename for Bible reference in an easy to read format
   * Format: OT02 Exodus 06.10 - 06.14.md
   */
  public generateBibleFilename(anchorBookId: number, chapter: number, verse?: number, endChapter?: number, endVerse?: number): string {
    const sectionPrefix = this.getBibleSectionPrefix(anchorBookId);
    const englishName = this.getBookName(anchorBookId);
    
    // Calculate adjusted book numbers based on section
    let adjustedBookId: number;
    if (anchorBookId >= 1 && anchorBookId <= 39) {
      // OT: keep original numbering (1-39)
      adjustedBookId = anchorBookId;
    } else if (anchorBookId >= 40 && anchorBookId <= 60) {
      // AP: subtract 39 to get 1-21 range
      adjustedBookId = anchorBookId - 39;
    } else if (anchorBookId >= 61 && anchorBookId <= 87) {
      // NT: subtract 60 to get 1-27 range  
      adjustedBookId = anchorBookId - 60;
    } else {
      // Fallback for unknown ranges
      adjustedBookId = anchorBookId;
    }
    
    // Format adjusted book ID with leading zero (2 digits)
    const bookIdFormatted = adjustedBookId.toString().padStart(2, '0');
    
    // Format chapter with leading zero (2 digits)
    const chapterFormatted = chapter.toString().padStart(2, '0');
    
    // Format verse with leading zero (2 digits) - default to 01 if no verse
    const verseFormatted = (verse || 1).toString().padStart(2, '0');
    
    // Build the reference part
    let referenceText = `${chapterFormatted}.${verseFormatted}`;
    
    // Add range if end chapter/verse provided
    if (endChapter || endVerse) {
      const endChapterFormatted = (endChapter || chapter).toString().padStart(2, '0');
      const endVerseFormatted = (endVerse || verse || 1).toString().padStart(2, '0');
      referenceText += ` - ${endChapterFormatted}.${endVerseFormatted}`;
    }
    
    return `${sectionPrefix}${bookIdFormatted} ${englishName} ${referenceText}.md`;
  }

  /**
   * Generate simple filename for frontmatter (kebab-case)
   * Format: "1-samuel-8-5"
   * TODO: this may not be needed.
   */
  public generateSimpleFilename(bookName: string, chapter: number, verse?: number): string {
    const simpleName = bookName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    if (verse) {
      return `${simpleName}-${chapter}-${verse}`;
    } else {
      return `${simpleName}-${chapter}`;
    }
  }
} 