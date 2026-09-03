/**
 * Express Application Factory
 *
 * Assembles the Express app with all middleware and routes.
 * Exported separately from index.ts so tests can create instances
 * without starting a real server.
 */

import express from 'express';
import path from 'path';
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

  // ─── Trust proxy ──────────────────────────────────────────────────────────
  // Render / Cloud Run sits behind a reverse proxy/load balancer.
  app.set('trust proxy', 1);

  // ─── Security headers ─────────────────────────────────────────────────────
  //
  // Firebase Google Sign-In requires Google's authentication scripts,
  // frames and network endpoints. These are explicitly allowed below.
  //
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Default fallback
          defaultSrc: ["'self'"],

          // Firebase / Google authentication scripts
          scriptSrc: [
            "'self'",
            'https://apis.google.com',
            'https://www.gstatic.com',
          ],

          // React/Vite styles + Firebase/Google UI requirements
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],

          // Images, Firebase/Google assets and data URLs
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https:',
          ],

          // Firebase + Google authentication network requests
          connectSrc: [
            "'self'",
            'https://*.googleapis.com',
            'https://*.firebaseio.com',
            'https://*.firebaseapp.com',
            'https://*.firebasedatabase.app',
            'https://securetoken.googleapis.com',
            'https://identitytoolkit.googleapis.com',
            'https://accounts.google.com',
          ],

          // Fonts
          fontSrc: [
            "'self'",
            'https://fonts.gstatic.com',
            'data:',
          ],

          // Prevent plugins such as Flash/PDF plugins
          objectSrc: ["'none'"],

          // Firebase Google Sign-In popup/iframe
          frameSrc: [
            "'self'",
            'https://*.firebaseapp.com',
            'https://accounts.google.com',
          ],

          // Restrict base URL manipulation
          baseUri: ["'self'"],

          // Restrict form submissions
          formAction: [
            "'self'",
            'https://accounts.google.com',
          ],
        },
      },

      // Firebase authentication can use cross-origin resources.
      crossOriginEmbedderPolicy: false,
    })
  );

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin:
        // curl, mobile apps, server-to-server requests, etc.
        if (!origin) {
          return callback(null, true);
        }

        if (config.allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        callback(
          new Error(`CORS: origin '${origin}' not allowed`)
        );
      },

      credentials: true,

      methods: [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'OPTIONS',
      ],

      allowedHeaders: [
        'Content-Type',
        'Authorization',
      ],

      maxAge: 86400,
    })
  );

  // ─── Body parsing ─────────────────────────────────────────────────────────
  app.use(
    express.json({
      limit: '50kb',
    })
  );

  app.use(
    express.urlencoded({
      extended: false,
      limit: '50kb',
    })
  );

  // ─── Request ID + Logging ─────────────────────────────────────────────────
  app.use(requestId);
  app.use(requestLogger);

  // ─── Global Rate Limiting ─────────────────────────────────────────────────
  const globalLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,

    max: config.rateLimitMax,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
      error: 'Too many requests. Please try again later.',
    },

    // Health endpoint should not consume normal API rate-limit quota.
    skip: (req) => req.path === '/api/health',
  });

  app.use(globalLimiter);

  // ─── API Routes ───────────────────────────────────────────────────────────
  app.use('/api/health', healthRouter);

  app.use('/api/auth', authRouter);

  app.use('/api/conversations', conversationsRouter);

  app.use('/api/journal', journalRouter);

  app.use('/api/integrity', integrityRouter);

  // ─── Production Frontend ──────────────────────────────────────────────────
  //
  // In production, the Dockerfile copies:
  //
  // frontend/dist → /app/frontend-dist
  //
  // Express serves that React/Vite build from here.
  //
  // This allows the same Render service to serve:
  //
  // /              → React frontend
  // /login         → React frontend
  // /journal       → React frontend
  // /integrity     → React frontend
  // /api/*         → Express backend
  //
  if (config.isProduction) {
    const frontendPath = path.join(
      process.cwd(),
      'frontend-dist'
    );

    // Serve static frontend assets.
    app.use(express.static(frontendPath));

    // SPA fallback.
    //
    // React Router routes such as:
    // /login
    // /journal
    // /integrity
    //
    // must return index.html so the React application
    // can handle the route on the client side.
    app.get('*', (req, res, next) => {
      // Never send API requests to the React frontend.
      if (req.path.startsWith('/api')) {
        return next();
      }

      res.sendFile(
        path.join(frontendPath, 'index.html')
      );
    });
  }

  // ─── 404 + Error handlers ─────────────────────────────────────────────────
  app.use(notFound);

  app.use(errorHandler);

  return app;
}

// ─── Export type for tests ───────────────────────────────────────────────────
export type App = ReturnType<typeof createApp>;