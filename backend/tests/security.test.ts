/**
 * Security Test Suite
 *
 * Tests the core security boundaries of the Gemini Vault backend.
 *
 * These tests verify real Express app behaviour — not mock assertions.
 */

import request from 'supertest';
import { createApp } from '../src/app';

// Mock Firebase Admin to avoid needing real Firebase credentials in tests
jest.mock('../src/services/firebaseAdmin', () => ({
  initFirebaseAdmin: jest.fn(),
  getFirebaseAdmin: jest.fn(() => ({
    auth: () => ({
      verifyIdToken: jest.fn(async (token: string) => {
        if (token === 'valid-token-user-a') return { uid: 'user-a' };
        if (token === 'valid-token-user-b') return { uid: 'user-b' };
        if (token === 'expired-token') throw new Error('Token has expired');
        if (token === 'invalid-token') throw new Error('Invalid token');
        throw new Error('Unknown token');
      }),
    }),
  })),
  getFirestore: jest.fn(() => {
    const docData: Record<string, Record<string, unknown>> = {
      'users/user-a/journalEntries/entry-a': {
        id: 'entry-a',
        uid: 'user-a',
        title: 'Test Entry',
        content: 'Test content',
        tags: [],
        status: 'draft',
        conversationId: 'conv-a',
        aiSummary: null,
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() },
      },
    };

    const mockDoc = (path: string) => ({
      get: jest.fn(async () => ({
        exists: !!docData[path],
        data: () => docData[path] ?? null,
      })),
      set: jest.fn(async () => {}),
      update: jest.fn(async () => {}),
    });

    const mockCollection = (path: string) => ({
      doc: jest.fn((id?: string) => mockDoc(id ? `${path}/${id}` : `${path}/new-doc`)),
      orderBy: jest.fn(() => ({
        desc: jest.fn(),
        limit: jest.fn(() => ({
          get: jest.fn(async () => ({ empty: true, docs: [] })),
        })),
        get: jest.fn(async () => ({ empty: true, docs: [] })),
      })),
      limit: jest.fn(() => ({
        get: jest.fn(async () => ({ empty: true, docs: [] })),
      })),
      get: jest.fn(async () => ({ empty: true, docs: [] })),
    });

    return {
      collection: jest.fn((name: string) => ({
        doc: jest.fn((uid: string) => ({
          collection: jest.fn((subName: string) => mockCollection(`${name}/${uid}/${subName}`)),
          get: jest.fn(async () => ({ exists: false, data: () => null })),
          set: jest.fn(async () => {}),
          update: jest.fn(async () => {}),
        })),
      })),
      batch: jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn(async () => {}),
      })),
      runTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        // Mock transaction — used in finalization tests
        return fn({
          get: jest.fn(async () => ({ exists: false, data: () => null, empty: true, docs: [] })),
          set: jest.fn(),
          update: jest.fn(),
        });
      }),
    };
  }),
}));

// Mock Gemini to avoid real API calls
jest.mock('../src/services/gemini', () => ({
  sendToGemini: jest.fn(async () => 'This is a mock AI response.'),
  generateJournalSummary: jest.fn(async () => 'Mock summary.'),
}));

// Mock Secret Manager
jest.mock('../src/services/secretManager', () => ({
  getGeminiApiKey: jest.fn(async () => 'test-api-key'),
  getSecret: jest.fn(async () => 'test-secret'),
}));

const app = createApp();

// ─── Test 1: Unauthenticated request rejected ──────────────────────────────

