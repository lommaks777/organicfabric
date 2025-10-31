import 'dotenv/config';
import { google } from 'googleapis';

async function main() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  
  const drive = google.drive({ version: 'v3', auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name)',
  });
  
  const files = response.data.files || [];
  console.log('Files in folder:');
  files.forEach((f: any) => {
    console.log(`  - ${f.name} (ID: ${f.id})`);
  });
  
  // Find -process or -done file
  const processFile = files.find((f: any) => f.name?.includes('Техническое задание на статью о массаже'));
  if (processFile && processFile.name && processFile.id) {
    console.log(`\nFound file: ${processFile.name}`);
    const originalName = processFile.name.replace(/-process|-done|-error/g, '');
    console.log(`Renaming back to: ${originalName}`);
    
    await drive.files.update({
      fileId: processFile.id,
      requestBody: {
        name: originalName,
      },
    });
    
    console.log('✓ File renamed successfully!');
  } else {
    console.log('\nFile not found');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
