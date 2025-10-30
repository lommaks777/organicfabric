/**
 * Job Runner - Orchestrator for job execution through pipeline stages
 */

import * as drive from '../adapters/drive.js';
import * as wordpress from '../adapters/wordpress.js';
import * as state from './state.js';
import { logger } from './logger.js';
import { parseDocument } from '../pipelines/parse-input.js';

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
    logger.info(`Parsing document of type: ${metadata.mimeType}`);
    const parsedDoc = await parseDocument(fileBuffer, metadata.mimeType);
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

    // 7. Create WordPress draft post with parsed content
    logger.info(`Creating WordPress draft post for job: ${jobId}`);
    const postTitle = `[AUTO] ${metadata.name}`;
    const postContent = parsedDoc.text;
    
    const post = await wordpress.createPost({
      title: postTitle,
      content: postContent,
      status: 'draft',
    });
    logger.info(`WordPress draft created successfully. Post ID: ${post.id}`);

    // 8. Update job status to WP_DRAFTED with post metadata
    logger.info(`Updating job status to WP_DRAFTED for job: ${jobId}`);
    await state.updateJobStatus(job.id, 'WP_DRAFTED', {
      postId: post.id,
      postEditLink: post.editLink,
    });
    logger.info(`Job status updated to WP_DRAFTED. Post ID: ${post.id}, Edit Link: ${post.editLink}`);

    // 9. Rename file to indicate completion
    logger.info(`Renaming file to done state for job: ${jobId}`);
    const doneName = `${metadata.name}-done`;
    await drive.renameFile(job.fileId, doneName);
    logger.info(`File renamed to: ${doneName}`);

    // 10. Update job status to DONE
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
