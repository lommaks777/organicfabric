import 'dotenv/config';
import { formatArticleHtml } from './dist/pipelines/format-content.js';

async function main() {
  const testText = 'Тестовая статья. Это первый параграф.\n\nЭто второй параграф с важной информацией.';
  
  const testImages = [
    {
      source_url: 'https://example.com/image1.png',
      prompt: 'Test image 1',
    },
  ];
  
  try {
    console.log('Testing formatArticleHtml...');
    const result = await formatArticleHtml(testText, testImages);
    console.log('\n=== RESULT ===');
    console.log(result);
    console.log('\n=== LENGTH ===', result.length);
  } catch (error) {
    console.error('ERROR:', error);
  }
}

main();
