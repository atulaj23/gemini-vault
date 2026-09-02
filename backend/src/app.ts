/**
 * Express Application Factory
 *
 * Assembles the Express app with all middleware and routes.
 * Exported separately from index.ts so tests can create instances
 * without starting a real server.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { requestId } from './middleware/requestId';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

import healthRouter from './routes/health';
import authRouter from './routes/auth';
import conversationsRouter from './routes/conversations';
import journalRouter from './routes/journal';
import integrityRouter from './routes/integrity';

export function createApp(): express.Application {
  const app = express();

  // ─── Trust proxy (Cloud Run sits behind Google's LB) ──────────────────────
  app.set('trust proxy', 1);

  // ─── Security headers ─────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (config.allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }));

  // ─── Body parsing ─────────────────────────────────────────────────────────
  app.use(express.json({ limit: '50kb' }));
  app.use(express.urlencoded({ extended: false, limit: '50kb' }));

  // ─── Request ID + Logging ─────────────────────────────────────────────────
  app.use(requestId);
  app.use(requestLogger);

  // ─── Global Rate Limiting ─────────────────────────────────────────────────
  const globalLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
    skip: (req) => req.path === '/api/health',
  });
  app.use(globalLimiter);

  // ─── Routes ───────────────────────────────────────────────────────────────
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/journal', journalRouter);
  app.use('/api/integrity', integrityRouter);

  // ─── 404 + Error handlers ─────────────────────────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

// Export type for use in tests
export type App = ReturnType<typeof createApp>;
