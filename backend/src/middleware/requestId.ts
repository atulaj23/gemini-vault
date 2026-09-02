/**
 * Request ID Middleware
 *
 * Assigns a unique ID to every incoming request.
 * Used in logs and error responses for traceability.
 * Never contains user data — safe to log.
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestId(req: Request, _res: Response, next: NextFunction): void {
  // Prefer Cloud Run's X-Cloud-Trace-Context if present, otherwise generate
  const cloudTrace = req.headers['x-cloud-trace-context'];
  req.requestId = typeof cloudTrace === 'string'
    ? cloudTrace.split('/')[0]
    : uuidv4();
  next();
}
