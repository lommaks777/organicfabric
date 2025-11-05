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
    
    // Обработка всех файлов по очереди
    for (let i = 0; i < newFiles.length; i++) {
      const fileToProcess = newFiles[i];
      const originalName = fileToProcess.name;
      const processName = `${originalName}-process`;
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📄 Обрабатываем файл ${i + 1}/${newFiles.length}: ${originalName}`);
      console.log(`   ID: ${fileToProcess.id}`);
      console.log(`   Version: ${fileToProcess.version}`);
      console.log('='.repeat(60) + '\n');

      try {
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
        
        console.log(`\n✅ Файл ${i + 1}/${newFiles.length} обработан успешно!\n`);
        
        // Небольшая пауза между файлами
        if (i < newFiles.length - 1) {
          console.log('⏳ Пауза 2 секунды перед следующим файлом...\n');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`\n❌ Ошибка при обработке файла "${originalName}":`, error);
        console.log('⏭️  Переходим к следующему файлу...\n');
        continue;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ВСЕ ФАЙЛЫ ОБРАБОТАНЫ!');
    console.log('='.repeat(60));
    console.log(`\n📊 Проверьте результаты:\n   npx tsx test-wordpress-result.ts\n`);

  } catch (error) {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  }
}

main();
