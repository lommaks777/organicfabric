/**
 * Job Runner - Orchestrator for job execution through pipeline stages
 */

import * as drive from '../adapters/drive.js';
import * as wordpress from '../adapters/wordpress.js';
import * as state from './state.js';
import { logger } from './logger.js';
import { parseDocument } from '../pipelines/parse-input.js';
import { generateAndUploadImages } from '../pipelines/image-pick.js';
import { formatArticleHtml } from '../pipelines/format-content.js';
import { sanitizeHtml } from '../pipelines/sanitize.js';
import { insertWidgets } from '../pipelines/widgets.js';

export async function runJob(jobId: string): Promise<void> {
  logger.info(`[Job ${jobId}] Starting job execution.`);
  let job;

  try {
    // === Этап 1: Инициализация и парсинг (критически важный) ===
    job = await state.getJob(jobId);
    const metadata = await drive.getFileMetadata(job.fileId);
    const fileBuffer = await drive.getFileContent(job.fileId, metadata.mimeType);
    const parseMimeType = metadata.mimeType.startsWith('application/vnd.google-apps.') ? 'text/html' : metadata.mimeType;
    const parsedDoc = await parseDocument(fileBuffer, parseMimeType);
    await state.createArtifact(jobId, 'RAW_CONTENT', { text: parsedDoc.text, html: parsedDoc.rawHtml });
    logger.info(`[Job ${jobId}] !!! USING NEW JOB RUNNER !!! Created RAW_CONTENT artifact`);
    await state.updateJobStatus(jobId, 'POST_RENDERED');
    logger.info(`[Job ${jobId}] Step 1/5: Document parsed successfully.`);

    // === Этап 2: Генерация изображений (опциональный) ===
    let uploadedImages: Array<{ url: string; alt: string; wpMediaId: number; prompt?: string }> = [];
    try {
      const imageCount = parseInt(process.env.IMAGE_COUNT || '3', 10);
      uploadedImages = await generateAndUploadImages(jobId, parsedDoc.text, imageCount);
      await state.createArtifact(jobId, 'IMAGE_META', { images: uploadedImages });
      await state.updateJobStatus(jobId, 'IMAGES_PICKED');
      logger.info(`[Job ${jobId}] Step 2/5: Generated and uploaded ${uploadedImages.length} images.`);
    } catch (imageError) {
      logger.error(`[Job ${jobId}] Image generation failed, but continuing.`, imageError);
    }

    // === Этап 3: Форматирование контента (основной + fallback) ===
    let workingHtml = parsedDoc.rawHtml; // Начинаем с HTML, полученного из парсера
    try {
      const imageDataForFormatter = uploadedImages.map(img => ({ source_url: img.url, prompt: img.prompt || '' }));
      const formattedHtml = await formatArticleHtml(parsedDoc.text, parsedDoc.rawHtml, imageDataForFormatter);
      // Проверяем, что AI вернул непустой результат
      if (formattedHtml && formattedHtml.length > 100) {
        workingHtml = formattedHtml;
        logger.info(`[Job ${jobId}] Step 3/5: Content formatted by AI successfully.`);
      } else {
        logger.warn(`[Job ${jobId}] AI returned empty or short content. Using raw HTML as fallback.`);
      }
    } catch (formatError) {
      logger.error(`[Job ${jobId}] Content formatting by AI failed, using raw HTML.`, formatError);
    }
    
    // === Этап 4: Вставка элементов (санитайзер, виджеты) ===
    let finalHtml = workingHtml;
    try {
      // 4.1 Санитайзер (критически важно)
      const safeHtml = sanitizeHtml(finalHtml);
      // 4.2 Вставка виджетов
      finalHtml = await insertWidgets(safeHtml, parsedDoc.text);
      logger.info(`[Job ${jobId}] Step 4/5: Sanitization and widget insertion complete.`);
    } catch (insertionError) {
        logger.error(`[Job ${jobId}] Sanitization or widget insertion failed. Using pre-insertion HTML.`, insertionError);
        finalHtml = workingHtml; // Откат к HTML до вставки
    }

    // ЗАЩИТА: Если после всех шагов HTML пустой, используем исходный текст как последнюю меру.
    if (!finalHtml || finalHtml.trim().length === 0) {
        logger.error(`[Job ${jobId}] CRITICAL: Final HTML is empty! Falling back to raw parsed text.`);
        finalHtml = `<p>${parsedDoc.text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    }

    // === Этап 5: Публикация в WordPress ===
    const featuredMediaId = uploadedImages.length > 0 ? uploadedImages[0].wpMediaId : undefined;
    const postTitle = `[AUTO] ${metadata.name.replace(/-process$/, '')}`;
    const post = await wordpress.createPost({
      title: postTitle,
      content: finalHtml,
      status: 'draft',
      featuredMedia: featuredMediaId,
    });
    logger.info(`[Job ${jobId}] Step 5/5: WordPress draft created. Post ID: ${post.id}`);

    // === Завершение ===
    await state.updateJobStatus(job.id, 'WP_DRAFTED', { postId: post.id, postEditLink: post.editLink });
    const doneName = `${metadata.name.replace(/-process$/, '')}-done`;
    await drive.renameFile(job.fileId, doneName);
    await state.updateJobStatus(job.id, 'DONE');
    logger.info(`[Job ${jobId}] Job completed successfully.`);

  } catch (error) {
    logger.error(`[Job ${jobId}] CRITICAL FAILURE in job execution.`, error);
    if (job) {
      try {
        const jobData = await state.getJob(job.id);
        const metadata = await drive.getFileMetadata(jobData.fileId);
        const errorName = `${metadata.name.replace(/-process$/, '')}-error`;
        await drive.renameFile(jobData.fileId, errorName);
        await state.updateJobStatus(job.id, 'ERROR', { errorMessage: error instanceof Error ? error.message : 'Unknown error' });
      } catch (cleanupError) {
        logger.error(`[Job ${jobId}] Failed to perform error cleanup.`, cleanupError);
      }
    }
  }
}
