/**
 * Journal Routes
 *
 * GET    /api/journal             — list journal entries
 * POST   /api/journal             — create journal entry
 * GET    /api/journal/:id         — get journal entry
 * PUT    /api/journal/:id         — update journal entry (draft only)
 * POST   /api/journal/:id/finalize — finalize entry (adds to integrity chain)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import {
  createJournalEntry,
  getJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from '../services/firestore';
import { finalizeJournalEntry } from '../services/integrityVault';
import { generateJournalSummary } from '../services/gemini';
import {
  createJournalEntrySchema,
  updateJournalEntrySchema,
  firestoreIdSchema,
} from '../utils/validation';
import { ValidationError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();

// All journal routes require authentication
router.use(requireAuth);

// GET /api/journal
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = await listJournalEntries(req.uid);
    res.json({ data: entries, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// POST /api/journal
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createJournalEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input');
    }

    const entry = await createJournalEntry(req.uid, parsed.data);
    res.status(201).json({ data: entry, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// GET /api/journal/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParsed = firestoreIdSchema.safeParse(req.params.id);
    if (!idParsed.success) throw new ValidationError('Invalid entry ID');

    const entry = await getJournalEntry(req.uid, idParsed.data);
    if (!entry) throw new NotFoundError('Journal entry not found');

    res.json({ data: entry, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// PUT /api/journal/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParsed = firestoreIdSchema.safeParse(req.params.id);
    if (!idParsed.success) throw new ValidationError('Invalid entry ID');

    const parsed = updateJournalEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input');
    }

    await updateJournalEntry(req.uid, idParsed.data, parsed.data);
    const updated = await getJournalEntry(req.uid, idParsed.data);
    res.json({ data: updated, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// POST /api/journal/:id/finalize
router.post('/:id/finalize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParsed = firestoreIdSchema.safeParse(req.params.id);
    if (!idParsed.success) throw new ValidationError('Invalid entry ID');

    const entryId = idParsed.data;

    // Optionally generate AI summary before finalizing
    const entry = await getJournalEntry(req.uid, entryId);
    if (!entry) throw new NotFoundError('Journal entry not found');

    let aiSummary: string | null = entry.aiSummary;
    if (!aiSummary) {
      try {
        aiSummary = await generateJournalSummary(entry.content);
        await updateJournalEntry(req.uid, entryId, { aiSummary });
      } catch {
        // Summary generation is non-fatal
        logger.warn('Could not generate AI summary before finalization', {
          requestId: req.requestId,
          entryId,
        });
      }
    }

    const result = await finalizeJournalEntry(req.uid, entryId);

    logger.info('Journal entry finalized successfully', {
      requestId: req.requestId,
      entryId,
      sequenceNumber: result.ledger.sequenceNumber,
    });

    res.json({
      data: {
        entry: result.entry,
        integrityLedger: result.ledger,
      },
      requestId: req.requestId,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
