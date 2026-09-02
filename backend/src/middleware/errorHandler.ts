/**
 * Global Error Handler
 *
 * Converts AppError and unknown errors into safe API responses.
 *
 * SECURITY:
 * - Never exposes stack traces in production
 * - Never exposes internal paths or secret values
 * - Never logs sensitive user content
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId;

  // Express payload-too-large and similar framework errors
  if ('status' in err && typeof (err as { status: unknown }).status === 'number' && !(err instanceof AppError)) {
    const statusErr = err as { status: number; message: string };
    res.status(statusErr.status).json({
      error: statusErr.message,
      code: 'REQUEST_ERROR',
      requestId,
    });
    return;
  }

  if (err instanceof AppError) {
    // Expected application error — log at warn level (no stack needed)
    logger.warn(`AppError: ${err.message}`, {
      requestId,
      statusCode: err.statusCode,
      code: err.code,
    });

    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      requestId,
    });
    return;
  }

  // Unexpected error — log at error level
  logger.error(`Unhandled error: ${err.message}`, {
    requestId,
    errorName: err.name,
    // Include stack only in development logs, never in response
    ...(config.isDevelopment ? { stack: err.stack } : {}),
  });

  // Safe generic response — never expose internals
  res.status(500).json({
    error: 'An internal error occurred. Please try again later.',
    code: 'INTERNAL_ERROR',
    requestId,
  });
}
