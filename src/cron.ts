/**
 * Cron Job Runner
 * This script is designed to run as a scheduled task
 */

import 'dotenv/config';
import { logger } from './core/logger.js';
import pollDriveHandler from './api/cron/poll-drive.js';

async function runCronJob() {
  logger.info('🕐 Cron job started');
  
  try {
    // Create mock request/response objects
    const mockReq = {} as any;
    const mockRes = {
      status: (code: number) => {
        logger.info(`Response status: ${code}`);
        return mockRes;
      },
      json: (data: any) => {
        logger.info('Response data:', data);
      },
    } as any;

    await pollDriveHandler(mockReq, mockRes);
    
    logger.info('✅ Cron job completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Cron job failed:', error);
    process.exit(1);
  }
}

runCronJob();
