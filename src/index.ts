/**
 * Main Entry Point
 * This file serves as the entry point for the application
 */

import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import { logger } from './core/logger.js';
import pollDriveHandler from './api/cron/poll-drive.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Health check endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'OrganicFabric API is running' });
});

// Cron endpoint
app.get('/api/cron/poll-drive', async (req: Request, res: Response) => {
  try {
    // Адаптируем Express request/response к формату Next.js API
    const adaptedReq = req as any;
    const adaptedRes = {
      ...res,
      status: (code: number) => {
        res.status(code);
        return adaptedRes;
      },
      json: (data: any) => {
        res.json(data);
      },
    };
    
    await pollDriveHandler(adaptedReq, adaptedRes as any);
  } catch (error) {
    logger.error('Error in poll-drive endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function main() {
  logger.info('Application starting...');

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server is running on http://0.0.0.0:${PORT}`);
    logger.info(`Cron endpoint: http://0.0.0.0:${PORT}/api/cron/poll-drive`);
  });

  logger.info('Application initialized successfully');
}

// Run the application
main().catch((error) => {
  logger.error('Application failed to start:', error);
  process.exit(1);
});
