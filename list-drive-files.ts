import 'dotenv/config';
import { listNewFiles } from './src/adapters/drive.js';

async function main() {
  console.log('📁 Файлы в Google Drive (ready for processing):\n');
  
  const files = await listNewFiles();
  
  if (files.length === 0) {
    console.log('❌ Нет файлов для обработки');
    console.log('ℹ️ Файлы должны НЕ содержать суффиксы: -process, -done, -error');
  } else {
    files.forEach(file => {
      console.log(`📄 ${file.name}`);
      console.log(`   ID: ${file.id}`);
      console.log(`   Modified: ${file.modifiedTime}`);
      console.log('');
    });
    
    console.log(`✅ Всего найдено файлов: ${files.length}`);
  }
}

main();
