/**
 * Poll Drive - Vercel Cron Job Endpoint
 * Scheduled task to poll Google Drive for new documents
 */

import type { IncomingMessage, ServerResponse } from 'http';
import * as drive from '../../adapters/drive.js';
import * as state from '../../core/state.js';
import { runJob } from '../../core/job-runner.js';
import { logger } from '../../core/logger.js';

interface CronResponse {
  success: boolean;
  message: string;
  jobId?: string;
  error?: string;
}

type NextApiRequest = IncomingMessage & {
  query: Record<string, string | string[]>;
  cookies: Record<string, string>;
  body: any;
  headers: IncomingMessage['headers'];
};

type NextApiResponse<T = any> = ServerResponse & {
  status: (statusCode: number) => NextApiResponse<T>;
  json: (data: T) => void;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CronResponse>
): Promise<void> {
  logger.info('Cron job started: Polling Google Drive');

  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    // 1. Discovery Phase - List new files from Google Drive
    const newFiles = await drive.listNewFiles();
    if (newFiles.length === 0) {
      logger.info('No new files found.');
      res.status(200).json({ success: true, message: 'No new files found.' });
      return;
    }

    // Process only one file per execution for simplicity
    const fileToProcess = newFiles[0];
    const originalName = fileToProcess.name;
    const processName = `${originalName}-process`;
    
    logger.info(`Found new file to process: ${originalName} (ID: ${fileToProcess.id})`);

    // 2. Claim Phase - Rename file to indicate processing started
    await drive.renameFile(fileToProcess.id, processName);

    // Create Job in database
    const job = await state.createJob({
      fileId: fileToProcess.id,
      revisionId: fileToProcess.version,
    });
    await state.updateJobStatus(job.id, 'CLAIMED');
    logger.info(`Created and claimed Job ID: ${job.id}`);

    // 3. Execute job through pipeline
    await runJob(job.id);

    res.status(200).json({ 
      success: true, 
      message: `Job ${job.id} for file ${originalName} started and finished.`, 
      jobId: job.id 
    });

  } catch (error) {
    logger.error('Cron job failed:', error);
    res.status(500).json({
      success: false,
      message: 'Cron job failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
