# Threat Model

## Assets

| Asset | Sensitivity |
|---|---|
| Journal content | HIGH — personal private thoughts |
| Gemini API key | HIGH — billing impact if leaked |
| Firebase tokens | HIGH — authentication |
| Integrity chain | MEDIUM — tamper-evidence |
| User email/profile | MEDIUM — PII |

## Threat Actors

1. **Unauthenticated attacker** — attempts to access the API without credentials
2. **Authenticated attacker (different user)** — attempts to read/write another user's data
3. **Authenticated attacker (own account)** — attempts to modify finalized integrity metadata
4. **Prompt injection via journal content** — attempts to manipulate Gemini through journal text
5. **Secret exfiltration** — attempts to obtain the Gemini API key

## Mitigations

### T1: Unauthenticated API access
- All protected endpoints require a valid Firebase ID token in the `Authorization: Bearer` header
- Missing/malformed/expired tokens → 401 Unauthorized
- Tested: `security.test.ts` Tests 1 & 2

### T2: Cross-user data access (IDOR)
- All Firestore queries are scoped to `req.uid` (from verified token)
- Firestore security rules enforce user isolation
- The UID in request bodies/params is never used for authorization
- Tested: `security.test.ts` Test 4 (cross-user isolation)

### T3: Client-supplied UID override
- The UID is **always** derived from `admin.auth().verifyIdToken(token).uid`
- Client-supplied `uid` fields in request bodies are completely ignored
- Tested: `security.test.ts` Test 5

### T4: Integrity metadata tampering
- Firestore rules: `integrityLedger` is client-read-only (`allow write: if false`)
- Finalized journal entries cannot be updated (Firestore rules + backend check)
- Tested: `security.test.ts` Tests 6 & 7

### T5: Prompt injection
- The Gemini system prompt explicitly instructs the model to treat user content as data
- `---BEGIN JOURNAL ENTRY---` / `---END JOURNAL ENTRY---` delimiters are used for summary generation
- User messages are passed as conversation turns, not interpolated into the system prompt
- The system prompt itself is never revealed in responses
- Tested: `security.test.ts` Test 14

### T6: Gemini API key leakage
- Key is stored in Google Cloud Secret Manager in production
- Key is never in source code, frontend JS, Firestore, or logs
- Key is never returned to clients in any response
- Local dev uses env var (never committed)
- Tested: `security.test.ts` Test 13

### T7: Oversized/malformed input
- Request body limit: 50KB (Express middleware)
- Per-field validation with Zod: title (200 chars), content (50,000 chars), tags (50 chars each, max 10)
- Firestore IDs validated against `^[a-zA-Z0-9_-]+$`
- Tested: `security.test.ts` Tests 10 & 11

### T8: Sensitive data in logs
- Journal content is never logged
- Auth tokens are never logged
- API keys are never logged
- Request bodies are never logged
- Only safe metadata is logged: request ID, method, path, status, duration

### T9: Stack traces in production errors
- The global error handler only returns safe messages in production
- `err.stack` is only included in development logs, never in API responses
- Tested: `security.test.ts` (error response safety test)

### T10: Concurrent integrity chain forks
- Finalization runs inside a Firestore transaction
- The chain tail is read atomically within the transaction
- Concurrent requests will result in one succeeding and one getting a transaction conflict error
- Tested: `security.test.ts` Test 15

## Residual Risks

- **Database admin access:** A privileged Firestore user could modify both journal content and integrity ledger entries. Mitigation: restrict Firestore admin access; future improvement: anchor chain to external log.
- **Token theft:** If a user's Firebase token is stolen, an attacker can access their data. Mitigation: Firebase supports token revocation; short token expiry (1 hour by default).
- **Gemini abuse:** Rate limiting at 20 req/min per IP reduces abuse potential, but billing protection requires GCP quota limits.
