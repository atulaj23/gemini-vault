/**
 * Structured Logger
 *
 * Uses JSON logging in production (Cloud Run structured logging compatible).
 * Uses human-readable format in development.
 *
 * SECURITY: Never log user journal content, tokens, or API keys.
 */

import { config } from '../config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  [key: string]: unknown;
}

function formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  // Sanitize: strip any accidentally passed sensitive keys
  const sensitive = ['password', 'token', 'apiKey', 'api_key', 'secret', 'authorization', 'geminiApiKey'];
  for (const key of sensitive) {
    if (key in entry) {
      entry[key] = '[REDACTED]';
    }
  }

  if (config.isProduction) {
    // Cloud Run structured logging format
    const cloudEntry = {
      ...entry,
      severity: level.toUpperCase(),
    };
    process.stdout.write(JSON.stringify(cloudEntry) + '\n');
  } else {
    const color = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '\x1b[36m';
    const reset = '\x1b[0m';
    const ts = entry.timestamp.substring(11, 23);
    const metaStr = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    process.stdout.write(`${color}[${ts}] ${level.toUpperCase()} ${message}${metaStr}${reset}\n`);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (!config.isProduction) formatLog('debug', message, meta);
  },
  info: (message: string, meta?: Record<string, unknown>) => formatLog('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => formatLog('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => formatLog('error', message, meta),
};
