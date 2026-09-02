/**
 * Conversations Routes
 *
 * GET    /api/conversations          — list conversations
 * POST   /api/conversations          — create conversation
 * GET    /api/conversations/:id      — get conversation + messages
 * POST   /api/conversations/:id/messages — send message (Gemini)
 */

import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/requireAuth';
import {
  createConversation,
  getConversation,
  listConversations,
  addMessage,
  getConversationHistory,
} from '../services/firestore';
import { sendToGemini } from '../services/gemini';
import { createConversationSchema, sendMessageSchema, firestoreIdSchema } from '../utils/validation';
import { ValidationError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();

// Stricter rate limit on Gemini calls to control costs
const geminiLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 20,
  message: { error: 'Too many AI requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// All routes require authentication
router.use(requireAuth);

// GET /api/conversations
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversations = await listConversations(req.uid);
    res.json({ data: conversations, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createConversationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input');
    }

    const conversation = await createConversation(req.uid, parsed.data);
    res.status(201).json({ data: conversation, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParsed = firestoreIdSchema.safeParse(req.params.id);
    if (!idParsed.success) throw new ValidationError('Invalid conversation ID');

    const conversation = await getConversation(req.uid, idParsed.data);
    if (!conversation) throw new NotFoundError('Conversation not found');

    const messages = await getConversationHistory(req.uid, idParsed.data);
    res.json({ data: { conversation, messages }, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/messages — Send a message + get Gemini response
router.post('/:id/messages', geminiLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParsed = firestoreIdSchema.safeParse(req.params.id);
    if (!idParsed.success) throw new ValidationError('Invalid conversation ID');

    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input');
    }

    const conversationId = idParsed.data;
    const userContent = parsed.data.content;

    // Verify conversation exists and belongs to this user
    const conversation = await getConversation(req.uid, conversationId);
    if (!conversation) throw new NotFoundError('Conversation not found');

    // Load conversation history for multi-turn context
    const history = await getConversationHistory(req.uid, conversationId);

    // Store user message
    const userMessage = await addMessage(req.uid, conversationId, {
      role: 'user',
      content: userContent,
    });

    logger.info('Sending message to Gemini', {
      requestId: req.requestId,
      conversationId,
      // SECURITY: never log the message content
      historyLength: history.length,
    });

    // Call Gemini (passes full history for multi-turn context)
    const aiResponse = await sendToGemini(userContent, history);

    // Store AI response
    const aiMessage = await addMessage(req.uid, conversationId, {
      role: 'model',
      content: aiResponse,
    });

    res.status(201).json({
      data: {
        userMessage,
        aiMessage,
      },
      requestId: req.requestId,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
