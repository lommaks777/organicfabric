import 'dotenv/config';
import axios from 'axios';
import { prisma } from './src/db/prisma.js';

async function main() {
  // Получаем последний обработанный пост
  const lastJob = await prisma.job.findFirst({
    where: {
      status: 'DONE',
      postId: { not: null },
    },
    orderBy: {
      finishedAt: 'desc',
    },
  });

  if (!lastJob || !lastJob.postId) {
    console.log('❌ Не найдено завершенных задач с постом WordPress');
    return;
  }

  console.log('📝 Проверяем пост ID:', lastJob.postId);
  console.log('📄 Job ID:', lastJob.id);
  console.log('');

  const wpSiteUrl = process.env.WP_SITE_URL;
  const wpUsername = process.env.WP_USERNAME;
  const wpAppPassword = process.env.WP_APP_PASSWORD;

  const credentials = Buffer.from(`${wpUsername}:${wpAppPassword}`).toString('base64');

  try {
    const response = await axios.get(
      `${wpSiteUrl}/wp-json/wp/v2/posts/${lastJob.postId}`,
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      }
    );

    const content = response.data.content.rendered;
    const title = response.data.title.rendered;

    console.log('✅ Пост найден в WordPress');
    console.log('📌 Заголовок:', title);
    console.log('🔗 URL:', response.data.link);
    console.log('');

    // Проверка 1: Верхний виджет после 3-го параграфа
    console.log('=== ПРОВЕРКА 1: Верхний виджет ===');
    const paragraphs = content.match(/<p[^>]*>.*?<\/p>/gs) || [];
    console.log(`Найдено параграфов: ${paragraphs.length}`);
    
    // Ищем виджет между 3-м и 4-м параграфом
    const thirdParagraphEnd = content.indexOf(paragraphs[2]) + paragraphs[2].length;
    const fourthParagraphStart = paragraphs[3] ? content.indexOf(paragraphs[3]) : content.length;
    const contentBetween3and4 = content.substring(thirdParagraphEnd, fourthParagraphStart);
    
    const hasTopWidget = /<!--\s*wp:html\s*-->[\s\S]*?<!--\s*\/wp:html\s*-->/.test(contentBetween3and4) ||
                         /<div[^>]*class="[^"]*widget[^"]*"/.test(contentBetween3and4);
    
    if (hasTopWidget) {
      console.log('✅ Верхний виджет НАЙДЕН после 3-го абзаца');
      const widgetMatch = contentBetween3and4.match(/<div[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (widgetMatch) {
        console.log('   Превью виджета:', widgetMatch[0].substring(0, 200) + '...');
      }
    } else {
      console.log('❌ Верхний виджет НЕ НАЙДЕН после 3-го абзаца');
      console.log('   Контент между 3-м и 4-м параграфом:', contentBetween3and4.substring(0, 300));
    }
    console.log('');

    // Проверка 2: Нижний виджет в конце статьи
    console.log('=== ПРОВЕРКА 2: Нижний виджет ===');
    const lastParagraph = paragraphs[paragraphs.length - 1];
    const lastParagraphIndex = content.lastIndexOf(lastParagraph);
    const contentAfterLastParagraph = content.substring(lastParagraphIndex + lastParagraph.length);
    
    const hasBottomWidget = /<!--\s*wp:html\s*-->[\s\S]*?<!--\s*\/wp:html\s*-->/.test(contentAfterLastParagraph) ||
                            /<div[^>]*class="[^"]*widget[^"]*"/.test(contentAfterLastParagraph);
    
    if (hasBottomWidget) {
      console.log('✅ Нижний виджет НАЙДЕН в конце статьи');
      const widgetMatch = contentAfterLastParagraph.match(/<div[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (widgetMatch) {
        console.log('   Превью виджета:', widgetMatch[0].substring(0, 200) + '...');
      }
    } else {
      console.log('❌ Нижний виджет НЕ НАЙДЕН в конце статьи');
      console.log('   Контент после последнего параграфа:', contentAfterLastParagraph.substring(0, 300));
    }
    console.log('');

    // Проверка 3: Изображения
    console.log('=== ПРОВЕРКА 3: Изображения ===');
    const images = content.match(/<img[^>]*>/g) || [];
    console.log(`Найдено изображений: ${images.length}`);
    
    let centeredImages = 0;
    let largeSizeImages = 0;
    
    images.forEach((img, index) => {
      const hasCenterClass = /class="[^"]*aligncenter[^"]*"/.test(img);
      const hasLargeSize = /class="[^"]*size-large[^"]*"/.test(img);
      
      if (hasCenterClass) centeredImages++;
      if (hasLargeSize) largeSizeImages++;
      
      console.log(`   Изображение ${index + 1}:`);
      console.log(`      - Выровнено по центру: ${hasCenterClass ? '✅' : '❌'}`);
      console.log(`      - Размер large: ${hasLargeSize ? '✅' : '❌'}`);
      console.log(`      - HTML: ${img.substring(0, 150)}...`);
    });
    
    console.log('');
    console.log(`Итого: ${centeredImages}/${images.length} изображений выровнены по центру`);
    console.log(`Итого: ${largeSizeImages}/${images.length} изображений имеют размер large`);
    console.log('');

    // Проверка 4: Подписи к картинкам
    console.log('=== ПРОВЕРКА 4: Подписи к картинкам ===');
    const figures = content.match(/<figure[^>]*>[\s\S]*?<\/figure>/g) || [];
    console.log(`Найдено figure блоков: ${figures.length}`);
    
    let captionsFound = 0;
    let russianCaptions = 0;
    let shortCaptions = 0;
    
    figures.forEach((figure, index) => {
      const captionMatch = figure.match(/<figcaption[^>]*>(.*?)<\/figcaption>/);
      if (captionMatch) {
        captionsFound++;
        const caption = captionMatch[1].replace(/<[^>]*>/g, '').trim();
        const hasRussian = /[а-яА-ЯёЁ]/.test(caption);
        const isShort = caption.length < 100;
        
        if (hasRussian) russianCaptions++;
        if (isShort) shortCaptions++;
        
        console.log(`   Подпись ${index + 1}:`);
        console.log(`      - Текст: "${caption}"`);
        console.log(`      - Длина: ${caption.length} символов ${isShort ? '✅' : '❌ (слишком длинная)'}`);
        console.log(`      - На русском: ${hasRussian ? '✅' : '❌'}`);
      }
    });
    
    console.log('');
    console.log(`Итого: ${captionsFound}/${figures.length} блоков имеют подписи`);
    console.log(`Итого: ${russianCaptions}/${captionsFound} подписей на русском`);
    console.log(`Итого: ${shortCaptions}/${captionsFound} подписей короткие (<100 символов)`);
    console.log('');

    // Общий результат
    console.log('=== ОБЩИЙ РЕЗУЛЬТАТ ===');
    console.log(`✓ Верхний виджет: ${hasTopWidget ? '✅ Да' : '❌ Нет'}`);
    console.log(`✓ Нижний виджет: ${hasBottomWidget ? '✅ Да' : '❌ Нет'}`);
    console.log(`✓ Изображения по центру: ${centeredImages}/${images.length} ${centeredImages === images.length ? '✅' : '⚠️'}`);
    console.log(`✓ Подписи на русском: ${russianCaptions}/${captionsFound} ${russianCaptions === captionsFound ? '✅' : '⚠️'}`);
    console.log(`✓ Подписи короткие: ${shortCaptions}/${captionsFound} ${shortCaptions === captionsFound ? '✅' : '⚠️'}`);
    console.log('');
    console.log('🔗 Откройте пост в браузере для визуальной проверки:');
    console.log(response.data.link);
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }

  await prisma.$disconnect();
}

main();
