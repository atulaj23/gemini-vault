/**
 * Application Configuration
 *
 * All environment variable access is centralised here.
 * Never access process.env directly elsewhere — import config instead.
 */

import 'dotenv/config';

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  port: parseInt(optionalEnv('PORT', '8080'), 10),

  // Firebase
  firebaseProjectId: optionalEnv('FIREBASE_PROJECT_ID', ''),

  // Gemini
  geminiApiKey: optionalEnv('GEMINI_API_KEY', ''),
  geminiSecretName: optionalEnv('GEMINI_SECRET_NAME', 'gemini-api-key'),
  geminiModel: optionalEnv('GEMINI_MODEL', 'gemini-3.6-flash'),

  // Google Cloud
  googleCloudProject: optionalEnv('GOOGLE_CLOUD_PROJECT', ''),

  // CORS
  frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:5173'),

  get allowedOrigins(): string[] {
    const origins = [this.frontendUrl];

    const prodUrl = process.env.PRODUCTION_URL;
    if (prodUrl) origins.push(prodUrl);

    return origins.filter(Boolean);
  },

  // Rate limiting
  rateLimitWindowMs: parseInt(
    optionalEnv('RATE_LIMIT_WINDOW_MS', '900000'),
    10
  ),

  rateLimitMax: parseInt(
    optionalEnv('RATE_LIMIT_MAX_REQUESTS', '100'),
    10
  ),

  // Journal limits
  maxJournalContentLength: 50_000,
  maxTitleLength: 200,
  maxTagLength: 50,
  maxTagCount: 10,
  maxMessageLength: 10_000,

  // Gemini
  geminiMaxTokens: 2048,
  geminiTemperature: 0.7,

  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
} as const;