import 'dotenv/config';
import * as drive from './dist/adapters/drive.js';
import * as state from './dist/core/state.js';
import { runJob } from './dist/core/job-runner.js';
import { logger } from './dist/core/logger.js';

async function main() {
  console.log('🔍 Поиск новых файлов в Google Drive...\n');

  try {
    // 1. Поиск новых файлов
    const newFiles = await drive.listNewFiles();
    if (newFiles.length === 0) {
      console.log('❌ Нет новых файлов для обработки');
      return;
    }

    console.log(`✅ Найдено файлов: ${newFiles.length}\n`);
    
    // Обработка первого файла
    const fileToProcess = newFiles[0];
    const originalName = fileToProcess.name;
    const processName = `${originalName}-process`;
    
    console.log(`📄 Обрабатываем: ${originalName}`);
    console.log(`   ID: ${fileToProcess.id}`);
    console.log(`   Version: ${fileToProcess.version}\n`);

    // 2. Переименовываем файл (claim)
    console.log('🔄 Переименовываем файл...');
    await drive.renameFile(fileToProcess.id, processName);
    console.log(`   ✅ ${processName}\n`);

    // 3. Создаем Job
    console.log('📝 Создаем задачу...');
    const job = await state.createJob({
      fileId: fileToProcess.id,
      revisionId: fileToProcess.version,
    });
    await state.updateJobStatus(job.id, 'CLAIMED');
    console.log(`   ✅ Job ID: ${job.id}\n`);

    // 4. Запускаем обработку
    console.log('⚙️  Запускаем обработку...\n');
    console.log('━'.repeat(60));
    await runJob(job.id);
    console.log('━'.repeat(60));
    
    console.log('\n✅ Обработка завершена!');
    console.log(`\n📊 Проверьте результат:\n   npx tsx test-wordpress-result.ts\n`);

  } catch (error) {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  }
}

main();
