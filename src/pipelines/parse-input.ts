/**
 * Parse Input - Document parsing (Google Docs/Docx to structured format)
 */

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
  _fileBuffer: Buffer,
  mimeType: string
): Promise<ParsedDocument> {
  // TODO: Implement document parsing with mammoth for .docx
  console.log(`Parsing document of type: ${mimeType}`);
  return {
    text: '',
    rawHtml: '',
  };
}

export async function parseGoogleDoc(fileId: string): Promise<ParsedDocument> {
  // TODO: Implement Google Docs parsing via API
  console.log(`Parsing Google Doc: ${fileId}`);
  return {
    text: '',
    rawHtml: '',
  };
}
