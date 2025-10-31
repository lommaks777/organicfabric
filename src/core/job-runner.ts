/**
 * Job Runner - Orchestrator for job execution through pipeline stages
 */

import * as drive from '../adapters/drive.js';
import * as wordpress from '../adapters/wordpress.js';
import * as state from './state.js';
import { logger } from './logger.js';
import { parseDocument } from '../pipelines/parse-input.js';
import { generateAndUploadImages } from '../pipelines/image-pick.js';

export async function runJob(jobId: string): Promise<void> {
  logger.info(`Starting job execution: ${jobId}`);

  try {
    // 1. Retrieve job data from database
    logger.info(`Retrieving job data for: ${jobId}`);
    const job = await state.getJob(jobId);
    logger.info(`Job retrieved successfully. File ID: ${job.fileId}, Status: ${job.status}`);

    // 2. Get file metadata to determine MIME type
    logger.info(`Retrieving file metadata for: ${job.fileId}`);
    const metadata = await drive.getFileMetadata(job.fileId);
    logger.info(`File metadata retrieved. Name: ${metadata.name}, MIME type: ${metadata.mimeType}`);

    // 3. Download file content
    logger.info(`Downloading file content for: ${job.fileId}`);
    const fileBuffer = await drive.getFileContent(job.fileId, metadata.mimeType);
    logger.info(`File content downloaded. Buffer size: ${fileBuffer.length} bytes`);

    // 4. Parse document content
    // Note: Google Docs are exported as HTML, so we use text/html for parsing
    const parseAs = metadata.mimeType.startsWith('application/vnd.google-apps.') 
      ? 'text/html' 
      : metadata.mimeType;
    logger.info(`Parsing document as type: ${parseAs} (original: ${metadata.mimeType})`);
    const parsedDoc = await parseDocument(fileBuffer, parseAs);
    logger.info(`Document parsed successfully. Text length: ${parsedDoc.text.length}, HTML length: ${parsedDoc.rawHtml.length}`);

    // 5. Store parsed content as artifacts
    logger.info(`Storing RAW_TEXT artifact for job: ${jobId}`);
    await state.createArtifact(jobId, 'RAW_TEXT', { text: parsedDoc.text });
    
    logger.info(`Storing HTML artifact for job: ${jobId}`);
    await state.createArtifact(jobId, 'HTML', { html: parsedDoc.rawHtml });
    
    logger.info(`Artifacts stored successfully for job: ${jobId}`);

    // 6. Update job status to POST_RENDERED
    logger.info(`Updating job status to POST_RENDERED for job: ${jobId}`);
    await state.updateJobStatus(jobId, 'POST_RENDERED');
    logger.info(`Job status updated to POST_RENDERED`);

    // 7. Generate and upload images
    logger.info(`Generating and uploading images for job: ${jobId}`);
    const imageCount = parseInt(process.env.IMAGE_COUNT || '3', 10);
    let uploadedImages: Array<{ url: string; alt: string; wpMediaId: number; prompt?: string }> = [];
    let featuredMediaId: number | undefined;
    
    try {
      uploadedImages = await generateAndUploadImages(jobId, parsedDoc.text, imageCount);
      logger.info(`Successfully generated and uploaded ${uploadedImages.length} images`);
      
      // Set first image as featured image
      if (uploadedImages.length > 0) {
        featuredMediaId = uploadedImages[0].wpMediaId;
        logger.info(`Setting featured image to media ID: ${featuredMediaId}`);
      }
      
      // Store image metadata as artifact
      await state.createArtifact(jobId, 'IMAGE_META', {
        imageCount: uploadedImages.length,
        imageIds: uploadedImages.map(img => img.wpMediaId),
        images: uploadedImages,
      });
      
      // Update job status to IMAGES_PICKED
      await state.updateJobStatus(jobId, 'IMAGES_PICKED');
      logger.info(`Job status updated to IMAGES_PICKED`);
      
    } catch (imageError) {
      logger.error(`Error during image generation for job ${jobId}:`, imageError);
      logger.warn(`Continuing with post creation without images`);
      // Don't fail the job, just continue without images
    }

    // 8. Create WordPress draft post with parsed content
    logger.info(`Creating WordPress draft post for job: ${jobId}`);
    const postTitle = `[AUTO] ${metadata.name}`;
    const postContent = parsedDoc.text;
    
    const post = await wordpress.createPost({
      title: postTitle,
      content: postContent,
      status: 'draft',
      featuredMedia: featuredMediaId,
    });
    logger.info(`WordPress draft created successfully. Post ID: ${post.id}`);

    // 9. Update job status to WP_DRAFTED with post metadata
    logger.info(`Updating job status to WP_DRAFTED for job: ${jobId}`);
    await state.updateJobStatus(job.id, 'WP_DRAFTED', {
      postId: post.id,
      postEditLink: post.editLink,
    });
    logger.info(`Job status updated to WP_DRAFTED. Post ID: ${post.id}, Edit Link: ${post.editLink}, Featured Image ID: ${featuredMediaId || 'none'}`);

    // 10. Rename file to indicate completion
    logger.info(`Renaming file to done state for job: ${jobId}`);
    const doneName = `${metadata.name}-done`;
    await drive.renameFile(job.fileId, doneName);
    logger.info(`File renamed to: ${doneName}`);

    // 11. Update job status to DONE
    logger.info(`Finalizing job status to DONE for job: ${jobId}`);
    await state.updateJobStatus(job.id, 'DONE');
    logger.info(`Job ${jobId} completed successfully.`);

  } catch (error) {
    // Error handling workflow
    logger.error(`Error during job execution for job ${jobId}:`, error);
    
    try {
      // Update job status to ERROR
      await state.updateJobStatus(jobId, 'ERROR', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      logger.info(`Job status updated to ERROR for job: ${jobId}`);

      // Retrieve job to get file ID for renaming
      const job = await state.getJob(jobId);
      
      // Get file metadata for proper renaming
      const metadata = await drive.getFileMetadata(job.fileId);
      
      // Rename file to indicate error
      const errorName = `${metadata.name}-error`;
      await drive.renameFile(job.fileId, errorName);
      logger.info(`File renamed to error state: ${errorName}`);
      
    } catch (cleanupError) {
      logger.error(`Error during cleanup for job ${jobId}:`, cleanupError);
    }

    // Re-throw original error
    throw error;
  }
}
