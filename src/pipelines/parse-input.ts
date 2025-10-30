/**
 * Parse Input - Document parsing (Google Docs/Docx to structured format)
 */

import mammoth from 'mammoth';
import { JSDOM } from 'jsdom';

interface ParsedDocument {
  text: string;
  rawHtml: string;
  metadata?: {
    title?: string;
    author?: string;
    wordCount?: number;
  };
}

export async function parseDocument(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ParsedDocument> {
  // Handle .docx files
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const htmlResult = await mammoth.convertToHtml({ buffer: fileBuffer });
    const rawHtml = htmlResult.value;
    
    // Extract plain text from HTML
    const dom = new JSDOM(rawHtml);
    const text = dom.window.document.body.textContent || '';
    
    return {
      text: text.trim(),
      rawHtml,
      metadata: {
        wordCount: text.split(/\s+/).filter((word: string) => word.length > 0).length,
      },
    };
  }
  
  // Handle text/plain (exported Google Docs as plain text)
  if (mimeType === 'text/plain') {
    const text = fileBuffer.toString('utf-8');
    const rawHtml = `<p>${text.replace(/\n/g, '</p><p>')}</p>`;
    
    return {
      text: text.trim(),
      rawHtml,
      metadata: {
        wordCount: text.split(/\s+/).filter((word: string) => word.length > 0).length,
      },
    };
  }
  
  // Handle text/html (exported Google Docs as HTML)
  if (mimeType === 'text/html') {
    const rawHtml = fileBuffer.toString('utf-8');
    
    // Extract plain text from HTML
    const dom = new JSDOM(rawHtml);
    const text = dom.window.document.body.textContent || '';
    
    return {
      text: text.trim(),
      rawHtml,
      metadata: {
        wordCount: text.split(/\s+/).filter((word: string) => word.length > 0).length,
      },
    };
  }
  
  // Fallback for unsupported types
  throw new Error(`Unsupported MIME type: ${mimeType}`);
}

export async function parseGoogleDoc(fileId: string): Promise<ParsedDocument> {
  // TODO: Implement Google Docs parsing via API
  console.log(`Parsing Google Doc: ${fileId}`);
  return {
    text: '',
    rawHtml: '',
  };
}
