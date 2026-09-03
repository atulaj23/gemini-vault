/**
 * Google Cloud Secret Manager Service
 *
 * Handles secure retrieval of the Gemini API key.
 *
 * Environment strategy:
 * - Test       -> test placeholder
 * - Development -> GEMINI_API_KEY environment variable
 * - Render      -> GEMINI_API_KEY environment variable
 * - Cloud Run  -> Google Cloud Secret Manager
 *
 * SECURITY:
 * - Secrets are never logged.
 * - Secrets are never stored in Firestore.
 * - Secrets are never returned to frontend clients.
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { config } from '../config';
import { logger } from '../utils/logger';

let secretManagerClient: SecretManagerServiceClient | null = null;

const secretCache = new Map<string, string>();

/**
 * Create Secret Manager client lazily.
 *
 * This prevents the application from trying to initialize
 * Google Cloud credentials unless Secret Manager is actually used.
 */
function getClient(): SecretManagerServiceClient {
  if (!secretManagerClient) {
    secretManagerClient = new SecretManagerServiceClient();
  }

  return secretManagerClient;
}

/**
 * Retrieve a secret from Google Cloud Secret Manager.
 *
 * Results are cached in memory for the lifetime of the process.
 *
 * @param secretName - Secret name
 * @param projectId - Google Cloud project ID
 */
export async function getSecret(
  secretName: string,
  projectId?: string
): Promise<string> {
  const project = projectId ?? config.googleCloudProject;

  if (!project) {
    logger.error('Google Cloud project is not configured');

    throw new Error(
      'Failed to retrieve required configuration. Service unavailable.'
    );
  }

  const cacheKey = `${project}/${secretName}`;

  // Return cached value if available
  const cachedSecret = secretCache.get(cacheKey);

  if (cachedSecret) {
    return cachedSecret;
  }

  const client = getClient();

  const name =
    `projects/${project}/secrets/${secretName}/versions/latest`;

  try {
    const [version] = await client.accessSecretVersion({
      name,
    });

    const payload = version.payload?.data;

    if (!payload) {
      throw new Error('Secret payload is empty');
    }

    const value =
      typeof payload === 'string'
        ? payload
        : Buffer.from(payload).toString('utf8');

    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new Error('Secret value is empty');
    }

    // Cache only in server memory
    secretCache.set(cacheKey, trimmedValue);

    // SECURITY:
    // Never log the secret value.
    logger.info('Secret retrieved successfully', {
      secretName,
    });

    return trimmedValue;
  } catch (err) {
    // SECURITY:
    // Never log the secret value.
    // The secret name is only logged server-side for diagnostics.
    logger.error(
      'Failed to retrieve secret from Secret Manager',
      {
        secretName,
        error:
          err instanceof Error
            ? err.message
            : 'Unknown error',
      }
    );

    throw new Error(
      'Failed to retrieve required configuration. Service unavailable.'
    );
  }
}

/**
 * Get Gemini API key.
 *
 * Environment strategy:
 *
 * 1. Tests
 *    -> Test placeholder
 *
 * 2. GEMINI_API_KEY exists
 *    -> Use environment variable
 *
 *    This is important for Render because Render does not
 *    automatically provide Google Cloud Application Default
 *    Credentials for Secret Manager.
 *
 * 3. No GEMINI_API_KEY
 *    -> Use Google Cloud Secret Manager
 *
 *    This is intended for Cloud Run where the attached
 *    service account has Secret Manager access.
 */
export async function getGeminiApiKey(): Promise<string> {
  // Test environment
  if (config.isTest) {
    return 'test-api-key-placeholder';
  }

  /**
   * Render / local environment variable path
   *
   * IMPORTANT:
   * Do not log the actual API key.
   */
  if (config.geminiApiKey) {
    logger.info(
      'Using Gemini API key from server environment'
    );

    return config.geminiApiKey;
  }

  /**
   * Cloud Run / Google Cloud Secret Manager path
   */
  if (!config.googleCloudProject) {
    logger.error(
      'Gemini API key is unavailable and Google Cloud project is not configured'
    );

    throw new Error(
      'Failed to retrieve required configuration. Service unavailable.'
    );
  }

  return getSecret(
    config.geminiSecretName,
    config.googleCloudProject
  );
}