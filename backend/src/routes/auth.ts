/**
 * Auth Routes
 *
 * POST /api/auth/verify  — verify a Firebase token and return user info
 *
 * All other protected routes use the requireAuth middleware directly.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

/**
 * POST /api/auth/verify
 * Verifies the Firebase ID token and returns the authenticated user info.
 * Used by the frontend to confirm the token is valid after login.
 */
router.post('/verify', requireAuth, (req: Request, res: Response, _next: NextFunction) => {
  res.json({
    uid: req.uid,
    authenticated: true,
    requestId: req.requestId,
  });
});

export default router;