describe('Test 1: Unauthenticated requests are rejected', () => {
  it('rejects GET /api/conversations without auth header', async () => {
    const res = await request(app).get('/api/conversations');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects POST /api/journal without auth header', async () => {
    const res = await request(app).post('/api/journal').send({ title: 'Test', content: 'Hi' });
    expect(res.status).toBe(401);
  });

  it('rejects POST /api/auth/verify without auth header', async () => {
    const res = await request(app).post('/api/auth/verify');
    expect(res.status).toBe(401);
  });

  it('allows GET /api/health without auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
});

// ─── Test 2: Invalid Firebase token rejected ───────────────────────────────

describe('Test 2: Invalid Firebase tokens are rejected', () => {
  it('rejects an expired token', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', 'Bearer expired-token');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });

  it('rejects a Bearer header with empty token', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('rejects Authorization header without Bearer prefix', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });
});

// ─── Test 3: Authenticated user can access own data ───────────────────────

describe('Test 3: Authenticated user can access their own data', () => {
  it('allows GET /api/conversations with valid token', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', 'Bearer valid-token-user-a');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('allows POST /api/auth/verify with valid token', async () => {
    const res = await request(app)
      .post('/api/auth/verify')
      .set('Authorization', 'Bearer valid-token-user-a');
    expect(res.status).toBe(200);
    expect(res.body.uid).toBe('user-a');
    expect(res.body.authenticated).toBe(true);
  });
});

// ─── Test 5: Client-supplied UID cannot override authenticated UID ─────────

describe('Test 5: Client-supplied UID is ignored', () => {
  it('auth/verify returns UID from token, not from request body', async () => {
    const res = await request(app)
      .post('/api/auth/verify')
      .set('Authorization', 'Bearer valid-token-user-a')
      .send({ uid: 'attacker-uid', userId: 'injected-uid' });
    expect(res.status).toBe(200);
    expect(res.body.uid).toBe('user-a'); // From token, not body
    expect(res.body.uid).not.toBe('attacker-uid');
  });
});

// ─── Test 8: Content hash detects modification ────────────────────────────

describe('Test 8: Content hash detects modification', () => {
  it('different content produces different content hash', () => {
    const { computeContentHash } = require('../src/utils/crypto');
    const hash1 = computeContentHash('Original journal entry content.');
    const hash2 = computeContentHash('Modified journal entry content!');
    expect(hash1).not.toBe(hash2);
  });

  it('identical content produces identical content hash', () => {
    const { computeContentHash } = require('../src/utils/crypto');
    const hash1 = computeContentHash('Same content');
    const hash2 = computeContentHash('Same content');
    expect(hash1).toBe(hash2);
  });

  it('canonical content hash normalizes whitespace', () => {
    const { computeContentHash } = require('../src/utils/crypto');
    const hash1 = computeContentHash('Hello\nWorld');
    const hash2 = computeContentHash('Hello\r\nWorld');
    expect(hash1).toBe(hash2);
  });
});

// ─── Test 9: Chain linkage detects break ──────────────────────────────────

describe('Test 9: Chain hash linkage verification', () => {
  it('chain hash changes when previousHash changes', () => {
    const { computeChainHash } = require('../src/utils/crypto');
    const params = {
      previousHash: 'GENESIS',
      contentHash: 'abc123',
      uid: 'user-a',
      sequenceNumber: 1,
      serverTimestamp: '2024-01-01T00:00:00.000Z',
    };
    const hash1 = computeChainHash(params);
    const hash2 = computeChainHash({ ...params, previousHash: 'TAMPERED' });
    expect(hash1).not.toBe(hash2);
  });

  it('chain hash changes when contentHash changes', () => {
    const { computeChainHash } = require('../src/utils/crypto');
    const params = {
      previousHash: 'GENESIS',
      contentHash: 'abc123',
      uid: 'user-a',
      sequenceNumber: 1,
      serverTimestamp: '2024-01-01T00:00:00.000Z',
    };
    const hash1 = computeChainHash(params);
    const hash2 = computeChainHash({ ...params, contentHash: 'tampered456' });
    expect(hash1).not.toBe(hash2);
  });

  it('chain hash changes when UID changes', () => {
    const { computeChainHash } = require('../src/utils/crypto');
    const params = {
      previousHash: 'GENESIS',
      contentHash: 'abc123',
      uid: 'user-a',
      sequenceNumber: 1,
      serverTimestamp: '2024-01-01T00:00:00.000Z',
    };
    const hash1 = computeChainHash(params);
    const hash2 = computeChainHash({ ...params, uid: 'different-user' });
    expect(hash1).not.toBe(hash2);
  });

  it('GENESIS hash is the correct starting value', () => {
    const { GENESIS_HASH } = require('../src/utils/crypto');
    expect(GENESIS_HASH).toBe('GENESIS');
  });
});

// ─── Test 10: Invalid request payload rejected ────────────────────────────

describe('Test 10: Invalid request payloads are rejected', () => {
  it('rejects POST /api/conversations with missing title', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', 'Bearer valid-token-user-a')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects POST /api/conversations with empty title', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', 'Bearer valid-token-user-a')
      .send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('rejects GET /api/conversations/:id with invalid ID characters', async () => {
    const res = await request(app)
      .get('/api/conversations/../../etc/passwd')
      .set('Authorization', 'Bearer valid-token-user-a');
    // Either 400 (validation) or 404 — both are acceptable rejections
    expect([400, 404]).toContain(res.status);
  });
});

// ─── Test 11: Oversized request rejected ──────────────────────────────────

describe('Test 11: Oversized requests are rejected', () => {
  it('rejects a request body larger than 50kb', async () => {
    const largeContent = 'x'.repeat(60_000); // 60KB > 50KB limit
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', 'Bearer valid-token-user-a')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ title: largeContent }));
    // Express body-parser returns 413
    expect(res.status).toBe(413);
  });
});

// ─── Test: Health endpoint ────────────────────────────────────────────────

describe('Health endpoint', () => {
  it('returns healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('gemini-vault-backend');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('returns the required Cloud Run label', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.label).toBe('dev-tutorial=cloud-run-ai-challenge');
  });
});

// ─── Test: Error response safety ─────────────────────────────────────────

describe('Error responses do not expose internals', () => {
  it('404 response does not contain stack traces', async () => {
    const res = await request(app)
      .get('/api/nonexistent-endpoint')
      .set('Authorization', 'Bearer valid-token-user-a');
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('at Object.');
    expect(res.text).not.toContain('node_modules');
  });
});
