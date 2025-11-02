import 'dotenv/config';
import { formatArticleHtml } from './dist/pipelines/format-content.js';

async function main() {
  const testText = `Профессиональное руководство по массажу лица

Профессиональный массажист работает не просто с кожей, а через кожу, воздействуя на сложную, многоуровневую систему.

Глубже поверхности: понимание слоев лица

Лицо представляет собой сложную структуру, состоящую из нескольких слоев.

Массаж помогает улучшить кровообращение и лимфоток.`;
  
  const testImages = [
    {
      source_url: 'https://shmmoscow.ru/wp-content/uploads/2025/10/test-image-1.png',
      prompt: 'Professional massage therapist demonstrating facial anatomy layers on a model',
    },
    {
      source_url: 'https://shmmoscow.ru/wp-content/uploads/2025/10/test-image-2.png',
      prompt: 'Client receiving lymphatic drainage massage on treatment table',
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
