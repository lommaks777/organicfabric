import 'dotenv/config';
import { formatArticleHtml } from './dist/pipelines/format-content.js';
import { insertWidgets } from './dist/pipelines/widgets.js';
import { sanitizeHtml } from './dist/pipelines/sanitize.js';
import * as fs from 'fs';

async function main() {
  const testText = `Профессиональное руководство по массажу лица

Профессиональный массажист работает не просто с кожей, а через кожу, воздействуя на сложную, многоуровневую систему. Понимание этой анатомии — критическое различие между поверхностной процедурой и преображающим воздействием.

Глубже поверхности: понимание слоев лица

Лицо представляет собой сложную структуру, состоящую из нескольких слоев, каждый из которых играет свою роль в его внешнем виде, функциях и процессах старения.

Покровная система

Непосредственный контакт специалиста происходит с кожей, которая состоит из трех основных слоев.

Техники массажа

Массаж лица помогает улучшить кровообращение и лимфоток.`;
  
  const testImages = [
    {
      source_url: 'https://example.com/image1.png',
      prompt: 'Professional massage therapist working with client',
    },
  ];
  
  console.log('1️⃣  Форматирование HTML...\n');
  const formatted = await formatArticleHtml(testText, testImages);
  console.log('Результат форматирования:');
  console.log(formatted.substring(0, 500));
  console.log('...\n');
  
  console.log('2️⃣  Санитайзинг...\n');
  const sanitized = sanitizeHtml(formatted);
  console.log('Результат санитайзинга:');
  console.log(sanitized.substring(0, 500));
  console.log('...\n');
  
  console.log('3️⃣  Вставка виджетов...\n');
  const withWidgets = await insertWidgets(sanitized, testText);
  
  console.log('════════ ФИНАЛЬНЫЙ HTML ════════');
  console.log(withWidgets);
  console.log('═══════════════════════════════\n');
  
  // Сохраним в файл для проверки
  fs.writeFileSync('/tmp/test-output.html', withWidgets);
  console.log('✅ Сохранено в /tmp/test-output.html');
  
  // Проверим наличие виджетов
  const hasTopWidget = withWidgets.includes('gc-embed');
  const hasHTMLTags = withWidgets.includes('<html>') || withWidgets.includes('<body>');
  
  console.log('\n📊 Проверка:');
  console.log(`  - Виджеты вставлены: ${hasTopWidget ? '✅' : '❌'}`);
  console.log(`  - Нет лишних тегов <html>/<body>: ${!hasHTMLTags ? '✅' : '❌'}`);
}

main();
