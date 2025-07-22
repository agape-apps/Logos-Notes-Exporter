import { mkdir, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { existsSync } from 'fs';

// XamlElement interface - copied from main converter for type safety
interface XamlElement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  '@_Uri'?: string;
  '@_Width'?: string;
  '@_Height'?: string;
  '#text'?: string;
}

export interface ImageProcessingResult {
  /** Markdown reference for the image */
  markdownReference: string;
  /** Local file path where image was saved */
  localPath: string;
  /** Original Logos URL */
  originalUrl: string;
  /** Whether download was successful */
  downloadSuccess: boolean;
  /** Error message if download failed */
  errorMessage?: string;
  /** Size of downloaded file in bytes */
  fileSizeBytes?: number;
}

export interface ImageProcessingOptions {
  /** Output directory for the export (base path) */
  outputDirectory: string;
  /** Current note filename for generating unique image names */
  noteFilename: string;
  /** Maximum image download size in MB */
  maxImageSizeMB: number;
  /** Download timeout in milliseconds */
  downloadTimeoutMs: number;
  /** Number of download retry attempts */
  downloadRetries: number;
  /** Whether to download images locally */
  downloadImages: boolean;
  /** Optional logging callback for verbose output */
  onLog?: (message: string) => void;
  /** Whether to enable verbose logging */
  verbose?: boolean;
}

export interface ImageStats {
  /** Total images found in XAML */
  imagesFound: number;
  /** Images successfully downloaded */
  imagesDownloaded: number;
  /** Images that failed to download */
  imageDownloadsFailed: number;
  /** Total size of downloaded images in MB */
  totalImageSizeMB: number;
}

export interface ImageProcessingFailure {
  /** Original image URL */
  originalUrl: string;
  /** Note filename where the image was found */
  noteFilename: string;
  /** Type of failure */
  failureType: 'validation' | 'metadata' | 'download' | 'exception';
  /** Detailed error message */
  errorMessage: string;
  /** URL preview (first 80 characters) */
  urlPreview: string;
}

const DEFAULT_IMAGE_OPTIONS: Partial<ImageProcessingOptions> = {
  maxImageSizeMB: 10,
  downloadTimeoutMs: 30000,
  downloadRetries: 3,
  downloadImages: true,
  verbose: false
};

/**
 * Processes images from XAML UriMedia elements
 * Handles image detection, download, and local file management
 */
export class XamlImageProcessor {
  private options: ImageProcessingOptions;
  private stats: ImageStats;
  private imageCounter: number = 0;
  private failures: ImageProcessingFailure[] = [];

  constructor(options: ImageProcessingOptions) {
    this.options = { ...DEFAULT_IMAGE_OPTIONS, ...options } as ImageProcessingOptions;
    this.stats = {
      imagesFound: 0,
      imagesDownloaded: 0,
      imageDownloadsFailed: 0,
      totalImageSizeMB: 0
    };
  }

  /**
   * Log message if verbose mode is enabled and callback is provided
   */
  private log(message: string): void {
    if (this.options.verbose && this.options.onLog) {
      this.options.onLog(message);
    }
  }

  /**
   * Record a failure with detailed information
   */
  private recordFailure(originalUrl: string, failureType: ImageProcessingFailure['failureType'], errorMessage: string): void {
    this.failures.push({
      originalUrl,
      noteFilename: this.options.noteFilename,
      failureType,
      errorMessage,
      urlPreview: originalUrl.substring(0, 80) + (originalUrl.length > 80 ? '...' : '')
    });
  }

  /**
   * Process a UriMedia element and return markdown reference
   */
  public async processUriMediaElement(element: XamlElement | XamlElement[]): Promise<string> {
    const elements = Array.isArray(element) ? element : [element];
    let result = '';

    for (const elem of elements) {
      if (!elem) continue;

      const attrs = this.getAttributes(elem);
      const uri = attrs['@_Uri'] || '';

      if (!uri) continue;

      this.stats.imagesFound++;
      this.log(`    🔍 Found image URI: ${uri.substring(0, 80)}${uri.length > 80 ? '...' : ''}`);
      
      if (!this.options.downloadImages) {
        // Just create a placeholder if downloads are disabled
        this.log(`    ⏭️  Skipping download (downloads disabled)`);
        result += '![image unavailable]()\n\n';
        continue;
      }

      const imageResult = await this.processImage(uri);
      result += imageResult.markdownReference + '\n\n';
    }

    return result;
  }

