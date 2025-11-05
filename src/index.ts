/**
 * Main Entry Point
 * This file serves as the entry point for the application
 */

console.log('🚀 Starting application - index.ts loaded');

import 'dotenv/config';
console.log('✅ dotenv loaded');

import express from 'express';
console.log('✅ express loaded');

import type { Request, Response } from 'express';
import { logger } from './core/logger.js';
console.log('✅ logger loaded');

import pollDriveHandler from './api/cron/poll-drive.js';
console.log('✅ pollDriveHandler loaded');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Logging middleware
app.use((req: Request, _res: Response, next) => {
  logger.info(`Incoming request: ${req.method} ${req.url}`);
  logger.info(`Headers: ${JSON.stringify(req.headers)}`);
  next();
});

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
  logger.info('='.repeat(50));
  logger.info('Application starting...');
  logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
  logger.info(`PORT: ${PORT}`);
  logger.info(`DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
  logger.info(`OPENAI_API_KEY exists: ${!!process.env.OPENAI_API_KEY}`);
  logger.info('='.repeat(50));

  // Test database connection before starting server
  try {
    const { prisma } = await import('./db/prisma.js');
    logger.info('Testing database connection...');
    await prisma.$connect();
    logger.info('✅ Database connection successful');
    await prisma.$disconnect();
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`✅ Server is running on http://0.0.0.0:${PORT}`);
    logger.info(`✅ Health check: http://0.0.0.0:${PORT}/`);
    logger.info(`✅ Cron endpoint: http://0.0.0.0:${PORT}/api/cron/poll-drive`);
    logger.info('🎉 Application is ready to accept connections');
  });

  // Handle server errors
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`❌ Port ${PORT} is already in use`);
    } else {
      logger.error('❌ Server error:', error);
    }
    process.exit(1);
  });

  logger.info('Application initialized successfully');
}

// Run the application
main().catch((error) => {
  logger.error('Application failed to start:', error);
  process.exit(1);
});
