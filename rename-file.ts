import 'dotenv/config';
import { renameFile } from './dist/adapters/drive.js';

async function main() {
  const fileId = process.argv[2];
  const newName = process.argv[3];
  
  if (!fileId || !newName) {
    console.log('Usage: npx tsx rename-file.ts <fileId> <newName>');
    process.exit(1);
  }
  
  console.log(`🔄 Переименовываем файл ${fileId} в "${newName}"...`);
  await renameFile(fileId, newName);
  console.log('✅ Готово!');
}

main();
