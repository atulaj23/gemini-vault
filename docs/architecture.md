# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                             │
│  React + TypeScript + Vite                               │
│  Firebase Authentication SDK (client-side)               │
│                                                          │
│  User signs in → gets Firebase ID Token                  │
│  Every API call: Authorization: Bearer <id_token>        │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS + Firebase ID Token
                         ↓
┌─────────────────────────────────────────────────────────┐
│              Cloud Run Backend                           │
│  Node.js + Express + TypeScript                          │
│                                                          │
│  1. Firebase Admin SDK → verifyIdToken()                 │
│     → extracts UID from verified token                   │
│                                                          │
│  2. All Firestore queries scoped to verified UID         │
│                                                          │
│  3. Gemini API called server-side only                   │
│     API key retrieved from Secret Manager                │
└──┬─────────────────┬──────────────────┬─────────────────┘
   │                 │                  │
   ↓                 ↓                  ↓
Cloud Firestore  Secret Manager    Gemini API
(user data)      (API key)         (AI responses)
```

## Security Boundary

The **critical security boundary** is the Cloud Run backend:

- The browser NEVER talks to Gemini directly
- The Gemini API key NEVER reaches the browser
- The UID is ALWAYS derived from the verified Firebase token
- Client-supplied UIDs are ALWAYS ignored

## Data Flow

### Authentication Flow
1. User clicks "Sign in with Google" on landing page
2. Firebase Auth popup opens → Google sign-in
3. Firebase issues an ID token (JWT, 1-hour expiry)
4. Frontend stores token in memory (Firebase SDK handles refresh)
5. Every API call includes `Authorization: Bearer <token>`
6. Backend calls `admin.auth().verifyIdToken(token)` → extracts `uid`

### Conversation Flow
1. User creates conversation → `POST /api/conversations`
2. User sends message → `POST /api/conversations/:id/messages`
3. Backend loads conversation history from Firestore
4. Backend calls Gemini with history + new message
5. Backend stores both messages in Firestore
6. Response returned to frontend

### Integrity Finalization Flow
1. User clicks "Finalize Entry" → `POST /api/journal/:id/finalize`
2. Backend starts Firestore transaction
3. Backend reads chain tail atomically
4. Backend computes `contentHash` and `chainHash`
5. Backend writes integrity ledger entry
6. Backend marks journal entry as finalized
7. Transaction commits atomically

## Collections

```
/users/{uid}
  /conversations/{conversationId}
    /messages/{messageId}
  /journalEntries/{entryId}
  /integrityLedger/{entryId}   ← client read-only (Admin SDK bypasses rules)
```

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Health check |
| POST | `/api/auth/verify` | Required | Verify token |
| GET | `/api/conversations` | Required | List conversations |
| POST | `/api/conversations` | Required | Create conversation |
| GET | `/api/conversations/:id` | Required | Get conversation + messages |
| POST | `/api/conversations/:id/messages` | Required | Send message (Gemini) |
| GET | `/api/journal` | Required | List journal entries |
| POST | `/api/journal` | Required | Create journal entry |
| GET | `/api/journal/:id` | Required | Get journal entry |
| PUT | `/api/journal/:id` | Required | Update draft entry |
| POST | `/api/journal/:id/finalize` | Required | Finalize entry |
| GET | `/api/integrity/ledger` | Required | Get integrity ledger |
| POST | `/api/integrity/verify` | Required | Verify chain |
