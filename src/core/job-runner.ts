/**
 * Job Runner - Orchestrator for job execution through pipeline stages
 */

import * as drive from '../adapters/drive.js';
import * as wordpress from '../adapters/wordpress.js';
import * as state from './state.js';
import { logger } from './logger.js';

export async function runJob(jobId: string): Promise<void> {
  logger.info(`Starting job execution: ${jobId}`);

  try {
    // 1. Retrieve job data from database
    logger.info(`Retrieving job data for: ${jobId}`);
    const job = await state.getJob(jobId);
    logger.info(`Job retrieved successfully. File ID: ${job.fileId}, Status: ${job.status}`);

    // 2. Create WordPress draft post
    logger.info(`Creating WordPress draft post for job: ${jobId}`);
    const postTitle = `[AUTO] ${job.fileId}`;
    const postContent = `This is a draft automatically generated from file ${job.fileId}. Job ID: ${jobId}`;
    
    const post = await wordpress.createPost({
      title: postTitle,
      content: postContent,
      status: 'draft',
    });
    logger.info(`WordPress draft created successfully. Post ID: ${post.id}`);

    // 3. Update job status to WP_DRAFTED with post metadata
    logger.info(`Updating job status to WP_DRAFTED for job: ${jobId}`);
    await state.updateJobStatus(job.id, 'WP_DRAFTED', {
      postId: post.id,
      postEditLink: post.editLink,
    });
    logger.info(`Job status updated to WP_DRAFTED. Post ID: ${post.id}, Edit Link: ${post.editLink}`);

    // 4. Rename file to indicate completion
    logger.info(`Renaming file to done state for job: ${jobId}`);
    const doneName = `${job.fileId}-done`;
    await drive.renameFile(job.fileId, doneName);
    logger.info(`File renamed to: ${doneName}`);

    // 5. Update job status to DONE
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
      
      // Rename file to indicate error
      const errorName = `${job.fileId}-error`;
      await drive.renameFile(job.fileId, errorName);
      logger.info(`File renamed to error state: ${errorName}`);
      
    } catch (cleanupError) {
      logger.error(`Error during cleanup for job ${jobId}:`, cleanupError);
    }

    // Re-throw original error
    throw error;
  }
}
