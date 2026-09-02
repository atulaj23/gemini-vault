/**
 * Integrity Routes
 *
 * GET  /api/integrity/ledger       — get the full integrity ledger
 * GET  /api/integrity/ledger/:id   — get a specific ledger entry
 * POST /api/integrity/verify       — verify the entire chain
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { getIntegrityLedger, getIntegrityLedgerEntry } from '../services/firestore';
import { verifyIntegrityChain } from '../services/integrityVault';
import { firestoreIdSchema } from '../utils/validation';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();

// All integrity routes require authentication
router.use(requireAuth);

// GET /api/integrity/ledger
router.get('/ledger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ledger = await getIntegrityLedger(req.uid);
    res.json({ data: ledger, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// GET /api/integrity/ledger/:id
router.get('/ledger/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParsed = firestoreIdSchema.safeParse(req.params.id);
    if (!idParsed.success) throw new ValidationError('Invalid ledger entry ID');

    const entry = await getIntegrityLedgerEntry(req.uid, idParsed.data);
    if (!entry) {
      res.status(404).json({ error: 'Ledger entry not found', requestId: req.requestId });
      return;
    }
    res.json({ data: entry, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// POST /api/integrity/verify — verify the entire chain
router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Starting integrity chain verification', {
      requestId: req.requestId,
      uid: req.uid,
    });

    const result = await verifyIntegrityChain(req.uid);

    logger.info('Integrity chain verification completed', {
      requestId: req.requestId,
      valid: result.valid,
      entriesChecked: result.entriesChecked,
    });

    res.json({ data: result, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

export default router;
