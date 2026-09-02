/**
 * Gemini Vault — Backend Entry Point
 *
 * Privacy-First, Tamper-Evident Personal AI Journal
 * Starts the Express server on the Cloud Run-provided PORT.
 */

import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(`Gemini Vault backend started`, {
    port: config.port,
    env: config.nodeEnv,
    pid: process.pid,
  });
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info(`Received ${signal} — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
