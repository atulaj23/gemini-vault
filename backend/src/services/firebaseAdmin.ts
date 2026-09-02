/**
 * Firebase Admin SDK Singleton
 *
 * Initializes Firebase Admin once and returns the singleton instance.
 * Used for token verification and Firestore access.
 */

import * as admin from 'firebase-admin';
import { config } from '../config';
import { logger } from '../utils/logger';

let adminInstance: admin.app.App | null = null;

export function initFirebaseAdmin(): admin.app.App {
  if (adminInstance) return adminInstance;

  if (admin.apps.length > 0) {
    adminInstance = admin.apps[0]!;
    return adminInstance;
  }

  if (config.isTest) {
    // In tests, initialize with a mock project ID
    // Tests that need real Firebase use their own mocks
    adminInstance = admin.initializeApp({
      projectId: 'test-project',
    });
    return adminInstance;
  }

  const projectId = config.firebaseProjectId;

  if (config.isDevelopment && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Local development with service account file
    adminInstance = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    logger.info('Firebase Admin initialized with application default credentials');
  } else {
    // Cloud Run — uses the service account attached to the Cloud Run service
    adminInstance = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    logger.info('Firebase Admin initialized with default credentials');
  }

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
