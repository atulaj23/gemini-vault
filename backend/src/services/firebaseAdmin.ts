/**
 * Firebase Admin SDK Singleton
 *
 * Initializes Firebase Admin once and returns the singleton instance.
 * Used for Firebase Authentication token verification and Firestore access.
 */

import * as admin from 'firebase-admin';
import { config } from '../config';
import { logger } from '../utils/logger';

let adminInstance: admin.app.App | null = null;

export function initFirebaseAdmin(): admin.app.App {
  // Already initialized
  if (adminInstance) {
    return adminInstance;
  }

  // Firebase Admin may already be initialized elsewhere
  if (admin.apps.length > 0) {
    adminInstance = admin.apps[0]!;
    return adminInstance;
  }

  // Test environment
  if (config.isTest) {
    adminInstance = admin.initializeApp({
      projectId: 'test-project',
    });

    return adminInstance;
  }

  const projectId = config.firebaseProjectId;

  /**
   * Render / server environments
   *
   * FIREBASE_SERVICE_ACCOUNT_JSON contains the Firebase Admin
   * service-account credentials.
   *
   * SECURITY:
   * - This variable is server-side only.
   * - Never expose it through Vite/frontend variables.
   * - Never log its contents.
   */
  const serviceAccountJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);

      adminInstance = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });

      logger.info(
        'Firebase Admin initialized with service account environment credential'
      );

      return adminInstance;
    } catch (error) {
      logger.error(
        'Failed to initialize Firebase Admin with service account',
        {
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error',
        }
      );

      throw new Error(
        'Invalid FIREBASE_SERVICE_ACCOUNT_JSON configuration'
      );
    }
  }

  /**
   * Local development / Cloud Run
   *
   * Uses Application Default Credentials.
   *
   * Local:
   * GOOGLE_APPLICATION_CREDENTIALS should point to the
   * Firebase service-account JSON file.
   *
   * Cloud Run:
   * Uses the service account attached to the Cloud Run service.
   */
  adminInstance = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });

  logger.info(
    'Firebase Admin initialized with application default credentials'
  );

  return adminInstance;
}

export function getFirebaseAdmin(): admin.app.App {
  if (!adminInstance) {
    return initFirebaseAdmin();
  }

  return adminInstance;
}

export function getFirestore(): admin.firestore.Firestore {
  return getFirebaseAdmin().firestore();
}