  /**
   * Process a single image URL
   */
  private async processImage(originalUrl: string): Promise<ImageProcessingResult> {
    this.log(`      🖼️  Processing image: ${originalUrl.substring(0, 80)}${originalUrl.length > 80 ? '...' : ''}`);
    
    try {
      // Transform URL - decode HTML entities
      const cleanUrl = this.transformUrl(originalUrl);
      this.log(`         🔗 Cleaned URL: ${cleanUrl}`);
      
      // Check if URL is valid and points to supported image format
      if (!this.isValidImageUrl(cleanUrl)) {
        const error = 'Unsupported image format or invalid URL';
        this.log(`         ❌ Validation failed: ${error}`);
        this.stats.imageDownloadsFailed++;
        this.recordFailure(originalUrl, 'validation', error);
        return this.createFailureResult(originalUrl, error);
      }
      this.log(`         ✅ URL validation passed`);

      // Get image metadata and filename
      this.log(`         📋 Getting image metadata...`);
      const metadata = await this.getImageMetadata(cleanUrl);
      if (!metadata.success) {
        const error = metadata.error || 'Failed to get image metadata';
        this.log(`         ❌ Metadata retrieval failed: ${error}`);
        this.stats.imageDownloadsFailed++;
        this.recordFailure(originalUrl, 'metadata', error);
        return this.createFailureResult(originalUrl, error);
      }
      this.log(`         ✅ Metadata retrieved: ${metadata.filename || 'image.jpg'}`);

      // Generate local filename
      const localFilename = this.generateLocalFilename(metadata.filename || 'image.jpg');
      const imagesDir = join(this.options.outputDirectory, 'images');
      const localPath = join(imagesDir, localFilename);
      this.log(`         📁 Local filename: ${localFilename}`);

      // Ensure images directory exists
      await this.ensureImagesDirectory(imagesDir);

      // Check if file already exists (downloaded by previous note)
      if (existsSync(localPath)) {
        const { size } = await import('fs/promises').then(fs => fs.stat(localPath));
        const sizeMB = size / (1024 * 1024);
        this.log(`         ✅ Image already exists: ${localFilename} (${sizeMB.toFixed(2)} MB)`);
        
        return {
          markdownReference: `![](images/${localFilename})`,
          localPath,
          originalUrl,
          downloadSuccess: true,
          fileSizeBytes: size
        };
      }

      // Download the image
      this.log(`         ⬇️  Downloading image...`);
      const downloadResult = await this.downloadImage(cleanUrl, localPath);
      
      if (downloadResult.success) {
        const sizeBytes = downloadResult.sizeBytes || 0;
        const sizeMB = sizeBytes / (1024 * 1024);
        
        this.stats.imagesDownloaded++;
        this.stats.totalImageSizeMB += sizeMB;
        
        this.log(`         ✅ Download successful: ${localFilename} (${sizeMB.toFixed(2)} MB)`);
        
        return {
          markdownReference: `![](images/${localFilename})`,
          localPath,
          originalUrl,
          downloadSuccess: true,
          fileSizeBytes: sizeBytes
        };
      } else {
        this.stats.imageDownloadsFailed++;
        const error = downloadResult.error || 'Download failed';
        this.log(`         ❌ Download failed: ${error}`);
        this.recordFailure(originalUrl, 'download', error);
        return this.createFailureResult(originalUrl, error);
      }

    } catch (error) {
      this.stats.imageDownloadsFailed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`         ❌ Processing failed with exception: ${errorMessage}`);
      this.recordFailure(originalUrl, 'exception', errorMessage);
      return this.createFailureResult(originalUrl, errorMessage);
    }
  }

  /**
   * Transform URL from XAML format to valid HTTP URL
   */
  private transformUrl(url: string): string {
    // Decode HTML entities
    return url
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  }

  /**
   * Check if URL is valid and points to a supported image format
   */
  private isValidImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // Must be HTTPS
      if (urlObj.protocol !== 'https:') return false;
      
      // Allow Logos CDN and Unsplash images
      if (urlObj.hostname.includes('logoscdn.com') || urlObj.hostname.includes('unsplash.com')) {
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get image metadata including filename from content-disposition header
   * Uses GET with Range: bytes=0-0 since Logos CDN doesn't support HEAD requests
   */
  private async getImageMetadata(url: string): Promise<{ success: boolean; filename?: string; error?: string }> {
    for (let attempt = 1; attempt <= this.options.downloadRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.downloadTimeoutMs);

        // Use GET with Range header to get just the first byte + headers (like curl -r 0-0)
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Logos Notes Exporter',
            'Range': 'bytes=0-0'
          }
        });

        clearTimeout(timeout);

        // Accept both 200 (full content) and 206 (partial content) responses
        if (!response.ok && response.status !== 206) {
          if (attempt === this.options.downloadRetries) {
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
          }
          continue;
        }

        // Extract filename from content-disposition header
        const contentDisposition = response.headers.get('content-disposition');
        let filename = 'image.jpg'; // Default fallback

        if (contentDisposition) {
          filename = this.extractFilenameFromContentDisposition(contentDisposition);
        }

        return { success: true, filename };

      } catch (error) {
        if (attempt === this.options.downloadRetries) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { success: false, error: errorMessage };
        }
        
        // Wait before retry
        await this.sleep(1000 * attempt);
      }
    }

    return { success: false, error: 'All retry attempts failed' };
  }

  /**
   * Extract filename from content-disposition header
   */
  private extractFilenameFromContentDisposition(header: string): string {
    // Look for filename*=UTF-8''encoded-filename or filename="filename"
    const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/);
    if (utf8Match) {
      try {
        const decoded = decodeURIComponent(utf8Match[1]);
        return this.sanitizeFilename(decoded);
      } catch {
        // Fall through to regular filename
      }
    }

    const regularMatch = header.match(/filename="([^"]+)"/);
    if (regularMatch) {
      return this.sanitizeFilename(regularMatch[1]);
    }

    return 'image.jpg';
  }

  /**
   * Sanitize filename by removing spaces and invalid characters
   */
  private sanitizeFilename(filename: string): string {
    // Remove or replace invalid characters, convert spaces to hyphens
    let sanitized = filename
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_.]/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Ensure it has a .jpg extension
    if (!sanitized.endsWith('.jpg') && !sanitized.endsWith('.jpeg')) {
      const nameWithoutExt = sanitized.replace(/\.[^.]*$/, '');
      sanitized = nameWithoutExt + '.jpg';
    }

    return sanitized || 'image.jpg';
  }

  /**
   * Generate unique local filename based on note name
   */
  private generateLocalFilename(originalFilename: string): string {
    // Use the extracted filename if available, otherwise generate from note name
    let baseName = originalFilename;
    
    if (originalFilename === 'image.jpg' || !originalFilename) {
      // Generate from note filename
      baseName = this.options.noteFilename.replace(/\.md$/, '');
      this.imageCounter++;
      
      if (this.imageCounter === 1) {
        baseName = baseName + '.jpg';
      } else {
        baseName = baseName + `(${this.imageCounter}).jpg`;
      }
    } else {
      // Use original filename but ensure uniqueness
      const nameWithoutExt = originalFilename.replace(/\.[^.]*$/, '');
      const ext = extname(originalFilename) || '.jpg';
      
      let uniqueName = originalFilename;
      let counter = 1;
      
      while (this.filenameExists(uniqueName)) {
        uniqueName = `${nameWithoutExt}(${counter})${ext}`;
        counter++;
      }
      
      baseName = uniqueName;
    }

    return this.sanitizeFilename(baseName);
  }

  /**
   * Check if filename already exists in the target directory
   */
  private filenameExists(filename: string): boolean {
    const imagesDir = join(this.options.outputDirectory, 'images');
    const fullPath = join(imagesDir, filename);
    return existsSync(fullPath);
  }

  /**
   * Download image to local path
   */
  private async downloadImage(url: string, localPath: string): Promise<{ success: boolean; sizeBytes?: number; error?: string }> {
    for (let attempt = 1; attempt <= this.options.downloadRetries; attempt++) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const controller = new AbortController();
        timeout = setTimeout(() => {
          this.log(`         ⏱️  Download timeout after ${this.options.downloadTimeoutMs}ms (attempt ${attempt}/${this.options.downloadRetries})`);
          controller.abort();
        }, this.options.downloadTimeoutMs);

        this.log(`         📡 Fetching image (attempt ${attempt}/${this.options.downloadRetries})...`);
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Logos Notes Exporter'
          }
        });

        clearTimeout(timeout);
        timeout = undefined;

        if (!response.ok) {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          this.log(`         ❌ HTTP error: ${errorMsg} (attempt ${attempt}/${this.options.downloadRetries})`);
          if (attempt === this.options.downloadRetries) {
            return { success: false, error: errorMsg };
          }
          continue;
        }

        // Check content-length if available
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          const expectedSizeBytes = parseInt(contentLength);
          const expectedSizeMB = expectedSizeBytes / (1024 * 1024);
          this.log(`         📏 Expected size: ${expectedSizeMB.toFixed(2)} MB`);
          if (expectedSizeMB > this.options.maxImageSizeMB) {
            const errorMsg = `Image too large: ${expectedSizeMB.toFixed(1)}MB (max: ${this.options.maxImageSizeMB}MB)`;
            this.log(`         ❌ Size check failed: ${errorMsg}`);
            return { success: false, error: errorMsg };
          }
        } else {
          this.log(`         ⚠️  No content-length header, will check size after download`);
        }

        this.log(`         ⬇️  Downloading image data...`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Check actual size if content-length wasn't available or was incorrect
        const actualSizeMB = buffer.length / (1024 * 1024);
        if (actualSizeMB > this.options.maxImageSizeMB) {
          const errorMsg = `Downloaded image too large: ${actualSizeMB.toFixed(1)}MB (max: ${this.options.maxImageSizeMB}MB)`;
          this.log(`         ❌ Post-download size check failed: ${errorMsg}`);
          return { success: false, error: errorMsg };
        }

        this.log(`         💾 Writing ${actualSizeMB.toFixed(2)} MB to disk...`);
        await writeFile(localPath, buffer);
        
        return { success: true, sizeBytes: buffer.length };

      } catch (error) {
        if (timeout) {
          clearTimeout(timeout);
        }
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.log(`         ❌ Download error: ${errorMessage} (attempt ${attempt}/${this.options.downloadRetries})`);
        
        if (attempt === this.options.downloadRetries) {
          return { success: false, error: errorMessage };
        }
        
        // Wait before retry with exponential backoff
        const waitMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s, etc.
        this.log(`         ⏳ Waiting ${waitMs}ms before retry...`);
        await this.sleep(waitMs);
      }
    }

    return { success: false, error: 'All retry attempts failed' };
  }

  /**
   * Ensure images directory exists
   */
  private async ensureImagesDirectory(imagesDir: string): Promise<void> {
    if (!existsSync(imagesDir)) {
      await mkdir(imagesDir, { recursive: true });
    }
  }

  /**
   * Create a failure result with placeholder
   */
  private createFailureResult(originalUrl: string, error: string): ImageProcessingResult {
    return {
      markdownReference: '![image unavailable]()',
      localPath: '',
      originalUrl,
      downloadSuccess: false,
      errorMessage: error
    };
  }

  /**
   * Get attributes from element (helper method)
   */
  private getAttributes(element: XamlElement): Record<string, string> {
    // Handle preserveOrder attribute structure
    if (element[':@']) {
      return element[':@'];
    }
    
    // Fallback to old structure for backward compatibility
    return element;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current image processing statistics
   */
  public getStats(): ImageStats {
    return { ...this.stats };
  }

  /**
   * Get detailed failure information
   */
  public getFailures(): ImageProcessingFailure[] {
    return [...this.failures];
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      imagesFound: 0,
      imagesDownloaded: 0,
      imageDownloadsFailed: 0,
      totalImageSizeMB: 0
    };
    this.imageCounter = 0;
    this.failures = [];
  }
}