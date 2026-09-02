/**
 * Firebase Authentication Middleware
 *
 * Verifies Firebase ID tokens on every protected request.
 *
 * SECURITY CONTRACT:
 * - The UID is ALWAYS extracted from the verified Firebase token
 * - Client-supplied UIDs in request body/params are IGNORED
 * - Expired, malformed, or missing tokens are rejected with 401
 */

import { Request, Response, NextFunction } from 'express';
import { getFirebaseAdmin } from '../services/firebaseAdmin';
import { UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      // UID from the verified Firebase ID token — the ONLY trusted source
      uid: string;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    const idToken = authHeader.substring(7); // strip "Bearer "

    if (!idToken) {
      throw new UnauthorizedError('Empty authentication token');
    }

    const admin = getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(idToken, true /* checkRevoked */);

    // SECURITY: UID comes ONLY from the verified token — never from client input
    req.uid = decodedToken.uid;

    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
      return;
    }

    // Firebase token verification error — treat as unauthorized
    logger.warn('Firebase token verification failed', {
      requestId: req.requestId,
      // SECURITY: never log the token itself
    });

    next(new UnauthorizedError('Invalid or expired authentication token'));
  }
}
