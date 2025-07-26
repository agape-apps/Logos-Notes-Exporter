import { ValidationError, Logger, ErrorSeverity } from './errors/index.js';

export interface BibleBookMapping {
  anchorId: number;
  englishName: string;
  osisAbbr: string;
  chapterCount: number;
  status: string;
  logosBibleId?: string;
}

export interface ReferenceDecodingStats {
  totalReferences: number;
  successfulDecodes: number;
  failedDecodes: number;
  unknownBooks: number;
  malformedReferences: number;
  errors: ValidationError[];
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
  private logger: Logger;
  private stats: ReferenceDecodingStats;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger({ enableConsole: true, level: 1 });
    this.stats = {
      totalReferences: 0,
      successfulDecodes: 0,
      failedDecodes: 0,
      unknownBooks: 0,
      malformedReferences: 0,
      errors: []
    };
    this.initializeBookMappings();
  }

  /**
   * Decode a Logos Bible reference string into human-readable format
   * Example input: "bible+nkjv.61.24.14" (Anchor format)
   * Example output: "1 Peter 24:14" 
   */
  public decodeReference(reference: string, anchorBookId?: number): DecodedReference | null {
    this.stats.totalReferences++;
    
    try {
      // Validate input
      if (!reference || typeof reference !== 'string') {
        throw new ValidationError(
          'Invalid reference input',
          'reference',
          reference,
          {
            component: 'BibleReferenceDecoder',
            operation: 'decodeReference',
            userMessage: 'Reference must be a non-empty string',
            suggestions: ['Check that the reference is properly formatted']
          }
        );
      }
      
      const trimmedRef = reference.trim();
      if (!trimmedRef) {
        throw new ValidationError(
          'Empty reference after trimming',
          'reference',
          reference,
          {
            component: 'BibleReferenceDecoder',
            operation: 'decodeReference',
            userMessage: 'Reference cannot be empty or whitespace only'
          }
        );
      }
      
      this.logger.logDebug('Decoding reference', {
        reference: trimmedRef,
        anchorBookId,
        hasAnchorBookId: anchorBookId !== undefined
      }, 'BibleReferenceDecoder');
      
      let result: DecodedReference | null = null;
      
      // Handle different reference formats with specific error handling
      if (trimmedRef.includes('bible+')) {
        result = this.decodeBiblePlusReference(trimmedRef, anchorBookId);
      } else if (trimmedRef.includes('.')) {
        result = this.decodeDottedReference(trimmedRef, anchorBookId);
      } else {
        result = this.decodeSimpleReference(trimmedRef, anchorBookId);
      }
      
      if (result) {
        this.stats.successfulDecodes++;
        this.logger.logDebug('Reference decoded successfully', {
          original: trimmedRef,
          formatted: result.formatted,
          bookName: result.bookName
        }, 'BibleReferenceDecoder');
      } else {
        this.stats.failedDecodes++;
        this.logger.logWarn('Reference decoding returned null', {
          reference: trimmedRef,
          anchorBookId
        }, 'BibleReferenceDecoder');
      }
      
      return result;
      
    } catch (error) {
      this.stats.failedDecodes++;
      
      const decodingError = error instanceof ValidationError 
        ? error 
        : new ValidationError(
            `Failed to decode reference: ${reference}`,
            'reference',
            reference,
            {
              component: 'BibleReferenceDecoder',
              operation: 'decodeReference',
              userMessage: 'Could not decode Bible reference',
              suggestions: [
                'Check if the reference format is supported',
                'Verify the reference contains valid book information'
              ],
              metadata: { anchorBookId }
            },
            error instanceof Error ? error : new Error(String(error))
          );
      
      this.stats.errors.push(decodingError);
      this.logger.logError(decodingError);
      
      return null;
    }
  }

  /**
   * Get book name from anchor book ID with error handling
   */
  public getBookName(anchorBookId: number): string {
    try {
      if (typeof anchorBookId !== 'number' || !Number.isInteger(anchorBookId)) {
        this.logger.logWarn('Invalid anchor book ID provided', {
          anchorBookId,
          type: typeof anchorBookId
        }, 'BibleReferenceDecoder');
        return `Invalid Book ID ${anchorBookId}`;
      }
      
      const mapping = this.bookMappings.get(anchorBookId);
      if (mapping) {
        return mapping.englishName;
      } else {
        this.stats.unknownBooks++;
        this.logger.logWarn('Unknown book ID encountered', {
          anchorBookId,
          availableBookIds: Array.from(this.bookMappings.keys()).slice(0, 10)
        }, 'BibleReferenceDecoder');
        return `Unknown Book ${anchorBookId}`;
      }
    } catch (error) {
      this.logger.logError(new ValidationError(
        `Failed to get book name for ID ${anchorBookId}`,
        'anchorBookId',
        anchorBookId,
        {
          component: 'BibleReferenceDecoder',
          operation: 'getBookName'
        },
        error instanceof Error ? error : new Error(String(error))
      ));
      return `Error: Book ${anchorBookId}`;
    }
  }

  /**
   * Decode Logos "bible+version.book.chapter.verse" format with error handling
   */
  private decodeBiblePlusReference(reference: string, anchorBookId?: number): DecodedReference | null {
    try {
      // Validate input
      if (!reference || typeof reference !== 'string') {
        throw new ValidationError(
          'Invalid reference input for bible+ format',
          'reference',
          reference,
          {
            component: 'BibleReferenceDecoder',
            operation: 'decodeBiblePlusReference',
            userMessage: 'Reference must be a non-empty string'
          }
        );
      }

      this.logger.logDebug('Decoding bible+ reference', {
        reference,
        anchorBookId
      }, 'BibleReferenceDecoder');

      // Pattern: bible+nkjv.61.24.14 or bible+esv.1.1.1-1.1.31
      const match = reference.match(/bible\+([^.]+)\.(\d+)\.(\d+)\.(\d+)(?:-(\d+)\.(\d+)\.(\d+))?/);
      if (!match) {
        this.stats.malformedReferences++;
        this.logger.logWarn('Bible+ reference format not recognized', {
          reference,
          expectedFormat: 'bible+version.book.chapter.verse',
          receivedFormat: 'unrecognized'
        }, 'BibleReferenceDecoder');
        return null;
      }

    const [, version, bookNum, chapter, verse, , endChapter, endVerse] = match;
    
    // Validate extracted components
    if (!bookNum || !chapter || !verse) {
      throw new ValidationError(
        'Missing required components in bible+ reference',
        'reference',
        reference,
        {
          component: 'BibleReferenceDecoder',
          operation: 'decodeBiblePlusReference',
          userMessage: 'Bible reference must include book, chapter, and verse numbers',
          metadata: { version, bookNum, chapter, verse }
        }
      );
    }

    const bookId = parseInt(bookNum);
    if (isNaN(bookId) || bookId <= 0) {
      throw new ValidationError(
        'Invalid book number in bible+ reference',
        'bookNum',
        bookNum,
        {
          component: 'BibleReferenceDecoder',
          operation: 'decodeBiblePlusReference',
          userMessage: 'Book number must be a positive integer',
          metadata: { reference, version }
        }
      );
    }

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

    this.logger.logDebug('Bible+ reference decoded successfully', {
      original: reference,
      formatted: result.formatted,
      bookName: result.bookName,
      version
    }, 'BibleReferenceDecoder');

    return result;

    } catch (error) {
      this.stats.malformedReferences++;
      const conversionError = error instanceof ValidationError 
        ? error 
        : new ValidationError(
            `Failed to decode bible+ reference: ${reference}`,
            'reference',
            reference,
            {
              component: 'BibleReferenceDecoder',
              operation: 'decodeBiblePlusReference',
              userMessage: 'Could not decode Bible+ reference format',
              suggestions: [
                'Check if the reference follows bible+version.book.chapter.verse format',
                'Verify the book number is valid',
                'Check that chapter and verse numbers are numeric'
              ],
              metadata: { anchorBookId }
            },
            error instanceof Error ? error : new Error(String(error))
          );
      
      this.stats.errors.push(conversionError);
      this.logger.logError(conversionError);
      return null;
    }
  }

  /**
   * Decode simple dotted reference format
   */
  private decodeDottedReference(reference: string, anchorBookId?: number): DecodedReference | null {
    try {
      // Validate input
      if (!reference || typeof reference !== 'string') {
        throw new ValidationError(
          'Invalid reference input for dotted format',
          'reference',
          reference,
          {
            component: 'BibleReferenceDecoder',
            operation: 'decodeDottedReference',
            userMessage: 'Reference must be a non-empty string'
          }
        );
      }

      this.logger.logDebug('Decoding dotted reference', {
        reference,
        anchorBookId
      }, 'BibleReferenceDecoder');

      // Pattern: 61.24.14 or 1.1.1-31
      const parts = reference.split('.');
      if (parts.length < 2) {
        this.stats.malformedReferences++;
        this.logger.logWarn('Dotted reference has insufficient parts', {
          reference,
          parts: parts.length,
          minimumRequired: 2,
          expectedFormat: 'book.chapter[.verse]'
        }, 'BibleReferenceDecoder');
        return null;
      }

      // Validate numeric components
      const bookId = anchorBookId || parseInt(parts[0] || '0');
      const chapter = parseInt(parts[1] || '0');
      const verse = parts[2] ? parseInt(parts[2] || '0') : undefined;

      if (isNaN(chapter) || chapter <= 0) {
        throw new ValidationError(
          'Invalid chapter number in dotted reference',
          'chapter',
          parts[1],
          {
            component: 'BibleReferenceDecoder',
            operation: 'decodeDottedReference',
            userMessage: 'Chapter number must be a positive integer',
            metadata: { reference, bookId }
          }
        );
      }

      if (parts[2] && (isNaN(verse!) || verse! <= 0)) {
        throw new ValidationError(
          'Invalid verse number in dotted reference',
          'verse',
          parts[2],
          {
            component: 'BibleReferenceDecoder',
            operation: 'decodeDottedReference',
            userMessage: 'Verse number must be a positive integer',
            metadata: { reference, bookId, chapter }
          }
        );
      }
      
      const bookName = this.getBookName(bookId);

      const result: DecodedReference = {
        bookName,
        chapter,
        verse,
        reference,
        anchorBookId: bookId,
        formatted: this.formatReference(bookName, chapter, verse)
      };

      this.logger.logDebug('Dotted reference decoded successfully', {
        original: reference,
        formatted: result.formatted,
        bookName: result.bookName
      }, 'BibleReferenceDecoder');

      return result;

    } catch (error) {
      this.stats.malformedReferences++;
      const conversionError = error instanceof ValidationError 
        ? error 
        : new ValidationError(
            `Failed to decode dotted reference: ${reference}`,
            'reference',
            reference,
            {
              component: 'BibleReferenceDecoder',
              operation: 'decodeDottedReference',
              userMessage: 'Could not decode dotted reference format',
              suggestions: [
                'Check if the reference follows book.chapter.verse format',
                'Verify all numeric components are valid',
                'Ensure at least book and chapter are provided'
              ],
              metadata: { anchorBookId }
            },
            error instanceof Error ? error : new Error(String(error))
          );
      
      this.stats.errors.push(conversionError);
      this.logger.logError(conversionError);
      return null;
    }
  }

  /**
   * Decode simple reference (fallback)
   */
  private decodeSimpleReference(reference: string, anchorBookId?: number): DecodedReference | null {
    try {
      // Validate input
      if (!reference || typeof reference !== 'string') {
        throw new ValidationError(
          'Invalid reference input for simple format',
          'reference',
          reference,
          {
            component: 'BibleReferenceDecoder',
            operation: 'decodeSimpleReference',
            userMessage: 'Reference must be a non-empty string'
          }
        );
      }

      if (!anchorBookId) {
        this.stats.failedDecodes++;
        this.logger.logWarn('Simple reference requires anchor book ID', {
          reference,
          anchorBookId
        }, 'BibleReferenceDecoder');
        return null;
      }

      if (typeof anchorBookId !== 'number' || !Number.isInteger(anchorBookId)) {
        throw new ValidationError(
          'Invalid anchor book ID for simple reference',
          'anchorBookId',
          anchorBookId,
          {
            component: 'BibleReferenceDecoder',
            operation: 'decodeSimpleReference',
            userMessage: 'Anchor book ID must be a valid integer',
            metadata: { reference }
          }
        );
      }

      this.logger.logDebug('Decoding simple reference', {
        reference,
        anchorBookId
      }, 'BibleReferenceDecoder');

      const bookName = this.getBookName(anchorBookId);
      
      const result: DecodedReference = {
        bookName,
        reference,
        anchorBookId,
        formatted: `${bookName} (${reference})`
      };

      this.logger.logDebug('Simple reference decoded successfully', {
        original: reference,
        formatted: result.formatted,
        bookName: result.bookName
      }, 'BibleReferenceDecoder');

      return result;

    } catch (error) {
      this.stats.failedDecodes++;
      const conversionError = error instanceof ValidationError 
        ? error 
        : new ValidationError(
            `Failed to decode simple reference: ${reference}`,
            'reference',
            reference,
            {
              component: 'BibleReferenceDecoder',
              operation: 'decodeSimpleReference',
              userMessage: 'Could not decode simple reference format',
              suggestions: [
                'Ensure an anchor book ID is provided',
                'Verify the reference string is valid'
              ],
              metadata: { anchorBookId }
            },
            error instanceof Error ? error : new Error(String(error))
          );
      
      this.stats.errors.push(conversionError);
      this.logger.logError(conversionError);
      return null;
    }
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