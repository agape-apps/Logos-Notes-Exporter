import { MarkdownConverter } from './dist/markdown-converter.js';
import { mkdir, rm } from 'fs/promises';

async function testEndToEnd() {
  console.log('🎯 Testing End-to-End Image Processing Pipeline...\n');
  
  try {
    // Clean up any previous test output
    try {
      await rm('./test-e2e-output', { recursive: true });
    } catch {
      // Directory doesn't exist, that's fine
    }

    // Create test output directory
    await mkdir('./test-e2e-output', { recursive: true });
    
    // Create markdown converter
    const converter = new MarkdownConverter({
      includeFrontmatter: true,
      includeMetadata: true,
      includeDates: true,
      includeNotebook: true,
      includeId: true,
      dateFormat: 'iso',
      htmlSubSuperscript: false
    });

    // Mock organized note with XAML content containing images
    const testNote = {
      id: 12345,
      formattedTitle: 'Test Note with Images',
      contentRichText: `<Paragraph FlowDirection="LeftToRight" FontSize="11" Language="en-us" Margin="0,0,0,0" TextAlignment="Left">
        <UriMedia Uri="https://files.logoscdn.com/v1/assets/17159730/optimized?rev=61895961&amp;w=auto&amp;share=Y3saRg5mgEvpnPvx" Width="3024" Height="4032" />
        <Run Text="This is a test note with an embedded image." />
      </Paragraph>
      <Paragraph FlowDirection="LeftToRight" FontSize="11" Language="en-us" Margin="0,0,0,0" TextAlignment="Left">
        <Run Text="Here's another image:" />
      </Paragraph>
      <Paragraph FlowDirection="LeftToRight" FontSize="11" Language="en-us" Margin="0,0,0,0" TextAlignment="Left">
        <UriMedia Uri="https://files.logoscdn.com/v1/assets/17163135/optimized?rev=61908488&amp;w=auto&amp;share=JfBJuUnPLD9XYRKO" Width="2048" Height="1536" />
        <Run Text="Angel in battle against demon artwork." />
      </Paragraph>`,
      createdDate: '2024-01-15T10:30:00Z',
      modifiedDate: '2024-01-15T11:45:00Z',
      kind: 0,
      references: [{
        formatted: 'Philippians 2:3',
        bookName: 'Philippians'
      }]
    };

    // Mock notebook group
    const testGroup = {
      notebook: {
        id: 1,
        title: 'Test Notebook'
      },
      sanitizedFolderName: 'test-notebook',
      notes: [testNote]
    };

    // Mock file info
    const testFileInfo = {
      fullPath: './test-e2e-output/test-note-with-images.md',
      directory: './test-e2e-output',
      filename: 'test-note-with-images',
      relativePath: 'test-note-with-images.md',
      exists: false
    };

    console.log('🔄 Converting note with image processing...');
    
    // Test the new async conversion method
    const result = await converter.convertNoteWithImages(
      testNote,
      testGroup,
      testFileInfo,
      './test-e2e-output'
    );

    console.log('✅ Conversion completed!');
    console.log('\n📄 Generated Markdown:');
    console.log('=' .repeat(60));
    console.log(result.content);
    console.log('=' .repeat(60));

    console.log('\n📊 Image Processing Statistics:');
    const stats = converter.getXamlConversionStats();
    console.log(JSON.stringify({
      imagesFound: stats.imagesFound,
      imagesDownloaded: stats.imagesDownloaded,
      imageDownloadsFailed: stats.imageDownloadsFailed,
      totalImageSizeMB: stats.totalImageSizeMB
    }, null, 2));

    console.log('\n📁 Checking output files...');
    
    // Check if images were downloaded
    const { readdir } = await import('fs/promises');
    try {
      const imageFiles = await readdir('./test-e2e-output/images');
      console.log('✅ Downloaded images:', imageFiles);
    } catch (error) {
      console.log('❌ No images directory found:', error.message);
    }

    console.log('\n🎉 End-to-end test completed successfully!');
    
  } catch (error) {
    console.error('❌ End-to-end test failed:', error);
    console.error('Stack:', error.stack);
  }
}

testEndToEnd(); 