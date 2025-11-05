import 'dotenv/config';
import { google } from 'googleapis';

async function main() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  
  const drive = google.drive({ version: 'v3', auth });
  
  // Get file ID and new name from command line arguments
  const fileId = process.argv[2];
  const newName = process.argv[3];
  
  if (!fileId || !newName) {
    console.error('Usage: npx tsx rename-drive-file.ts <fileId> <newName>');
    process.exit(1);
  }
  
  console.log(`Renaming file ${fileId} to: ${newName}`);
  
  await drive.files.update({
    fileId: fileId,
    requestBody: {
      name: newName,
    },
  });
  
  console.log('✓ File renamed successfully!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
