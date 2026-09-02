/**
 * Health Check Endpoint
 *
 * GET /api/health
 *
 * Returns the health status of the backend.
 * Used by Cloud Run health checks and monitoring.
 * No authentication required.
 */

import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'gemini-vault-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    // Cloud Run label (required for challenge)
    label: 'dev-tutorial=cloud-run-ai-challenge',
  });
});

export default router;
