/**
 * Google Drive Adapter - Google Drive API integration
 */

import { google } from 'googleapis';

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  version: string;
}

/**
 * Get authenticated Google Drive API instance
 */
function getAuth() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set');
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return auth;
}

/**
 * Get Drive API client instance
 */
function getDriveClient() {
  const auth = getAuth();
  return google.drive({ version: 'v3', auth });
}

export async function listNewFiles(): Promise<DriveFile[]> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID environment variable is not set');
  }

  const drive = getDriveClient();
  
  // Query for files in the folder that don't have -process, -done, or -error suffixes
  const query = `'${folderId}' in parents and trashed = false and not name contains '-process' and not name contains '-done' and not name contains '-error'`;
  
  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name, modifiedTime, version)',
    orderBy: 'modifiedTime asc',
  });

  const files = response.data.files || [];
  
  return files.map((file: any) => ({
    id: file.id!,
    name: file.name!,
    modifiedTime: file.modifiedTime!,
    version: file.version || '1',
  }));
}

export async function renameFile(fileId: string, newName: string): Promise<void> {
  const drive = getDriveClient();
  
  await drive.files.update({
    fileId,
    requestBody: {
      name: newName,
    },
  });
}

export async function getFileContent(fileId: string, mimeType: string): Promise<Buffer> {
  const drive = getDriveClient();

  // Determine if this is a Google Workspace document
  const isGoogleDoc = mimeType.startsWith('application/vnd.google-apps.');

  if (isGoogleDoc) {
    // Export Google Docs to HTML format for better structure preservation
    const exportMimeType = 'text/html';
    const response = await drive.files.export(
      {
        fileId,
        mimeType: exportMimeType,
      },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(response.data as ArrayBuffer);
  } else {
    // Download binary files (like .docx) as media
    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(response.data as ArrayBuffer);
  }
}

export async function getFileMetadata(fileId: string): Promise<{ mimeType: string; name: string }> {
  const drive = getDriveClient();
  
  const response = await drive.files.get({
    fileId,
    fields: 'mimeType, name',
  });

  return {
    mimeType: response.data.mimeType || 'application/octet-stream',
    name: response.data.name || 'unknown',
  };
}
