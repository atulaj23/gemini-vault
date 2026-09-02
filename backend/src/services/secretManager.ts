/**
 * Google Cloud Secret Manager Service
 *
 * Retrieves secrets securely at startup.
 * Used to retrieve the Gemini API key in production.
 *
 * SECURITY: Secrets are never logged, stored in Firestore, or returned to clients.
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { config } from '../config';
import { logger } from '../utils/logger';

let secretManagerClient: SecretManagerServiceClient | null = null;
const secretCache = new Map<string, string>();

function getClient(): SecretManagerServiceClient {
  if (!secretManagerClient) {
    secretManagerClient = new SecretManagerServiceClient();
  }
  return secretManagerClient;
}

/**
 * Retrieve a secret from Google Cloud Secret Manager.
 * Results are cached in-memory for the lifetime of the process.
 *
 * @param secretName - The secret resource name or short name
 * @param projectId - GCP project ID
 * @returns The secret value as a string
 */
export async function getSecret(secretName: string, projectId?: string): Promise<string> {
  const project = projectId ?? config.googleCloudProject;
  const cacheKey = `${project}/${secretName}`;

  if (secretCache.has(cacheKey)) {
    return secretCache.get(cacheKey)!;
  }

  const client = getClient();
  const name = `projects/${project}/secrets/${secretName}/versions/latest`;

  try {
    const [version] = await client.accessSecretVersion({ name });
    const payload = version.payload?.data;

    if (!payload) {
      throw new Error(`Secret ${secretName} has empty payload`);
    }

    const value = typeof payload === 'string' ? payload : Buffer.from(payload).toString('utf8');
    secretCache.set(cacheKey, value.trim());

    // SECURITY: Never log the actual value
    logger.info(`Secret retrieved successfully`, { secretName });

    return secretCache.get(cacheKey)!;
  } catch (err) {
    // SECURITY: Never include the secret name in error messages sent to clients
    logger.error(`Failed to retrieve secret from Secret Manager`, {
      secretName,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    throw new Error('Failed to retrieve required configuration. Service unavailable.');
  }
}

/**
 * Get the Gemini API key.
 * In development: returns GEMINI_API_KEY env var.
 * In production: retrieves from Secret Manager.
 */
export async function getGeminiApiKey(): Promise<string> {
  if (config.isTest) {
    return 'test-api-key-placeholder';
  }

  if (config.geminiApiKey && !config.isProduction) {
    // Development shortcut: use env var if set
    logger.info('Using GEMINI_API_KEY from environment (development mode)');
    return config.geminiApiKey;
  }

  // Production: always use Secret Manager
  return getSecret(config.geminiSecretName, config.googleCloudProject);
}
